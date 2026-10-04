# Worked Reference Example: Ambiguous / Vague Symptom

## Input Symptom
"My computer is dead and won't turn on."

## Expected Reasoning & JSON Output
```json
{
  "status": "needs_more_info",
  "symptom_summary": "User reports the computer will not power on, but provides insufficient detail regarding power indicators, lights, or sounds.",
  "evidence": [
    {
      "id": "E1",
      "text": "computer is dead and won't turn on"
    }
  ],
  "possible_causes": [
    {
      "id": "C1",
      "cause": "No AC electrical power reaching internal power delivery components (dead outlet, faulty cable, or failed power supply).",
      "evidence_ids": ["E1"],
      "confidence": "low",
      "verification": "Test wall outlet with a known working lamp and verify if charging/power LED illuminates on the device."
    }
  ],
  "troubleshooting_steps": [
    {
      "step_number": 1,
      "action": "Verify the power cable is firmly seated into both the wall outlet and the device/power supply.",
      "rationale": "Verifies basic physical connection safely.",
      "risk_level": "none"
    },
    {
      "step_number": 2,
      "action": "Check if any LED indicator lights turn on when the power button is pressed.",
      "rationale": "Distinguishes between a complete power loss vs. a display or POST failure.",
      "risk_level": "none"
    }
  ],
  "safety_warning": null,
  "follow_up_questions": [
    "When you press the power button, do any lights (LEDs) turn on or blink, even momentarily?",
    "Do you hear any sounds such as fans spinning, beeps, or clicking drives?",
    "Is this a desktop PC or a laptop, and are you using the original power adapter?"
  ]
}
```
