import json
import re
from pathlib import Path
from typing import Any, Dict, Optional, Tuple
import jsonschema
from jsonschema import Draft202012Validator

from app.config import settings


class SchemaValidator:
    def __init__(self, schema_path: Optional[Path] = None):
        self.schema_path = schema_path or settings.schema_path
        self.schema = self._load_schema()
        self.validator = Draft202012Validator(self.schema)

    def _load_schema(self) -> Dict[str, Any]:
        if not self.schema_path.exists():
            raise FileNotFoundError(f"Schema not found at {self.schema_path}")
        with open(self.schema_path, "r", encoding="utf-8") as f:
            return json.load(f)

    def extract_json(self, raw_text: str) -> Tuple[Optional[Dict[str, Any]], Optional[str]]:
        """Extract and parse JSON object from model output, handling optional markdown blocks."""
        cleaned = raw_text.strip()
        
        # Strip ```json ... ``` or ``` ... ``` wrappers if present
        if cleaned.startswith("```"):
            cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned, flags=re.IGNORECASE)
            cleaned = re.sub(r"\s*```$", "", cleaned)
            cleaned = cleaned.strip()

        # If there are surrounding characters, locate the outermost { ... }
        if not cleaned.startswith("{"):
            start = cleaned.find("{")
            end = cleaned.rfind("}")
            if start != -1 and end != -1 and end > start:
                cleaned = cleaned[start : end + 1]

        try:
            data = json.loads(cleaned)
            if not isinstance(data, dict):
                return None, f"Expected a JSON object (dict), but got {type(data).__name__}."
            return data, None
        except json.JSONDecodeError as exc:
            return None, f"Invalid JSON syntax at line {exc.lineno}, col {exc.colno}: {exc.msg}"

    def validate(self, raw_text: str) -> Tuple[bool, Optional[Dict[str, Any]], Optional[str]]:
        """Validate model output against schema.json.
        
        Returns:
            (is_valid, parsed_data, error_message)
        """
        data, parse_err = self.extract_json(raw_text)
        if parse_err:
            return False, None, parse_err

        errors = sorted(self.validator.iter_errors(data), key=lambda e: e.path)
        if not errors:
            return True, data, None

        # Build concise human- and model-readable error description
        error_lines = []
        for err in errors[:3]:  # Limit to top 3 errors to keep prompt short for small model
            loc = " -> ".join([str(p) for p in err.path]) if err.path else "root"
            error_lines.append(f"At '{loc}': {err.message}")

        combined_error = "; ".join(error_lines)
        return False, data, combined_error

    def build_retry_prompt(self, validation_error: str) -> str:
        """Create a targeted repair prompt informing the model of its exact schema violation."""
        return (
            f"Your previous response failed JSON schema validation with the following error:\n"
            f"ERROR: {validation_error}\n\n"
            f"Please correct this error and return the full, valid JSON object strictly complying with the schema. "
            f"Output JSON ONLY without commentary or markdown code blocks."
        )


validator = SchemaValidator()
