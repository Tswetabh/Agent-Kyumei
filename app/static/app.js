// Kyūmei (究明) Hardware Diagnostics Client
document.addEventListener('DOMContentLoaded', () => {
  // Elements
  const statusDot = document.getElementById('status-dot');
  const statusText = document.getElementById('status-text');
  const modelNameElem = document.getElementById('model-name');
  const pipelineModeBadge = document.getElementById('pipeline-mode-badge');
  const presetChipsContainer = document.getElementById('preset-chips');
  const symptomInput = document.getElementById('symptom-input');
  const modeSelect = document.getElementById('mode-select');
  const diagnoseBtn = document.getElementById('diagnose-btn');
  const btnSpinner = document.getElementById('btn-spinner');
  const btnLabel = document.getElementById('btn-label');
  const clearBtn = document.getElementById('clear-btn');
  const copyJsonBtn = document.getElementById('copy-json-btn');
  const uploadHwinfoBtn = document.getElementById('upload-hwinfo-btn');
  const hwinfoFileInput = document.getElementById('hwinfo-file-input');
  const fileStatusBadge = document.getElementById('file-status-badge');

  // Results elements
  const resultsCard = document.getElementById('results-card');
  const statusPill = document.getElementById('status-pill');
  const safetyBanner = document.getElementById('safety-alert-banner');
  const safetyAlertText = document.getElementById('safety-alert-text');
  const needsInfoBanner = document.getElementById('needs-info-banner');
  const followUpList = document.getElementById('follow-up-list');
  const symptomSummaryElem = document.getElementById('symptom-summary');
  const evidenceContainer = document.getElementById('evidence-container');
  const causesContainer = document.getElementById('causes-container');
  const stepsContainer = document.getElementById('steps-container');

  let currentReport = null;

  // 1. Initial Health Check
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
      } else if (data.ollama_connected) {
        statusDot.className = 'status-dot online';
        statusText.textContent = `Model '${data.target_model}' missing`;
        modelNameElem.textContent = data.target_model;
      } else {
        statusDot.className = 'status-dot offline';
        statusText.textContent = 'Ollama Offline';
      }
    } catch (err) {
      statusDot.className = 'status-dot offline';
      statusText.textContent = 'Backend Offline';
    }
  }

  // 2. Load Preset Examples
  async function loadPresets() {
    try {
      const res = await fetch('/api/examples');
      if (!res.ok) return;
      const examples = await res.json();
      
      presetChipsContainer.innerHTML = '';
      examples.forEach(ex => {
        const chip = document.createElement('button');
        chip.className = 'preset-chip';
        chip.textContent = ex.title;
        chip.title = ex.symptom;
        chip.addEventListener('click', () => {
          symptomInput.value = ex.symptom;
          symptomInput.focus();
        });
        presetChipsContainer.appendChild(chip);
      });
    } catch (e) {
      console.warn('Could not load presets:', e);
    }
  }

  // 3. Clear Input
  clearBtn.addEventListener('click', () => {
    symptomInput.value = '';
    resultsCard.style.display = 'none';
    currentReport = null;
    fileStatusBadge.style.display = 'none';
    fileStatusBadge.innerHTML = '';
  });

  // 3b. HWiNFO File Upload & Parser
  uploadHwinfoBtn.addEventListener('click', () => {
    hwinfoFileInput.click();
  });

  hwinfoFileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    handleHWiNFOFile(file);
    hwinfoFileInput.value = '';
  });

  // Support drag-and-drop on the textarea
  symptomInput.addEventListener('dragover', (e) => {
    e.preventDefault();
    symptomInput.style.borderColor = 'var(--accent-cyan)';
  });

  symptomInput.addEventListener('dragleave', () => {
    symptomInput.style.borderColor = '';
  });

  symptomInput.addEventListener('drop', (e) => {
    e.preventDefault();
    symptomInput.style.borderColor = '';
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleHWiNFOFile(e.dataTransfer.files[0]);
    }
  });

  function handleHWiNFOFile(file) {
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target.result;
      const parsed = parseHWiNFOLog(content, file.name);
      symptomInput.value = parsed.diagnosticText;
      symptomInput.focus();

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

      // Check CSV or comma/tab separated
      const parts = line.split(/[,\t]+/).map(p => p.trim());
      const sensorName = parts[0];

      // CPU Temp
      if (/CPU Package.*\[°C\]/i.test(sensorName) || /CPU Package Temperature/i.test(sensorName)) {
        metrics.cpuPackageTemp = parts[1] || parts[parts.length - 1];
        if (parts[3]) metrics.cpuPackageMax = parts[3];
      }
      // Core Thermal Throttling
      if (/Core Thermal Throttling/i.test(sensorName)) {
        metrics.throttling = parts[1] || parts[parts.length - 1];
      }
      // PROCHOT / Power limit
      if (/PROCHOT|Power Limit/i.test(sensorName)) {
        metrics.prochot = parts[1] || parts[parts.length - 1];
      }
      // CPU Fan
      if (/CPU Fan.*\[RPM\]/i.test(sensorName) || /CPU Fan Speed/i.test(sensorName)) {
        metrics.cpuFanRpm = parts[1] || parts[parts.length - 1];
      }
      // GPU Temp
      if (/GPU Temperature.*\[°C\]/i.test(sensorName)) {
        metrics.gpuTemp = parts[1] || parts[parts.length - 1];
      }
      // GPU Hot Spot
      if (/GPU Hot.*Spot.*\[°C\]/i.test(sensorName)) {
        metrics.gpuHotspot = parts[1] || parts[parts.length - 1];
      }
      // Battery Wear
      if (/Battery Wear.*\[%\]/i.test(sensorName)) {
        metrics.batteryWear = parts[1] || parts[parts.length - 1];
      }
      // Drive Temp
      if (/Drive Temperature.*\[°C\]/i.test(sensorName)) {
        metrics.driveTemp = parts[1] || parts[parts.length - 1];
      }
    }

    // Build concise natural-language telemetry description for Kyūmei LLM
    const items = [];
    if (hardwareSummary) items.push(hardwareSummary);
    if (metrics.cpuPackageTemp) items.push(`CPU Package Temperature: ${metrics.cpuPackageTemp}°C${metrics.cpuPackageMax ? ` (Max: ${metrics.cpuPackageMax}°C)` : ''}`);
    if (metrics.throttling) items.push(`CPU Core Thermal Throttling: ${metrics.throttling}`);
    if (metrics.prochot) items.push(`CPU Power Limit / PROCHOT Reason: ${metrics.prochot}`);
    if (metrics.cpuFanRpm) items.push(`CPU Fan Speed: ${metrics.cpuFanRpm} RPM`);
    if (metrics.gpuTemp) items.push(`GPU Temperature: ${metrics.gpuTemp}°C${metrics.gpuHotspot ? ` (Hotspot: ${metrics.gpuHotspot}°C)` : ''}`);
    if (metrics.batteryWear) items.push(`Battery Wear Level: ${metrics.batteryWear}%`);
    if (metrics.driveTemp) items.push(`Storage Drive Temp: ${metrics.driveTemp}°C`);

    let diagnosticText = '';
    if (items.length > 0) {
      diagnosticText = `HWiNFO64 Telemetry Log Analysis [${filename}]:\n` + items.join(', ') + '.';
    } else {
      // Fallback: take first 800 characters of file
      diagnosticText = `HWiNFO64 Log Content [${filename}]:\n` + content.slice(0, 800);
    }

    const highlights = [
      metrics.cpuPackageTemp ? `CPU ${metrics.cpuPackageTemp}°C` : null,
      metrics.throttling && metrics.throttling.toLowerCase() === 'yes' ? 'Thermal Throttling: YES' : null,
      metrics.cpuFanRpm ? `Fan ${metrics.cpuFanRpm} RPM` : null,
      metrics.gpuTemp ? `GPU ${metrics.gpuTemp}°C` : null
    ].filter(Boolean).join(' | ') || 'Telemetry extracted';

    return { diagnosticText, highlights };
  }

  // 4. Copy JSON Report
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

  // 5. Run Diagnosis
  diagnoseBtn.addEventListener('click', async () => {
    const symptom = symptomInput.value.trim();
    if (!symptom) {
      alert('Please enter a hardware symptom description.');
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

  // 6. Render Diagnostic Report & Bi-Directional Cross Linking
  function renderReport(report) {
    resultsCard.style.display = 'block';
    resultsCard.scrollIntoView({ behavior: 'smooth' });

    // Status pill
    statusPill.textContent = report.status || 'ok';
    statusPill.className = `status-pill status-${report.status || 'ok'}`;

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
        li.textContent = q;
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

        // Cross-Highlighting Event Listeners
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

        // Cross-Highlighting Event Listeners
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
  loadPresets();
});
