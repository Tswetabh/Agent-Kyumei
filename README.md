# Kyūmei (究明) — Local-First Hardware Diagnostic Reasoning Assistant

> **Submission for Hacktoberfest Hack Day Indore (PyData Indore × MLH)**  
> **Challenge Track:** *Best Open-Source AI Project*  
> **License:** [MIT License](LICENSE)  

---

## 1. Model & Local Runtime Specification

- **Exact Model Name:** Gemma 4 E2B (Open-Weight Model)
- **Ollama Model Tag:** `gemma4:e2b` *(configurable via `KYUMEI_MODEL` in `.env`)*
- **Model License & Download Page:**
  - Model Download / Hub: [TODO: Add official Ollama / HuggingFace model card URL]
  - Model License: [TODO: Add official Gemma terms of use / license link]
- **Execution Architecture:** 100% local, offline inference via **Ollama**. All diagnostic reasoning executes directly on the local GPU (tested on Windows 11 with NVIDIA GeForce RTX 3050 6GB VRAM, 16GB RAM) without sending prompt data or telemetry over the internet.

---

## 2. What Kyūmei Does

Kyūmei (Japanese for *investigating the truth / thorough examination*) is an open-source hardware and device diagnostic reasoning assistant. When given a messy, plain-text description of a hardware problem (e.g. *"laptop gets very hot on the bottom and fan is loud while idle"*), Kyūmei performs neuro-symbolic triage:

1. **Verbatim Evidence Extraction**: Isolates atomic facts and quotes into unique evidence IDs (`E1`, `E2`, ...).
2. **Grounded Cause Hypothesis**: Proposes mechanical and electrical failure modes. **Strict Grounding Rule:** Every cause MUST cite at least one verified evidence ID.
3. **Deterministic Guardrails**: Code-level validation drops ungrounded causes that attempt to hallucinate evidence links.
4. **Safest-First Remediation**: Sequences troubleshooting actions strictly from non-invasive software checks first to hardware disassembly last.
5. **Physical Safety Escalation**: Enforces immediate warning alerts and technician referral for lithium-ion battery swelling, burning smell, smoke, or high-voltage power supplies.
6. **Ambiguity Triage (`needs_more_info`)**: If input evidence is too thin, it avoids speculative guessing and returns 1 to 3 targeted diagnostic questions.

---

## 3. Project Structure

Kyūmei is structured according to the **Agent Skill Open Standard**:

```
kyumei/
├── LICENSE                      # MIT Open Source License
├── README.md                    # System documentation and contest disclosure
├── AI_DISCLOSURE.md             # Detailed log of AI tools vs. human authoring
├── requirements.txt             # Python dependencies
├── .env.example                 # Configuration template (Ollama host, model tag, mode)
├── skill/                       # Agent Skill Open Standard Package
│   ├── SKILL.md                 # YAML frontmatter + core diagnostic reasoning skill
│   ├── schema.json              # Formal JSON schema for diagnostic reports
│   └── references/              # Worked examples and fault taxonomy
│       ├── worked_overheating.md# Worked thermal throttling case (status: ok)
│       ├── worked_vague.md      # Worked ambiguous input case (status: needs_more_info)
│       └── fault_checklist.md   # Hardware failure taxonomy & safety protocols
├── app/                         # Application Backend and UI
│   ├── __init__.py
│   ├── config.py                # Environment configuration loader
│   ├── ollama_client.py         # Async HTTP client for Ollama API
│   ├── validator.py             # JSON Schema validator with 1-turn auto-retry
│   ├── guardrails.py            # Evidence linking verifier & safety clamps
│   ├── pipeline.py              # Dual-mode engine (Single-Pass & Staged Prompts)
│   ├── main.py                  # FastAPI server with health check & static routes
│   └── static/                  # Responsive Dark-Mode Web Interface
│       ├── index.html           # Diagnostic workspace UI
│       ├── style.css            # Dark mode design system & cross-highlighting
│       └── app.js               # Reactive DOM client & telemetry checker
├── examples/                    # 4 Real-World Diagnostic Challenge Scenarios
│   ├── 01_laptop_thermal.json   # High fan noise, sudden thermal shutdowns
│   ├── 02_gpu_artifacting.json  # Checkered screen patterns under 3D load
│   ├── 03_swollen_battery.json  # Trackpad lifting, battery safety hazard
│   └── 04_vague_input.json      # "Computer won't turn on" -> needs_more_info
└── tests/                       # Automated Test Suite
    ├── test_schema_and_guardrails.py # Pytest suite for schema & invariant checks
    └── run_examples.py          # CLI runner executing live examples through model
```

---

## 4. Quick Start & Setup

### Prerequisites
- **Windows 11 / Linux / macOS**
- **Python 3.10+** (tested on Python 3.14)
- **Ollama**: [Install Ollama](https://ollama.com/)

### Step 1: Pull the Open-Weight Model
Ensure Ollama is running, then pull the target model:
```bash
ollama pull gemma4:e2b
```

### Step 2: Set Up Virtual Environment & Dependencies
```bash
cd kyumei
python -m venv .venv

# On Windows (PowerShell):
.venv\Scripts\activate

# On Linux / macOS:
source .venv/bin/activate

pip install -r requirements.txt
```

### Step 3: Configure Environment
Copy the example environment file:
```bash
cp .env.example .env
```
Default parameters in `.env`:
- `OLLAMA_HOST=http://localhost:11434`
- `KYUMEI_MODEL=gemma4:e2b`
- `KYUMEI_PIPELINE_MODE=single` (or `staged`)
- `KYUMEI_TEMPERATURE=0.2`

### Step 4: Run the Application (Web Interface)
Start the FastAPI server:
```bash
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```
Open your browser to:
```
http://127.0.0.1:8000
```

### Alternative: Run via Standalone Terminal CLI
Kyūmei includes a headless command-line interface:
```bash
# Diagnose symptom text:
python -m app.cli "Laptop fan sounds like a jet engine and shuts down after 20 minutes"

# Diagnose directly from an HWiNFO sensor log:
python -m app.cli --file examples/hwinfo_thermal_throttle.txt

# Output raw JSON:
python -m app.cli "My computer is completely dead and won't turn on" --json
```

---

## 5. UI Walkthrough & Features

*(TODO: Insert screenshot of the Kyūmei diagnostic dashboard running locally)*

### Interactive Features:
- **Bi-Directional Cross-Highlighting**: Hover over any extracted Evidence badge (`E1`) to instantly highlight which candidate causes rely on it. Hover over any Cause (`C1`) to highlight its supporting evidence in the text.
- **Client-Side HWiNFO Log Upload**: Upload or drag-and-drop raw HWiNFO64 `.txt` logs. The browser distills sensor telemetry (temps, throttling flags, fan RPM, battery wear) 100% offline.
- **Real-Time Inference Telemetry**: Displays verifiable local inference execution time: `⚡ Inferred in 2.9s | Local GPU (Ollama)`.
- **1-Click Challenge Presets**:
  1. *Thermal Throttling at Idle*
  2. *GPU Artifacting & Display Freezing*
  3. *Trackpad Lifting / Swollen Battery Safety Hazard*
  4. *Ambiguous Won't Turn On (`needs_more_info`)*
  5. *HWiNFO64 Sensor Log Telemetry*
  6. *Can It Run: Cyberpunk 2077 (RTX 3050 6GB)*
  7. *Can It Run: DeepSeek-R1-14B Locally (Ollama)*
  8. *Rogue Process / Mining Triage: 100% GPU at Idle*
- **Click-to-Answer Follow-Up Questions**: For ambiguous symptoms, clicking any follow-up question lets you refine the diagnosis in 1 click.
- **Export Options**: One-click **Copy JSON** and **Export Report (.md)** for hardware repair tickets.

---

## 6. Testing & Validation

### Run Unit Tests (Schema & Guardrails)
```bash
python -m pytest tests/test_schema_and_guardrails.py -v
```

### Run Live Model Example Suite
Runs all benchmark test cases through the local model pipeline, validating schema conformance and evidence-linking invariants:
```bash
python tests/run_examples.py
```

---

## 7. AI Tools Used & Human Authorship Disclosure

In compliance with the Hacktoberfest Hack Day Indore guidelines and ethical transparency standards:

- **AI Tools Used:** **Google Antigravity (Gemini)** was used as an AI pair programmer to assist with scaffolding, boilerplate generation, and documentation formatting.
- **Human Authorship:** The core diagnostic reasoning axioms, Agent Skill specification (`skill/SKILL.md`), prompt engineering, deterministic guardrails architecture, safety clamping logic, test cases, and hardware evaluation on local RTX 3050 hardware were designed, implemented, and reviewed by the human author.
- A detailed file-by-file audit log is maintained in [AI_DISCLOSURE.md](AI_DISCLOSURE.md).
