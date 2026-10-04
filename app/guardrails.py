import re
import logging
from typing import Any, Dict, List, Set

logger = logging.getLogger("kyumei.guardrails")

# Safety trigger patterns that require physical safety escalation
SAFETY_KEYWORDS = [
    r"\bswoll(?:en|ing)\b",
    r"\bbulg(?:ing|ed)\b",
    r"\bbatter(?:y|ies)\s+expand",
    r"\btrackpad\s+(?:lift|pop|push)",
    r"\bsmok(?:e|ing)\b",
    r"\bburn(?:t|ing)?\s+(?:smell|odor|plastic)\b",
    r"\bspark(?:s|ing)?\b",
    r"\bfire\b",
    r"\belectr(?:ic)?\s*shock\b",
    r"\bopen(?:ing)?\s+(?:the\s+)?(?:psu|power\s+supply)\b",
]

SAFETY_ADVISORY = (
    "SAFETY ALERT: Physical hardware hazard detected (battery swelling, thermal runaway, "
    "or electrical arcing risk). Immediately disconnect device from AC power. Do NOT attempt "
    "to pierce, press, charge, or disassemble the unit. Keep in a fire-resistant space "
    "and consult a certified hardware technician."
)

VAGUE_PATTERNS = [
    r"^(?:my\s+)?(?:computer|pc|laptop|phone|device)\s+(?:is\s+)?(?:broken|dead|not\s+working|won'?t\s+work|doesn'?t\s+work)\.?$",
    r"^(?:it\s+)?won'?t\s+turn\s+on\.?$",
    r"^help(?:\s+me)?\.?$",
    r"^(?:my\s+)?screen\s+black\.?$",
]

DEFAULT_FOLLOW_UP_QUESTIONS = [
    "When you press the power switch, do any indicator LEDs light up or blink?",
    "Do you hear any sounds from fans spinning, internal relays clicking, or motherboard beeps?",
    "What is the exact make and form factor of the device (e.g. desktop, laptop, tablet)?"
]


class GuardrailsEngine:
    def sanitize(self, data: Dict[str, Any], raw_input: str) -> Dict[str, Any]:
        """Apply deterministic guardrails to model outputs:
        1. Drop or flag ungrounded causes (violating evidence-to-cause invariant)
        2. Triage safety hazards (swollen cells, burning, high voltage)
        3. Enforce needs_more_info for ambiguous symptoms
        """
        data = self._enforce_evidence_linking(data)
        data = self._enforce_safety_boundaries(data, raw_input)
        data = self._enforce_thin_evidence(data, raw_input)
        return data

    def _enforce_evidence_linking(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Ensure all causes cite real evidence IDs. Drop any cause with zero valid links."""
        evidence_list = data.get("evidence", [])
        valid_ids: Set[str] = {item["id"] for item in evidence_list if "id" in item}

        causes = data.get("possible_causes", [])
        sanitized_causes = []

        for cause in causes:
            cited_ids = cause.get("evidence_ids", [])
            # Filter cited IDs to only those that exist in evidence
            grounded_ids = [eid for eid in cited_ids if eid in valid_ids]
            
            if grounded_ids:
                cause["evidence_ids"] = grounded_ids
                sanitized_causes.append(cause)
            else:
                logger.warning(
                    "Pruning ungrounded cause '%s' (cited: %s, valid: %s)",
                    cause.get("id"), cited_ids, valid_ids
                )

        data["possible_causes"] = sanitized_causes

        # If all causes were ungrounded and dropped, flip status to needs_more_info
        if not sanitized_causes and data.get("status") == "ok":
            data["status"] = "needs_more_info"
            if not data.get("follow_up_questions"):
                data["follow_up_questions"] = list(DEFAULT_FOLLOW_UP_QUESTIONS)

        return data

    def _enforce_safety_boundaries(self, data: Dict[str, Any], raw_input: str) -> Dict[str, Any]:
        """Check for hazardous hardware conditions and clamp instructions to safety."""
        combined_text = f"{raw_input} {data.get('symptom_summary', '')}".lower()
        is_hazard = any(re.search(pat, combined_text, re.IGNORECASE) for pat in SAFETY_KEYWORDS)

        if is_hazard:
            data["status"] = "safety_alert"
            data["safety_warning"] = SAFETY_ADVISORY
            
            # Prepend or override troubleshooting steps with technician advice
            safe_steps = [
                {
                    "step_number": 1,
                    "action": "Immediately disconnect AC power adapter and do not attempt to charge or power on.",
                    "rationale": "Prevents catastrophic thermal runaway, fire, or further electrical component short-circuits.",
                    "risk_level": "none"
                },
                {
                    "step_number": 2,
                    "action": "Place the unit on a non-flammable surface away from heat sources and flammable items.",
                    "rationale": "Mitigates fire hazard if a swollen lithium-ion pouch cell vents.",
                    "risk_level": "none"
                },
                {
                    "step_number": 3,
                    "action": "Take the device to an authorized repair technician equipped for hazardous hardware handling.",
                    "rationale": "Do NOT attempt DIY disassembly or puncturing of swollen batteries or mains power supplies.",
                    "risk_level": "none"
                }
            ]
            # Replace any potentially risky DIY steps
            data["troubleshooting_steps"] = safe_steps

        return data

    def _enforce_thin_evidence(self, data: Dict[str, Any], raw_input: str) -> Dict[str, Any]:
        """Enforce needs_more_info when input has insufficient evidence."""
        cleaned_input = raw_input.strip()
        is_vague_input = any(re.search(pat, cleaned_input, re.IGNORECASE) for pat in VAGUE_PATTERNS)
        
        evidence_count = len(data.get("evidence", []))
        
        if is_vague_input or evidence_count == 0:
            data["status"] = "needs_more_info"
            if not data.get("follow_up_questions") or len(data.get("follow_up_questions", [])) == 0:
                data["follow_up_questions"] = list(DEFAULT_FOLLOW_UP_QUESTIONS)

        return data


guardrails = GuardrailsEngine()
