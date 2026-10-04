import json
import logging
from typing import Any, Dict, List, Optional
from pathlib import Path

from app.config import settings
from app.ollama_client import OllamaClient
from app.validator import validator
from app.guardrails import guardrails

logger = logging.getLogger("kyumei.pipeline")


class DiagnosticPipeline:
    def __init__(self, ollama_client: Optional[OllamaClient] = None):
        self.client = ollama_client or OllamaClient()
        self.system_prompt = self._load_skill_prompt()

    def _load_skill_prompt(self) -> str:
        """Load the Agent Skill specification (SKILL.md) to serve as system prompt context."""
        skill_file = settings.skill_path
        if not skill_file.exists():
            raise FileNotFoundError(f"SKILL.md not found at {skill_file}")
        
        content = skill_file.read_text(encoding="utf-8")
        
        # Include worked examples if available to anchor small model reasoning
        ref_overheating = settings.references_dir / "worked_overheating.md"
        if ref_overheating.exists():
            content += "\n\n## Worked Reference Examples\n" + ref_overheating.read_text(encoding="utf-8")
            
        return content

    async def run(
        self,
        symptom: str,
        mode: Optional[str] = None
    ) -> Dict[str, Any]:
        """Execute diagnostic reasoning pipeline on symptom text."""
        exec_mode = mode or settings.kyumei_pipeline_mode
        logger.info("Running Kyūmei diagnostic pipeline in '%s' mode", exec_mode)

        if exec_mode == "staged":
            data = await self._run_staged(symptom)
        else:
            data = await self._run_single(symptom)

        # Apply deterministic guardrails (evidence verification, safety clamping)
        sanitized = guardrails.sanitize(data, symptom)
        return sanitized

    async def _run_single(self, symptom: str) -> Dict[str, Any]:
        """Single-pass structured prompt with 1-turn automated retry on schema violation."""
        messages = [
            {"role": "system", "content": self.system_prompt},
            {
                "role": "user",
                "content": (
                    f"Perform hardware diagnostic triage on the following symptom description.\n"
                    f"Return ONLY a JSON object strictly adhering to the schema.\n\n"
                    f"SYMPTOM:\n\"{symptom}\""
                )
            }
        ]

        # Initial Attempt
        raw_output = await self.client.chat(messages, temperature=settings.kyumei_temperature)
        is_valid, data, error_msg = validator.validate(raw_output)

        if is_valid and data is not None:
            return data

        # Automated 1-turn Retry if validation failed
        logger.warning("Initial response failed validation: %s. Initiating retry...", error_msg)
        retry_prompt = validator.build_retry_prompt(error_msg or "Malformed JSON schema")
        
        retry_messages = list(messages)
        retry_messages.append({"role": "assistant", "content": raw_output})
        retry_messages.append({"role": "user", "content": retry_prompt})

        # Retry at slightly lower temperature for deterministic structure
        retry_raw = await self.client.chat(retry_messages, temperature=0.1)
        retry_valid, retry_data, retry_err = validator.validate(retry_raw)

        if retry_valid and retry_data is not None:
            logger.info("Retry succeeded schema validation")
            return retry_data

        logger.error("Retry failed validation: %s. Using partial or fallback payload.", retry_err)
        if retry_data is not None:
            # Use partially valid dictionary if available
            return retry_data
            
        # Safe fallback if both attempts generated unparseable garbage
        return {
            "status": "needs_more_info",
            "symptom_summary": f"Could not conclusively parse model output for symptom: {symptom[:80]}",
            "evidence": [{"id": "E1", "text": symptom}],
            "possible_causes": [],
            "troubleshooting_steps": [
                {
                    "step_number": 1,
                    "action": "Rephrase or provide more specific physical symptoms.",
                    "rationale": "Model requires clearer input to parse diagnostic indicators.",
                    "risk_level": "none"
                }
            ],
            "safety_warning": None,
            "follow_up_questions": [
                "Could you describe what happens when the device is powered on?",
                "Are there any error messages, beeps, or LED blink codes?"
            ]
        }

    async def _run_staged(self, symptom: str) -> Dict[str, Any]:
        """Multi-stage sequential pipeline:
        Stage 1: Extract atomic evidence [E1, E2, ...] & summary
        Stage 2: Formulate grounded causes referencing evidence IDs
        Stage 3: Sequence safest-first troubleshooting steps
        """
        # --- Stage 1: Evidence Extraction ---
        stage1_prompt = (
            f"You are a hardware diagnostic assistant. Read the following symptom.\n"
            f"Extract a concise 1-2 sentence symptom summary and a list of atomic evidence quotes/facts.\n"
            f"Output JSON ONLY with keys: 'symptom_summary' (string) and 'evidence' (array of {{'id': 'E1', 'text': '...'}}).\n\n"
            f"SYMPTOM: \"{symptom}\""
        )
        stage1_res = await self.client.chat(
            [{"role": "user", "content": stage1_prompt}],
            temperature=0.1
        )
        s1_data, _ = validator.extract_json(stage1_res)
        summary = s1_data.get("symptom_summary", symptom) if s1_data else symptom
        evidence = s1_data.get("evidence", []) if s1_data else [{"id": "E1", "text": symptom}]

        # --- Stage 2: Causes with Mandatory Evidence Linking ---
        evidence_json_str = json.dumps(evidence)
        stage2_prompt = (
            f"Given this symptom summary: \"{summary}\"\n"
            f"And this verified evidence list:\n{evidence_json_str}\n\n"
            f"Propose 1 to 3 possible hardware root causes. Every cause MUST cite at least one valid evidence id in 'evidence_ids'.\n"
            f"Output JSON ONLY with keys: 'status' ('ok' | 'needs_more_info' | 'safety_alert'), "
            f"'possible_causes' (array of {{'id': 'C1', 'cause': '...', 'evidence_ids': ['E1'], 'confidence': 'high'|'medium'|'low', 'verification': '...'}}), "
            f"and 'safety_warning' (string or null)."
        )
        stage2_res = await self.client.chat(
            [{"role": "user", "content": stage2_prompt}],
            temperature=0.2
        )
        s2_data, _ = validator.extract_json(stage2_res)
        status = s2_data.get("status", "ok") if s2_data else "ok"
        causes = s2_data.get("possible_causes", []) if s2_data else []
        safety_warning = s2_data.get("safety_warning") if s2_data else None

        # --- Stage 3: Troubleshooting Steps & Verification ---
        causes_json_str = json.dumps(causes)
        stage3_prompt = (
            f"Given the identified causes:\n{causes_json_str}\n\n"
            f"Generate an ordered list of troubleshooting steps sorted strictly SAFEST-FIRST (non-invasive first, internal repair last).\n"
            f"Also provide 1-3 follow_up_questions if additional info is needed.\n"
            f"Output JSON ONLY with keys: 'troubleshooting_steps' (array of {{'step_number': 1, 'action': '...', 'rationale': '...', 'risk_level': 'none'|'low'|'medium'|'high'}}), "
            f"and 'follow_up_questions' (array of strings)."
        )
        stage3_res = await self.client.chat(
            [{"role": "user", "content": stage3_prompt}],
            temperature=0.2
        )
        s3_data, _ = validator.extract_json(stage3_res)
        steps = s3_data.get("troubleshooting_steps", []) if s3_data else []
        follow_up = s3_data.get("follow_up_questions", []) if s3_data else []

        combined = {
            "status": status,
            "symptom_summary": summary,
            "evidence": evidence,
            "possible_causes": causes,
            "troubleshooting_steps": steps,
            "safety_warning": safety_warning,
            "follow_up_questions": follow_up
        }

        return combined


pipeline = DiagnosticPipeline()
