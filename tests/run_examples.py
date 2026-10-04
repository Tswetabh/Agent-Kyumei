import asyncio
import json
import sys
from pathlib import Path

# Add project root to sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.pipeline import pipeline
from app.validator import validator
from app.config import settings


async def run_and_verify_all():
    examples_dir = settings.examples_dir
    files = sorted(examples_dir.glob("*.json"))
    if not files:
        print("[ERROR] No example files found in examples/")
        sys.exit(1)

    print(f"\n====================================================================")
    print(f" Kyumei Diagnostics Verification Suite")
    print(f" Model: {settings.kyumei_model} | Mode: {settings.kyumei_pipeline_mode}")
    print(f"====================================================================\n")

    passed_count = 0
    total_count = len(files)

    for ex_path in files:
        with open(ex_path, "r", encoding="utf-8") as f:
            data = json.load(f)

        title = data.get("title", ex_path.stem)
        symptom = data.get("symptom", "")
        print(f"--> Testing Case: {title}")
        print(f"    Symptom: \"{symptom[:75]}...\"")

        try:
            result = await pipeline.run(symptom)
        except Exception as e:
            print(f"    [FAIL] Pipeline execution threw exception: {e}")
            continue

        # 1. Schema Validation
        is_valid, _, err = validator.validate(json.dumps(result))
        if not is_valid:
            print(f"    [FAIL] Schema validation failed: {err}")
            continue
        print(f"    [PASS] Schema validation passed")

        # 2. Grounding Invariant: Every cause must cite valid evidence ID
        evidence_ids = {e["id"] for e in result.get("evidence", []) if "id" in e}
        causes = result.get("possible_causes", [])
        grounding_ok = True
        for cause in causes:
            c_eids = cause.get("evidence_ids", [])
            if not c_eids or not all(eid in evidence_ids for eid in c_eids):
                print(f"    [FAIL] Cause {cause.get('id')} has invalid evidence links: {c_eids} (Valid: {evidence_ids})")
                grounding_ok = False
                break
        
        if not grounding_ok:
            continue
        print(f"    [PASS] Evidence-to-cause grounding invariant verified ({len(causes)} causes verified)")

        # 3. Status and Safety Check
        status = result.get("status")
        print(f"    [INFO] Result status: '{status}'")
        if "swollen" in symptom.lower() and status != "safety_alert":
            print(f"    [WARN] Swollen battery should ideally trigger 'safety_alert' status")
        elif "dead" in symptom.lower() and status not in ("needs_more_info", "ok"):
            print(f"    [WARN] Vague symptom produced unexpected status: {status}")

        print(f"    [SUCCESS] Case passed all checks!\n")
        passed_count += 1

    print(f"====================================================================")
    print(f" Results: {passed_count}/{total_count} cases passed validation checks")
    print(f"====================================================================\n")
    
    if passed_count < total_count:
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(run_and_verify_all())
