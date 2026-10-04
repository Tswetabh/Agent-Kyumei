# Hardware Fault Checklist & Safety Protocols

This reference checklist assists Kyūmei in categorizing faults and enforcing strict safety triage.

## 1. Safety Critical Zones (Immediate Technician Referral)
- **Swollen or Distended Battery**:
  - Symptoms: Trackpad bowing upward, case seams splitting, battery bulging.
  - Risk: Lithium-ion thermal runaway, puncture fire hazard.
  - Action: Immediately power off, do NOT charge, do NOT puncture, transport in fire-resistant container to a qualified repair depot.
- **Burning Odor, Smoke, or Visible Sparking**:
  - Symptoms: Acrid ozone or burnt plastic smell, visible smoke, power trip.
  - Risk: Electrical fire, short-circuit, component destruction.
  - Action: Disconnect AC mains immediately. Do not attempt to turn on.
- **Internal Mains Power Supplies (PSU)**:
  - High-voltage capacitors retain lethal voltages (200V–400V) even when unplugged.
  - Rule: Never advise users to open, probe, or disassemble a power supply unit.

## 2. Thermal & Cooling Subsystems
- **Symptoms**: Loud fans at idle, thermal shutdown under load, scorching chassis, stuttering/throttling.
- **Common Mechanisms**:
  - Air intake / exhaust blockage (dust buildup).
  - Dry or pumped-out thermal interface material (TIM).
  - Fan bearing degradation (rattling/grinding noise).
  - Heatpipe vapor chamber permeation/leakage.
- **Safe Verification**: Inspect vents with light, check hardware monitor temps (HWiNFO / lm-sensors).

## 3. Power & Battery Subsystems
- **Symptoms**: "Plugged in, not charging", battery draining while plugged in, abrupt shutdown when disconnected from AC.
- **Common Mechanisms**:
  - DC-in jack pin wear or cold solder joint.
  - Degraded battery cells (high internal resistance).
  - Power brick wattage degradation or wrong voltage rating.
  - Embedded Controller (EC) state glitch.
- **Safe Verification**: Check battery health report (e.g., `powercfg /batteryreport`), test with known-good OEM charger.

## 4. Display & Graphics Subsystems
- **Symptoms**: Artifacting (checkerboard, pink lines), black screen with fan spin, backlight bleed, flickering on hinge tilt.
- **Common Mechanisms**:
  - VRAM memory channel degradation (checkerboard patterns).
  - eDP ribbon cable pinching in hinge.
  - Display inverter / backlight LED driver failure.
  - Driver TDR (Timeout Detection and Recovery) crash.
- **Safe Verification**: Connect external monitor via HDMI/DisplayPort to isolate internal panel vs. GPU silicon.

## 5. Storage & Memory Subsystems
- **Symptoms**: BSOD `CRITICAL_PROCESS_DIED`, clicking sounds, boot loop into BIOS, filesystem read-only.
- **Common Mechanisms**:
  - HDD head crash or degraded magnetic sectors.
  - NVMe SSD thermal throttling or controller firmware lock.
  - RAM contact corrosion or marginal sub-timings.
- **Safe Verification**: Check SMART telemetry (CrystalDiskInfo / smartctl), run Windows Memory Diagnostic or MemTest86.
