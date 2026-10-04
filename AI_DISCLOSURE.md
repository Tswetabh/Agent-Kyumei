# AI Tools Usage & Disclosure Statement

This document provides a transparent, auditable disclosure of the AI tools utilized in the creation of **Kyūmei (究明)** for the Hacktoberfest Hack Day Indore (PyData Indore × MLH) hackathon.

## Summary of Roles
- **Human Author / Architect**: Project concept, diagnostic reasoning axioms, Agent Skill design, prompt engineering, safety constraint definitions, manual model evaluation on local hardware (RTX 3050), and end-to-end testing.
- **AI Assistant (Google Antigravity / Gemini)**: Assisted with scaffolding, boilerplate generation, fast prototyping, and documentation formatting as directed by the human author.

---

## Detailed File-by-File Inventory of AI-Generated Scaffolding & Code

### Phase 1: Specifications & Agent Skill
- `LICENSE`: Standard MIT license template.
- `.gitignore`: Standard Python / Windows development ignore rules.
- `.env.example`: Configuration template for local Ollama endpoints and model parameters.
- `skill/schema.json`: Formal JSON Schema draft 2020-12 representing Kyūmei's structured diagnostic report.
- `skill/SKILL.md`: Initial scaffolding of the Agent Skill markdown structure following the Agent Skill Open Standard.
- `skill/references/worked_overheating.md`: Scaffolding for few-shot worked example of thermal throttling.
- `skill/references/worked_vague.md`: Scaffolding for few-shot worked example of ambiguous input triage.
- `skill/references/fault_checklist.md`: Hardware failure taxonomy and safety risk categories.

### Phase 2: Core Diagnostic Engine & Services
- `requirements.txt`: Locked Python dependency manifest.
- `app/__init__.py`: Application package initialization.
- `app/config.py`: Pydantic-settings configuration loader for local endpoints and paths.
- `app/ollama_client.py`: Asynchronous HTTP client communicating with Ollama `/api/chat` and `/api/tags`.
- `app/validator.py`: JSON parsing and `jsonschema` validation with automated 1-turn repair prompt generation.
- `app/pipeline.py`: Orchestrator for single-pass and staged inference micro-prompts.
- `app/main.py`: FastAPI server exposing health checks, diagnostic endpoints with telemetry timing, and static file mounting.
- `app/cli.py`: Standalone terminal CLI runner for headless command-line hardware diagnosis.

### Phase 4: Deterministic Guardrails & Trust Features
- `app/guardrails.py`: Deterministic guardrails engine enforcing evidence linking, pruning hallucinated/ungrounded causes, clamping physical safety hazards, and triaging ambiguous inputs.
- `examples/01_laptop_thermal.json`: Benchmark scenario for laptop thermal throttling.
- `examples/02_gpu_artifacting.json`: Benchmark scenario for graphics memory corruption.
- `examples/03_swollen_battery.json`: Benchmark scenario for lithium-ion battery swelling safety escalation.
- `examples/04_vague_input.json`: Benchmark scenario for ambiguous input triage (`needs_more_info`).
- `examples/05_hwinfo_thermal.json`: Benchmark scenario for HWiNFO64 sensor log telemetry.
- `examples/06_game_cyberpunk.json`: Benchmark scenario for gaming system requirement & VRAM bottleneck diagnosis.
- `examples/07_ai_model_ollama.json`: Benchmark scenario for local AI model deployment & layer offload feasibility.
- `examples/08_rogue_gpu_compute.json`: Benchmark scenario for rogue process / background miner thermal triage.
- `examples/hwinfo_thermal_throttle.txt`: Sample HWiNFO64 sensor log file for file upload and parser testing.

### Phase 5: Interactive User Interface
- `app/static/index.html`: Accessible, responsive single-page diagnostic dashboard with HWiNFO log upload, telemetry badge, and Markdown report export.
- `app/static/style.css`: Curated dark-mode design system with bi-directional cause-evidence highlight glowing states, telemetry badge styles, and interactive question chips.
- `app/static/app.js`: Reactive ES6 client managing live health telemetry, 1-click test presets, client-side HWiNFO64 log parser, markdown report generation, click-to-answer follow-up flow, and dynamic hover cross-linking.

### Phase 6: Automated Testing & Verification
- `tests/test_schema_and_guardrails.py`: Pytest suite verifying schema conformance, cause pruning, safety alerts, and thin-evidence handling.
- `tests/run_examples.py`: Standalone CLI validation script running all benchmark cases through the local model pipeline.
- `README.md`: Submission documentation including model specs, setup commands, architecture, and disclosures.
