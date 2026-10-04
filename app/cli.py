#!/usr/bin/env python3
"""Kyūmei (究明) - Command Line Hardware Diagnostic Tool."""

import argparse
import asyncio
import json
import sys

# Ensure UTF-8 output on Windows terminals
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

import time
from pathlib import Path

# Add project root to path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.config import settings
from app.pipeline import pipeline
from app.ollama_client import OllamaClient


def format_report_for_terminal(report: dict, elapsed: float) -> str:
    status = report.get("status", "ok")
    summary = report.get("symptom_summary", "")
    evidence = report.get("evidence", [])
    causes = report.get("possible_causes", [])
    steps = report.get("troubleshooting_steps", [])
    safety = report.get("safety_warning")
    follow_up = report.get("follow_up_questions", [])

    lines = []
    lines.append("\n" + "=" * 70)
    lines.append("  KYŪMEI (究明) - HARDWARE DIAGNOSTIC REPORT")
    lines.append(f"  Model: {settings.kyumei_model} | Runtime: {elapsed:.2f}s (Local Offline GPU)")
    lines.append("=" * 70)

    # Status Pill
    lines.append(f"\n[STATUS] : {status.upper()}")

    # Safety Warning
    if safety:
        lines.append("\n" + "!" * 70)
        lines.append(">>> SAFETY ALERT <<<")
        lines.append(f"    {safety}")
        lines.append("!" * 70)

    # Needs more info questions
    if status == "needs_more_info" and follow_up:
        lines.append("\n[DIAGNOSTIC QUESTIONS NEEDED]:")
        for i, q in enumerate(follow_up, 1):
            lines.append(f"  {i}. {q}")

    # Summary
    lines.append(f"\n[SYMPTOM SUMMARY]:\n  {summary}")

    # Evidence
    lines.append(f"\n[VERIFIED EVIDENCE] ({len(evidence)} items):")
    for ev in evidence:
        lines.append(f"  [{ev.get('id')}] \"{ev.get('text')}\"")

    # Causes
    lines.append(f"\n[GROUNDED CAUSES] ({len(causes)} identified):")
    for cause in causes:
        eids = ", ".join(cause.get("evidence_ids", []))
        conf = cause.get("confidence", "medium").upper()
        lines.append(f"  [{cause.get('id')}] {cause.get('cause')}")
        lines.append(f"       Supporting Evidence : [{eids}] | Confidence: {conf}")
        lines.append(f"       Verification        : {cause.get('verification')}")

    # Steps
    lines.append(f"\n[SAFEST-FIRST REMEDIATION SEQUENCE]:")
    for step in steps:
        risk = step.get("risk_level", "none").upper()
        lines.append(f"  Step {step.get('step_number')}: {step.get('action')}")
        lines.append(f"          Rationale : {step.get('rationale')}")
        lines.append(f"          Risk      : {risk}")

    lines.append("\n" + "=" * 70 + "\n")
    return "\n".join(lines)


async def main():
    parser = argparse.ArgumentParser(
        description="Kyūmei - Local Open-Weight Hardware Diagnostic CLI"
    )
    parser.add_argument("symptom", nargs="?", help="Plain-text symptom description")
    parser.add_argument("-f", "--file", help="Path to HWiNFO log or symptom text file")
    parser.add_argument("-m", "--mode", choices=["single", "staged"], default="single", help="Inference mode")
    parser.add_argument("--json", action="store_true", help="Output raw JSON instead of formatted text")
    args = parser.parse_args()

    symptom_text = ""
    if args.file:
        file_path = Path(args.file)
        if not file_path.exists():
            print(f"[ERROR] File not found: {file_path}", file=sys.stderr)
            sys.exit(1)
        symptom_text = file_path.read_text(encoding="utf-8")
    elif args.symptom:
        symptom_text = args.symptom
    else:
        parser.print_help()
        sys.exit(1)

    print(f"Connecting to local Ollama ({settings.kyumei_model})...", file=sys.stderr)
    client = OllamaClient()
    conn = await client.check_connection()
    if not conn["connected"]:
        print(f"[ERROR] Ollama is not running: {conn['error']}", file=sys.stderr)
        sys.exit(1)

    print(f"Running Kyūmei diagnostic reasoning (mode: {args.mode})...", file=sys.stderr)
    start = time.perf_counter()
    report = await pipeline.run(symptom_text, mode=args.mode)
    elapsed = time.perf_counter() - start

    if args.json:
        report["_telemetry"] = {"duration_sec": round(elapsed, 2), "model": settings.kyumei_model}
        print(json.dumps(report, indent=2))
    else:
        print(format_report_for_terminal(report, elapsed))


if __name__ == "__main__":
    asyncio.run(main())
