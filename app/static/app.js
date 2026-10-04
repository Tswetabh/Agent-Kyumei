// Kyūmei (究明) Hardware Diagnostics Client
document.addEventListener('DOMContentLoaded', () => {
  // Navigation & Tabs
  const tabButtons = document.querySelectorAll('.tab-btn');
  const tabPanes = document.querySelectorAll('.tab-pane');

  // Telemetry & Status
  const statusDot = document.getElementById('status-dot');
  const statusText = document.getElementById('status-text');
  const modelNameElem = document.getElementById('model-name');
  const pipelineModeBadge = document.getElementById('pipeline-mode-badge');

  // Inputs & Actions
  const symptomInput = document.getElementById('symptom-input');
  const modeSelect = document.getElementById('mode-select');
  const diagnoseBtn = document.getElementById('diagnose-btn');
  const btnSpinner = document.getElementById('btn-spinner');
  const btnLabel = document.getElementById('btn-label');
  const clearBtn = document.getElementById('clear-btn');
  const copyJsonBtn = document.getElementById('copy-json-btn');
  const exportMdBtn = document.getElementById('export-md-btn');

  // HWiNFO Elements
  const dropzone = document.getElementById('dropzone');
  const hwinfoFileInput = document.getElementById('hwinfo-file-input');
  const browseHwinfoBtn = document.getElementById('browse-hwinfo-btn');
  const loadSampleHwinfoBtn = document.getElementById('load-sample-hwinfo-btn');
  const fileStatusBadge = document.getElementById('file-status-badge');
  const metricsGrid = document.getElementById('metrics-grid');
  const mCpuTemp = document.getElementById('m-cpu-temp');
  const mCpuThrottling = document.getElementById('m-cpu-throttling');
  const mFans = document.getElementById('m-fans');
  const mGpuTemp = document.getElementById('m-gpu-temp');
  const mGpuHotspot = document.getElementById('m-gpu-hotspot');
  const mBatteryWear = document.getElementById('m-battery-wear');

  // Workload Builder Elements
  const wlTarget = document.getElementById('wl-target');
  const wlSettings = document.getElementById('wl-settings');
  const wlHardware = document.getElementById('wl-hardware');

  // Results elements
  const resultsCard = document.getElementById('results-card');
  const statusPill = document.getElementById('status-pill');
  const inferenceTelemetryBadge = document.getElementById('inference-telemetry-badge');
  const safetyBanner = document.getElementById('safety-alert-banner');
  const safetyAlertText = document.getElementById('safety-alert-text');
  const needsInfoBanner = document.getElementById('needs-info-banner');
  const followUpList = document.getElementById('follow-up-list');
  const symptomSummaryElem = document.getElementById('symptom-summary');
  const evidenceContainer = document.getElementById('evidence-container');
  const causesContainer = document.getElementById('causes-container');
  const stepsContainer = document.getElementById('steps-container');

  let currentReport = null;

  // 1. Health Check
  async function checkHealth() {
    try {
      const res = await fetch('/api/health');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      if (data.ollama_connected && data.model_present) {
        statusDot.className = 'status-dot online';
        statusText.textContent = 'Local Engine Online';
        modelNameElem.textContent = data.target_model;
        pipelineModeBadge.textContent = `Mode: ${data.pipeline_mode}`;
      } else if (data.status === 'cloud_showcase' || !data.ollama_connected) {
        statusDot.className = 'status-dot online';
        statusText.textContent = 'Cloud Showcase';
        modelNameElem.textContent = data.target_model || 'gemma4:e2b (Cloud Demo)';
        pipelineModeBadge.textContent = '⚡ Preset Replay Ready';
      } else {
        statusDot.className = 'status-dot offline';
        statusText.textContent = 'Ollama Offline';
      }
    } catch (err) {
      statusDot.className = 'status-dot online';
      statusText.textContent = 'Cloud Showcase';
      modelNameElem.textContent = 'gemma4:e2b (Cloud Demo)';
    }
  }

  // 2. Tab Navigation
  tabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const targetTab = btn.dataset.tab;

      tabButtons.forEach(b => b.classList.remove('active'));
      tabPanes.forEach(p => p.classList.remove('active'));

      btn.classList.add('active');
      const pane = document.getElementById(targetTab);
      if (pane) pane.classList.add('active');
    });
  });

  // 3. Preset Scenarios Dictionary
  const PRESET_SCENARIOS = {
    thermal_laptop: "Laptop gets very hot on the bottom and fan is loud while idle, shutting down abruptly after 20 minutes of light use.",
    gpu_artifacts: "When launching 3D games, the screen displays green checkerboard artifacts and pink lines, followed by a display freeze and black screen.",
    swollen_battery: "The laptop trackpad is bowing upwards and hard to click, and the aluminum bottom seam has started separating on the front edge.",
    vague_wont_start: "My computer is completely dead and won't turn on.",
    workload_cyberpunk: "Can my laptop with RTX 3050 6GB VRAM, 16GB RAM, and Intel i7-11800H run Cyberpunk 2077 at 1080p Medium settings with DLSS Quality and no ray tracing? What performance bottlenecks should I expect?",
    workload_deepseek: "Can my laptop with RTX 3050 6GB VRAM, 16GB System RAM, and Intel i7-11800H run DeepSeek-R1-14B or Llama-3-8B locally via Ollama? What quantization and layer offload limits should I expect?",
    workload_wukong: "Can my laptop with RTX 3050 6GB VRAM and 16GB RAM run Black Myth: Wukong at 1080p Low/Medium with FSR/DLSS Frame Generation? Will 6GB VRAM cause stuttering?",
    workload_llama: "Can an RTX 3050 6GB VRAM run Llama-3.1-8B-Instruct locally in Ollama with full GPU layer offload and 8k context window?",
    rogue_gpu_idle: "My laptop fans are screaming at maximum speed and GPU usage is pinned at 99% according to Task Manager, even though I am sitting idle on the desktop with no games open after downloading a file.",
    rogue_fans_loud: "Fans ramp up to 100% RPM immediately upon booting into Windows desktop with zero foreground applications running."
  };

  // Preset button listeners across all tabs
  document.querySelectorAll('.preset-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const presetKey = chip.dataset.preset;
      if (PRESET_SCENARIOS[presetKey]) {
        symptomInput.value = PRESET_SCENARIOS[presetKey];
        symptomInput.focus();

        // Update workload builder inputs if in workload tab
        if (presetKey === 'workload_cyberpunk') {
          if (wlTarget) wlTarget.value = 'Cyberpunk 2077';
          if (wlSettings) wlSettings.value = '1080p Medium, DLSS Quality';
        } else if (presetKey === 'workload_deepseek') {
          if (wlTarget) wlTarget.value = 'DeepSeek-R1-14B (Ollama)';
          if (wlSettings) wlSettings.value = 'Q4_K_M Quantization, Layer Offload';
        }
      }
    });
  });

  // Workload Builder dynamic sync
  function syncWorkloadBuilder() {
    const target = (wlTarget?.value || '').trim();
    const settings = (wlSettings?.value || '').trim();
    const hw = (wlHardware?.value || '').trim();

    if (target || settings) {
      symptomInput.value = `Hardware Feasibility Assessment: Target Workload: "${target || 'General 3D/AI'}" at ${settings || 'Optimal settings'}. Hardware Rig: ${hw || 'RTX 3050 6GB, 16GB RAM'}. What bottlenecks, VRAM constraints, and thermal limits should I expect?`;
    }
  }

  [wlTarget, wlSettings, wlHardware].forEach(input => {
    if (input) input.addEventListener('input', syncWorkloadBuilder);
  });

  // 4. HWiNFO File Upload & Parser
  if (browseHwinfoBtn && hwinfoFileInput) {
    browseHwinfoBtn.addEventListener('click', () => hwinfoFileInput.click());
    hwinfoFileInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) handleHWiNFOFile(file);
      hwinfoFileInput.value = '';
    });
  }

  // Load sample HWiNFO button
  if (loadSampleHwinfoBtn) {
    loadSampleHwinfoBtn.addEventListener('click', async () => {
      const sampleText = `HWiNFO64 v7.62-5200 Sensor Log
Date: 2026-10-04, Time: 13:45:12
System: Intel Core i7-11800H @ 2.30GHz, 16GB RAM, NVIDIA GeForce RTX 3050 Laptop GPU

Sensor,Current,Minimum,Maximum,Average
CPU Package Temperature [°C],99.4,44.0,100.0,89.5
CPU Core Thermal Throttling [Yes/No],Yes,No,Yes,Yes
CPU Power Limit Reason (IA: PROCHOT),Yes,No,Yes,Yes
CPU Package Power [W],24.5,12.0,45.0,26.8
CPU Fan Speed [RPM],4920,0,5000,4200
GPU Temperature [°C],68.2,38.0,72.0,55.4
GPU Hot Spot Temperature [°C],79.1,45.0,83.0,66.2
GPU Fan Speed [RPM],4200,0,4500,3600
Battery Wear Level [%],12.5,12.5,12.5,12.5
Drive Temperature (NVMe SSD) [°C],56.0,35.0,59.0,48.2`;

      const parsed = parseHWiNFOLog(sampleText, 'sample_hwinfo_log.txt');
      symptomInput.value = parsed.diagnosticText;
      updateMetricsDashboard(parsed.metrics);

      fileStatusBadge.style.display = 'flex';
      fileStatusBadge.innerHTML = `<span>✓ Loaded Sample HWiNFO Log: ${escapeHtml(parsed.highlights)}</span>`;
    });
  }

  // Dropzone drag and drop
  if (dropzone) {
    dropzone.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropzone.classList.add('dragover');
    });

    dropzone.addEventListener('dragleave', () => {
      dropzone.classList.remove('dragover');
    });

    dropzone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropzone.classList.remove('dragover');
      if (e.dataTransfer.files && e.dataTransfer.files[0]) {
        handleHWiNFOFile(e.dataTransfer.files[0]);
      }
    });
  }

  function handleHWiNFOFile(file) {
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target.result;
      const parsed = parseHWiNFOLog(content, file.name);
      symptomInput.value = parsed.diagnosticText;
      updateMetricsDashboard(parsed.metrics);

      fileStatusBadge.style.display = 'flex';
      fileStatusBadge.innerHTML = `<span>✓ Parsed <strong>${escapeHtml(file.name)}</strong>: ${escapeHtml(parsed.highlights)}</span>`;
    };
    reader.onerror = () => {
      alert(`Could not read file: ${file.name}`);
    };
    reader.readAsText(file);
  }

  function parseHWiNFOLog(content, filename) {
    const lines = content.split(/\r?\n/);
    const metrics = {};
    let hardwareSummary = '';

    for (let line of lines) {
      line = line.trim();
      if (!line) continue;

      if (line.startsWith('System:') || line.startsWith('Computer:')) {
        hardwareSummary = line;
      }

      const parts = line.split(/[,\t]+/).map(p => p.trim());
      const sensorName = parts[0];

      if (/CPU Package.*\[°C\]/i.test(sensorName) || /CPU Package Temperature/i.test(sensorName)) {
        metrics.cpuPackageTemp = parts[1] || parts[parts.length - 1];
        if (parts[3]) metrics.cpuPackageMax = parts[3];
      }
      if (/Core Thermal Throttling/i.test(sensorName)) {
        metrics.throttling = parts[1] || parts[parts.length - 1];
      }
      if (/PROCHOT|Power Limit/i.test(sensorName)) {
        metrics.prochot = parts[1] || parts[parts.length - 1];
      }
      if (/CPU Fan.*\[RPM\]/i.test(sensorName) || /CPU Fan Speed/i.test(sensorName)) {
        metrics.cpuFanRpm = parts[1] || parts[parts.length - 1];
      }
      if (/GPU Fan.*\[RPM\]/i.test(sensorName) || /GPU Fan Speed/i.test(sensorName)) {
        metrics.gpuFanRpm = parts[1] || parts[parts.length - 1];
      }
      if (/GPU Temperature.*\[°C\]/i.test(sensorName)) {
        metrics.gpuTemp = parts[1] || parts[parts.length - 1];
      }
      if (/GPU Hot.*Spot.*\[°C\]/i.test(sensorName)) {
        metrics.gpuHotspot = parts[1] || parts[parts.length - 1];
      }
      if (/Battery Wear.*\[%\]/i.test(sensorName)) {
        metrics.batteryWear = parts[1] || parts[parts.length - 1];
      }
    }

    const items = [];
    if (hardwareSummary) items.push(hardwareSummary);
    if (metrics.cpuPackageTemp) items.push(`CPU Package Temperature: ${metrics.cpuPackageTemp}°C${metrics.cpuPackageMax ? ` (Max: ${metrics.cpuPackageMax}°C)` : ''}`);
    if (metrics.throttling) items.push(`CPU Core Thermal Throttling: ${metrics.throttling}`);
    if (metrics.prochot) items.push(`CPU Power Limit / PROCHOT Reason: ${metrics.prochot}`);
    if (metrics.cpuFanRpm) items.push(`CPU Fan Speed: ${metrics.cpuFanRpm} RPM`);
    if (metrics.gpuTemp) items.push(`GPU Temperature: ${metrics.gpuTemp}°C${metrics.gpuHotspot ? ` (Hotspot: ${metrics.gpuHotspot}°C)` : ''}`);
    if (metrics.batteryWear) items.push(`Battery Wear Level: ${metrics.batteryWear}%`);

    let diagnosticText = '';
    if (items.length > 0) {
      diagnosticText = `HWiNFO64 Telemetry Log Analysis [${filename}]:\n` + items.join(', ') + '.';
    } else {
      diagnosticText = `HWiNFO64 Log Content [${filename}]:\n` + content.slice(0, 800);
    }

    const highlights = [
      metrics.cpuPackageTemp ? `CPU ${metrics.cpuPackageTemp}°C` : null,
      metrics.throttling && metrics.throttling.toLowerCase() === 'yes' ? 'Thermal Throttling: YES' : null,
      metrics.cpuFanRpm ? `Fan ${metrics.cpuFanRpm} RPM` : null,
      metrics.gpuTemp ? `GPU ${metrics.gpuTemp}°C` : null
    ].filter(Boolean).join(' | ') || 'Telemetry extracted';

    return { diagnosticText, highlights, metrics };
  }

  function updateMetricsDashboard(m) {
    if (!metricsGrid) return;
    metricsGrid.style.display = 'grid';

    if (mCpuTemp) mCpuTemp.textContent = m.cpuPackageTemp ? `${m.cpuPackageTemp}°C` : '--';
    if (mCpuThrottling) {
      const isThrottling = m.throttling && m.throttling.toLowerCase() === 'yes';
      mCpuThrottling.textContent = isThrottling ? '🔥 Throttling: YES (PROCHOT)' : 'Throttling: None';
      mCpuThrottling.style.color = isThrottling ? 'var(--accent-rose)' : 'var(--accent-emerald)';
    }

    if (mFans) {
      const fanParts = [];
      if (m.cpuFanRpm) fanParts.push(`${m.cpuFanRpm} RPM (CPU)`);
      if (m.gpuFanRpm) fanParts.push(`${m.gpuFanRpm} RPM (GPU)`);
      mFans.textContent = fanParts.join(' / ') || '--';
    }

    if (mGpuTemp) mGpuTemp.textContent = m.gpuTemp ? `${m.gpuTemp}°C` : '--';
    if (mGpuHotspot) mGpuHotspot.textContent = m.gpuHotspot ? `Hotspot: ${m.gpuHotspot}°C` : 'Hotspot: --';
    if (mBatteryWear) mBatteryWear.textContent = m.batteryWear ? `${m.batteryWear}%` : '--';
  }

  // 5. Clear Input
  clearBtn.addEventListener('click', () => {
    symptomInput.value = '';
    resultsCard.style.display = 'none';
    currentReport = null;
    fileStatusBadge.style.display = 'none';
    fileStatusBadge.innerHTML = '';
    if (metricsGrid) metricsGrid.style.display = 'none';
  });

  // 6. Copy JSON Report
  copyJsonBtn.addEventListener('click', async () => {
    if (!currentReport) return;
    try {
      await navigator.clipboard.writeText(JSON.stringify(currentReport, null, 2));
      const originalText = copyJsonBtn.textContent;
      copyJsonBtn.textContent = 'Copied!';
      setTimeout(() => {
        copyJsonBtn.textContent = originalText;
      }, 2000);
    } catch (e) {
      console.error('Failed to copy JSON:', e);
    }
  });

  // 7. Export Markdown Report
  exportMdBtn.addEventListener('click', () => {
    if (!currentReport) return;
    const md = generateMarkdownReport(currentReport);
    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `kyumei_diagnostic_report_${Date.now()}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  });

  function generateMarkdownReport(report) {
    const timestamp = new Date().toLocaleString();
    let md = `# Kyūmei Hardware Diagnostic Report\n\n`;
    md += `- **Generated:** ${timestamp}\n`;
    md += `- **Diagnostic Status:** \`${(report.status || 'ok').toUpperCase()}\`\n`;
    if (report._telemetry) {
      md += `- **Inference Runtime:** ${report._telemetry.inference_time_sec}s (${report._telemetry.model} via ${report._telemetry.device})\n`;
    }
    md += `\n---\n\n`;

    if (report.safety_warning) {
      md += `> [!CAUTION]\n> **PHYSICAL SAFETY ALERT**\n> ${report.safety_warning}\n\n`;
    }

    md += `## 1. Symptom Summary\n${report.symptom_summary || 'N/A'}\n\n`;

    md += `## 2. Extracted Grounding Evidence\n\n`;
    md += `| ID | Extracted Observation / Verbatim Fact |\n|---|---|\n`;
    (report.evidence || []).forEach(e => {
      md += `| \`${e.id}\` | "${e.text}" |\n`;
    });
    md += `\n`;

    md += `## 3. Grounded Root Causes\n\n`;
    (report.possible_causes || []).forEach(c => {
      md += `### ${c.id}: ${c.cause}\n`;
      md += `- **Confidence:** \`${c.confidence}\`\n`;
      md += `- **Supporting Evidence IDs:** \`${(c.evidence_ids || []).join(', ')}\`\n`;
      md += `- **Verification Check:** ${c.verification}\n\n`;
    });

    md += `## 4. Safest-First Remediation Sequence\n\n`;
    (report.troubleshooting_steps || []).forEach(s => {
      md += `${s.step_number}. **${s.action}** *(Risk: ${s.risk_level})*\n`;
      md += `   - *Rationale:* ${s.rationale}\n`;
    });
    md += `\n`;

    if (report.follow_up_questions && report.follow_up_questions.length > 0) {
      md += `## 5. Diagnostic Follow-Up Questions\n\n`;
      report.follow_up_questions.forEach((q, i) => {
        md += `${i + 1}. ${q}\n`;
      });
      md += `\n`;
    }

    md += `---\n*Generated by Kyūmei (究明) — Local-First Open-Weight Diagnostic Assistant*\n`;
    return md;
  }

  // 8. Run Diagnosis
  diagnoseBtn.addEventListener('click', async () => {
    const symptom = symptomInput.value.trim();
    if (!symptom) {
      alert('Please enter a hardware symptom or select a preset scenario.');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch('/api/diagnose', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symptom: symptom,
          mode: modeSelect.value
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: 'Diagnostic request failed' }));
        throw new Error(errorData.detail || `Server error (${response.status})`);
      }

      const report = await response.json();
      currentReport = report;
      renderReport(report);
    } catch (err) {
      alert(`Diagnosis Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  });

  function setLoading(loading) {
    diagnoseBtn.disabled = loading;
    if (loading) {
      btnSpinner.style.display = 'inline-block';
      btnLabel.textContent = 'Analyzing Hardware...';
    } else {
      btnSpinner.style.display = 'none';
      btnLabel.textContent = 'Diagnose Hardware';
    }
  }

  // 9. Render Diagnostic Report & Bi-Directional Cross Linking
  function renderReport(report) {
    resultsCard.style.display = 'block';
    resultsCard.scrollIntoView({ behavior: 'smooth' });

    // Status pill
    statusPill.textContent = report.status || 'ok';
    statusPill.className = `status-pill status-${report.status || 'ok'}`;

    // Telemetry Badge
    if (report._telemetry && report._telemetry.inference_time_sec) {
      inferenceTelemetryBadge.style.display = 'inline-flex';
      inferenceTelemetryBadge.innerHTML = `⚡ Inferred in <strong>${report._telemetry.inference_time_sec}s</strong> | ${escapeHtml(report._telemetry.device || 'Local GPU')} (Ollama)`;
    } else {
      inferenceTelemetryBadge.style.display = 'none';
    }

    // Safety Banner
    if (report.status === 'safety_alert' && report.safety_warning) {
      safetyAlertText.textContent = report.safety_warning;
      safetyBanner.style.display = 'flex';
    } else {
      safetyBanner.style.display = 'none';
    }

    // Needs More Info Banner
    if (report.status === 'needs_more_info' && report.follow_up_questions && report.follow_up_questions.length > 0) {
      followUpList.innerHTML = '';
      report.follow_up_questions.forEach(q => {
        const li = document.createElement('li');
        li.className = 'interactive-question';
        li.title = 'Click to answer this question and refine diagnosis';
        li.innerHTML = `<span>${escapeHtml(q)}</span> <button class="btn btn-sm btn-outline btn-answer">Answer ↵</button>`;
        
        li.querySelector('.btn-answer').addEventListener('click', () => {
          const userAns = prompt(`Answer this diagnostic question:\n"${q}"`);
          if (userAns && userAns.trim()) {
            symptomInput.value = symptomInput.value.trim() + `\n[Additional Detail]: ${q} -> ${userAns.trim()}`;
            symptomInput.focus();
            symptomInput.scrollIntoView({ behavior: 'smooth' });
          }
        });

        followUpList.appendChild(li);
      });
      needsInfoBanner.style.display = 'flex';
    } else {
      needsInfoBanner.style.display = 'none';
    }

    // Summary
    symptomSummaryElem.textContent = report.symptom_summary || 'No summary available.';

    // Render Evidence
    evidenceContainer.innerHTML = '';
    const evidenceList = report.evidence || [];
    if (evidenceList.length === 0) {
      evidenceContainer.innerHTML = '<p class="hint">No specific atomic evidence extracted.</p>';
    } else {
      evidenceList.forEach(ev => {
        const card = document.createElement('div');
        card.className = 'evidence-card';
        card.dataset.evidenceId = ev.id;
        card.innerHTML = `
          <div class="evidence-header">
            <span class="evidence-badge">${ev.id}</span>
          </div>
          <p class="evidence-text">"${escapeHtml(ev.text)}"</p>
        `;

        card.addEventListener('mouseenter', () => highlightCausesForEvidence(ev.id));
        card.addEventListener('mouseleave', clearAllHighlights);

        evidenceContainer.appendChild(card);
      });
    }

    // Render Causes
    causesContainer.innerHTML = '';
    const causesList = report.possible_causes || [];
    if (causesList.length === 0) {
      causesContainer.innerHTML = '<p class="hint">No definitive root causes identified from current evidence.</p>';
    } else {
      causesList.forEach(cause => {
        const card = document.createElement('div');
        card.className = 'cause-card';
        card.dataset.causeId = cause.id;
        card.dataset.evidenceIds = (cause.evidence_ids || []).join(',');

        const evidenceTagsHtml = (cause.evidence_ids || []).map(eid => 
          `<span class="cause-evidence-tag" title="Supporting Evidence">${eid}</span>`
        ).join('');

        card.innerHTML = `
          <div class="cause-top-bar">
            <div class="cause-id-group">
              <span class="cause-badge">${cause.id}</span>
              <div class="cause-evidence-tags">${evidenceTagsHtml}</div>
            </div>
            <span class="confidence-badge confidence-${cause.confidence || 'medium'}">${cause.confidence || 'medium'} confidence</span>
          </div>
          <p class="cause-desc">${escapeHtml(cause.cause)}</p>
          <div class="cause-verification">
            <strong>Verification:</strong> ${escapeHtml(cause.verification || 'Inspect hardware components.')}
          </div>
        `;

        card.addEventListener('mouseenter', () => highlightEvidenceForCause(cause.evidence_ids || []));
        card.addEventListener('mouseleave', clearAllHighlights);

        causesContainer.appendChild(card);
      });
    }

    // Render Troubleshooting Steps (Safest First)
    stepsContainer.innerHTML = '';
    const stepsList = report.troubleshooting_steps || [];
    if (stepsList.length === 0) {
      stepsContainer.innerHTML = '<p class="hint">No troubleshooting steps suggested.</p>';
    } else {
      stepsList.forEach((step, idx) => {
        const item = document.createElement('div');
        item.className = 'step-item';
        const riskLevel = step.risk_level || 'none';

        item.innerHTML = `
          <div class="step-num-badge">${step.step_number || (idx + 1)}</div>
          <div class="step-content">
            <div class="step-action">${escapeHtml(step.action)}</div>
            <div class="step-rationale">${escapeHtml(step.rationale || '')}</div>
          </div>
          <span class="step-risk-badge risk-${riskLevel}">Risk: ${riskLevel}</span>
        `;
        stepsContainer.appendChild(item);
      });
    }
  }

  // Cross-Highlighting Handlers
  function highlightCausesForEvidence(evidenceId) {
    clearAllHighlights();
    const causeCards = document.querySelectorAll('.cause-card');
    causeCards.forEach(card => {
      const eids = (card.dataset.evidenceIds || '').split(',');
      if (eids.includes(evidenceId)) {
        card.classList.add('cause-highlighted');
      }
    });
  }

  function highlightEvidenceForCause(evidenceIds) {
    clearAllHighlights();
    const evidenceCards = document.querySelectorAll('.evidence-card');
    evidenceCards.forEach(card => {
      if (evidenceIds.includes(card.dataset.evidenceId)) {
        card.classList.add('evidence-highlighted');
      }
    });
  }

  function clearAllHighlights() {
    document.querySelectorAll('.cause-highlighted').forEach(el => el.classList.remove('cause-highlighted'));
    document.querySelectorAll('.evidence-highlighted').forEach(el => el.classList.remove('evidence-highlighted'));
  }

  function escapeHtml(str) {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // Initialize
  checkHealth();
});
