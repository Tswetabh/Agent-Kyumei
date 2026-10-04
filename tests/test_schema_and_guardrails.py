import json
import pytest
from pathlib import Path
from app.validator import validator
from app.guardrails import guardrails
from app.config import settings


def test_schema_validates_examples():
    """Verify that all preloaded example outputs conform strictly to schema.json."""
    examples_dir = settings.examples_dir
    assert examples_dir.exists(), "examples directory must exist"
    
    example_files = list(examples_dir.glob("*.json"))
    assert len(example_files) >= 4, f"Expected at least 4 example files, found {len(example_files)}"

    for ex_file in example_files:
        with open(ex_file, "r", encoding="utf-8") as f:
            data = json.load(f)
        
        expected = data.get("expected_output")
        assert expected is not None, f"Example {ex_file.name} missing expected_output"
        
        # Test JSON extraction & schema validation
        is_valid, parsed, err = validator.validate(json.dumps(expected))
        assert is_valid, f"Example {ex_file.name} failed schema validation: {err}"
        assert parsed is not None


def test_guardrails_drops_ungrounded_causes():
    """Verify that causes citing non-existent evidence IDs are dropped."""
    payload = {
        "status": "ok",
        "symptom_summary": "Test diagnostic summary with mixed grounding",
        "evidence": [
            {"id": "E1", "text": "Fan is loud"}
        ],
        "possible_causes": [
            {
                "id": "C1",
                "cause": "Valid cause linking to E1",
                "evidence_ids": ["E1"],
                "confidence": "high",
                "verification": "Check fan speed"
            },
            {
                "id": "C2",
                "cause": "Hallucinated cause citing non-existent E99",
                "evidence_ids": ["E99"],
                "confidence": "low",
                "verification": "Check nothing"
            }
        ],
        "troubleshooting_steps": [
            {
                "step_number": 1,
                "action": "Clean fan",
                "rationale": "Restores airflow",
                "risk_level": "low"
            }
        ],
        "safety_warning": None,
        "follow_up_questions": []
    }

    sanitized = guardrails.sanitize(payload, "Fan is loud")
    causes = sanitized["possible_causes"]
    
    # C2 must be dropped because E99 does not exist in evidence
    cause_ids = [c["id"] for c in causes]
    assert "C1" in cause_ids
    assert "C2" not in cause_ids


def test_guardrails_triggers_safety_alert_for_swollen_battery():
    """Verify that symptoms with battery swelling trigger safety escalation."""
    payload = {
        "status": "ok",
        "symptom_summary": "Laptop trackpad lifting",
        "evidence": [{"id": "E1", "text": "battery is swollen and trackpad lifting"}],
        "possible_causes": [
            {
                "id": "C1",
                "cause": "Battery swelling",
                "evidence_ids": ["E1"],
                "confidence": "high",
                "verification": "Inspect chassis"
            }
        ],
        "troubleshooting_steps": [],
        "safety_warning": None,
        "follow_up_questions": []
    }

    sanitized = guardrails.sanitize(payload, "My laptop battery is swollen and trackpad is lifting")
    
    assert sanitized["status"] == "safety_alert"
    assert sanitized["safety_warning"] is not None
    assert "SAFETY ALERT" in sanitized["safety_warning"]
    assert any("technician" in step["action"].lower() for step in sanitized["troubleshooting_steps"])


def test_guardrails_enforces_needs_more_info_on_vague_input():
    """Verify that vague inputs default to needs_more_info with follow-up questions."""
    payload = {
        "status": "ok",
        "symptom_summary": "Computer won't turn on",
        "evidence": [{"id": "E1", "text": "it won't turn on"}],
        "possible_causes": [
            {
                "id": "C1",
                "cause": "Power issue",
                "evidence_ids": ["E1"],
                "confidence": "low",
                "verification": "Check cord"
            }
        ],
        "troubleshooting_steps": [],
        "safety_warning": None,
        "follow_up_questions": []
    }

    sanitized = guardrails.sanitize(payload, "it won't turn on")
    assert sanitized["status"] == "needs_more_info"
    assert len(sanitized["follow_up_questions"]) >= 1
