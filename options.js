// Extension settings page

const DEFAULTS = {
  serviceUrl:              'http://localhost:8084',
  referenceProfile:        '0.20-standard---cube',
  applyRules:              true,
  clampSpeeds:             true,
  preserveColorPainting:   true,
  insertSwapPauses:        false,
};

let svcUrl = DEFAULTS.serviceUrl;

// ── Helpers ──────────────────────────────────────────────────────────────────

function api(path, opts) {
  return fetch(svcUrl + path, opts);
}

function showHealth(ok) {
  const badge = document.getElementById('healthBadge');
  badge.className = 'badge ' + (ok ? 'ok' : 'err');
  badge.textContent = ok ? 'Online' : 'Offline';
}

// ── Profile section ───────────────────────────────────────────────────────────

async function loadProfiles(savedProfile) {
  const loading = document.getElementById('profilesLoading');
  const select  = document.getElementById('profileSelect');
  try {
    const resp = await api('/api/profiles');
    if (!resp.ok) throw new Error(resp.status);
    const profiles = await resp.json();
    select.innerHTML = '';
    profiles.forEach(p => {
      const opt = document.createElement('option');
      opt.value = p.id;
      opt.textContent = p.display_name || p.name || p.id;
      if (p.id === savedProfile) opt.selected = true;
      select.appendChild(opt);
    });
    loading.style.display = 'none';
    select.style.display  = 'block';
    showHealth(true);
  } catch {
    loading.textContent = 'Could not load profiles — is the service running?';
    showHealth(false);
  }
}

// ── Rules section ─────────────────────────────────────────────────────────────

async function loadRules() {
  const loading  = document.getElementById('rulesLoading');
  const list     = document.getElementById('rulesList');
  const addBtn   = document.getElementById('addRuleBtn');
  try {
    const resp = await api('/api/rules');
    if (!resp.ok) throw new Error(resp.status);
    const rules = await resp.json();
    loading.style.display = 'none';
    list.innerHTML = '';
    rules.forEach(r => list.appendChild(buildRuleItem(r)));
    addBtn.style.display = '';
  } catch {
    loading.textContent = 'Could not load rules.';
  }
}

function buildRuleItem(rule) {
  const wrap = document.createElement('div');
  wrap.className = 'rule-item';
  wrap.dataset.name = rule.name;

  const header = document.createElement('div');
  header.className = 'rule-header';
  header.innerHTML =
    `<span class="rule-name">${rule.name}</span>` +
    `<span class="rule-desc">${rule.description || ''}</span>` +
    `<label class="rule-toggle" title="Enable/disable">` +
      `<input type="checkbox" ${rule.enabled ? 'checked' : ''} data-rule="${rule.name}">` +
      `<span class="rule-toggle-track"></span>` +
    `</label>`;

  const body = document.createElement('div');
  body.className = 'rule-body';

  // Lazy-load YAML on first expand
  let loaded = false;
  header.addEventListener('click', async (e) => {
    if (e.target.closest('.rule-toggle')) return;
    body.classList.toggle('open');
    if (!loaded && body.classList.contains('open')) {
      loaded = true;
      body.textContent = 'Loading…';
      try {
        const r = await api(`/api/rules/${rule.name}`);
        const d = await r.json();
        renderRuleBody(body, rule.name, d.yaml_text);
      } catch {
        body.textContent = 'Failed to load YAML.';
      }
    }
  });

  // Toggle enable/disable
  header.querySelector('input[type=checkbox]').addEventListener('change', async (e) => {
    e.stopPropagation();
    const cb = e.target;
    try {
      // Load current YAML, flip enabled, save back
      const r    = await api(`/api/rules/${rule.name}`);
      const d    = await r.json();
      const yaml = d.yaml_text.replace(/^enabled:\s*(true|false)/m,
        `enabled: ${cb.checked}`);
      const resp = await api(`/api/rules/${rule.name}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ yaml_text: yaml }),
      });
      if (!resp.ok) throw new Error(resp.status);
    } catch {
      cb.checked = !cb.checked; // revert on failure
    }
  });

  wrap.appendChild(header);
  wrap.appendChild(body);
  return wrap;
}

function renderRuleBody(body, name, yaml) {
  body.innerHTML = '';
  const ta = document.createElement('textarea');
  ta.rows = 14;
  ta.value = yaml;
  body.appendChild(ta);

  const actions = document.createElement('div');
  actions.className = 'rule-actions';

  const saveBtn = document.createElement('button');
  saveBtn.className = 'btn-primary';
  saveBtn.textContent = 'Save';
  saveBtn.addEventListener('click', async () => {
    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving…';
    try {
      const resp = await api(`/api/rules/${name}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ yaml_text: ta.value }),
      });
      if (!resp.ok) throw new Error(await resp.text());
      saveBtn.textContent = 'Saved ✓';
    } catch (err) {
      saveBtn.textContent = '⚠ ' + err.message.slice(0, 30);
    } finally {
      setTimeout(() => { saveBtn.disabled = false; saveBtn.textContent = 'Save'; }, 2000);
    }
  });

  const delBtn = document.createElement('button');
  delBtn.className = 'btn-danger';
  delBtn.textContent = 'Delete';
  delBtn.addEventListener('click', async () => {
    if (!confirm(`Delete rule "${name}"?`)) return;
    try {
      await api(`/api/rules/${name}`, { method: 'DELETE' });
      body.closest('.rule-item').remove();
    } catch (err) {
      alert('Delete failed: ' + err.message);
    }
  });

  actions.appendChild(saveBtn);
  actions.appendChild(delBtn);
  body.appendChild(actions);
}

// ── New rule form ─────────────────────────────────────────────────────────────

document.getElementById('addRuleBtn').addEventListener('click', () => {
  document.getElementById('newRuleForm').style.display = 'block';
  document.getElementById('addRuleBtn').style.display  = 'none';
});

document.getElementById('cancelNewRule').addEventListener('click', () => {
  document.getElementById('newRuleForm').style.display = 'none';
  document.getElementById('addRuleBtn').style.display  = '';
  document.getElementById('newRuleName').value  = '';
  document.getElementById('newRuleYaml').value  = '';
});

document.getElementById('saveNewRule').addEventListener('click', async () => {
  const yaml = document.getElementById('newRuleYaml').value.trim();
  if (!yaml) { alert('Rule YAML cannot be empty.'); return; }
  const btn = document.getElementById('saveNewRule');
  btn.disabled = true; btn.textContent = 'Saving…';
  try {
    const resp = await api('/api/rules', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ yaml_text: yaml }),
    });
    if (!resp.ok) throw new Error(await resp.text());
    document.getElementById('cancelNewRule').click();
    await loadRules();
  } catch (err) {
    alert('Failed to save rule: ' + err.message);
  } finally {
    btn.disabled = false; btn.textContent = 'Save Rule';
  }
});

// ── Health check ──────────────────────────────────────────────────────────────

document.getElementById('checkHealth').addEventListener('click', async () => {
  svcUrl = document.getElementById('serviceUrl').value.trim().replace(/\/$/, '');
  try {
    const r = await fetch(svcUrl + '/api/health');
    showHealth(r.ok);
    if (r.ok) { await loadProfiles(document.getElementById('profileSelect').value); await loadRules(); }
  } catch { showHealth(false); }
});

// ── Save settings ─────────────────────────────────────────────────────────────

document.getElementById('saveBtn').addEventListener('click', () => {
  const settings = {
    serviceUrl:            document.getElementById('serviceUrl').value.trim().replace(/\/$/, ''),
    referenceProfile:      document.getElementById('profileSelect').value,
    applyRules:            document.getElementById('applyRules').checked,
    clampSpeeds:           document.getElementById('clampSpeeds').checked,
    preserveColorPainting: document.getElementById('preserveColorPainting').checked,
    insertSwapPauses:      document.getElementById('insertSwapPauses').checked,
  };
  chrome.storage.sync.set(settings, () => {
    const status = document.getElementById('saveStatus');
    status.textContent = 'Saved ✓';
    setTimeout(() => { status.textContent = ''; }, 2000);
  });
});

// ── Init ──────────────────────────────────────────────────────────────────────

chrome.storage.sync.get(DEFAULTS, async (s) => {
  svcUrl = s.serviceUrl;
  document.getElementById('serviceUrl').value          = s.serviceUrl;
  document.getElementById('applyRules').checked        = s.applyRules;
  document.getElementById('clampSpeeds').checked       = s.clampSpeeds;
  document.getElementById('preserveColorPainting').checked = s.preserveColorPainting;
  document.getElementById('insertSwapPauses').checked  = s.insertSwapPauses;

  await loadProfiles(s.referenceProfile);
  await loadRules();
});
