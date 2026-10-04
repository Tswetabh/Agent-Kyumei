# Worked Reference Example: Laptop Thermal Throttling

## Input Symptom
"My laptop gets scorching hot on the bottom and the fan sounds like a jet engine even when I am just browsing Wikipedia or sitting on the desktop idle. Sometimes it just shuts off suddenly after 20 minutes."

## Expected Reasoning & JSON Output
```json
{
  "status": "ok",
  "symptom_summary": "Laptop experiences extreme overheating and aggressive fan speeds during idle or light tasks, leading to sudden thermal shutdowns.",
  "evidence": [
    {
      "id": "E1",
      "text": "laptop gets scorching hot on the bottom"
    },
    {
      "id": "E2",
      "text": "fan sounds like a jet engine even when I am just browsing Wikipedia or sitting on the desktop idle"
    },
    {
      "id": "E3",
      "text": "shuts off suddenly after 20 minutes"
    }
  ],
  "possible_causes": [
    {
      "id": "C1",
      "cause": "Heatsink fins clogged with dust or lint, preventing airflow dissipation despite high fan RPM.",
      "evidence_ids": ["E1", "E2"],
      "confidence": "high",
      "verification": "Inspect exhaust vents with a flashlight to check for dust carpet obstructing the copper fin array."
    },
    {
      "id": "C2",
      "cause": "Degraded thermal paste between CPU/GPU and heat pipe assembly causing high thermal resistance.",
      "evidence_ids": ["E1", "E2", "E3"],
      "confidence": "high",
      "verification": "Monitor CPU package temperature with hardware sensors; verify temperatures jump rapidly to thermal TJMax (>95°C) within seconds of any light load."
    },
    {
      "id": "C3",
      "cause": "Thermal safety cutoff triggered by motherboard protection circuit to prevent silicon burnout.",
      "evidence_ids": ["E3"],
      "confidence": "high",
      "verification": "Check OS system event log for Kernel-Power Event ID 41 or ACPI thermal shutdown events."
    }
  ],
  "troubleshooting_steps": [
    {
      "step_number": 1,
      "action": "Elevate the laptop rear by 1 inch on a flat, hard surface to maximize air intake clearance.",
      "rationale": "Non-invasive airflow test to check if restriction is external.",
      "risk_level": "none"
    },
    {
      "step_number": 2,
      "action": "Use compressed air in short bursts into the exhaust vents while the device is powered off.",
      "rationale": "Clears loose debris without opening the chassis.",
      "risk_level": "low"
    },
    {
      "step_number": 3,
      "action": "Check background processes in Task Manager to verify no rogue service is pinning CPU cores.",
      "rationale": "Eliminates software-induced thermal loads.",
      "risk_level": "none"
    },
    {
      "step_number": 4,
      "action": "If symptoms persist, consult a technician to clean the internal cooling fan and repaste the heatsink.",
      "rationale": "Requires chassis disassembly; improper handling risks motherboard static or connector damage.",
      "risk_level": "medium"
    }
  ],
  "safety_warning": null,
  "follow_up_questions": []
}
```
