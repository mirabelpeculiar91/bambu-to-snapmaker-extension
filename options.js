// Extension settings page — in-browser conversion (no external service required)

const DEFAULTS = {
  profileId:             '0.20mm-standard',
  applyRules:            true,
  clampSpeeds:           true,
  preserveColorPainting: true,
  insertSwapPauses:      false,
  filamentMap:           null,
};

const BUNDLED_FILAMENT_MAP = {
  'TPU':     'Generic TPU',
  'ABS':     'Generic ABS',
  'PETG-HF': 'Snapmaker PETG HF',
  'PLA':     'Snapmaker PLA SnapSpeed @U1',
};

// ── Profile section ───────────────────────────────────────────────────────────

async function loadProfiles(savedProfileId) {
  const loading = document.getElementById('profilesLoading');
  const select  = document.getElementById('profileId');
  try {
    const profiles = await fetch(chrome.runtime.getURL('assets/profiles.json')).then(r => r.json());
    select.innerHTML = '';
    profiles.forEach(p => {
      const opt = document.createElement('option');
      opt.value       = p.id;
      opt.textContent = p.display;
      if (p.id === savedProfileId) opt.selected = true;
      select.appendChild(opt);
    });
    // If saved profile wasn't in the list, select the first one
    if (!select.value && profiles.length) select.value = profiles[0].id;
    loading.style.display = 'none';
    select.style.display  = 'block';
  } catch (err) {
    loading.textContent = 'Could not load profiles.';
    console.error('[U1 options] profile load failed:', err);
  }
}

// ── Rules section ─────────────────────────────────────────────────────────────

function describeMatch(match) {
  if (!match) return '';
  const parts = [];
  if (match.filament_type)   parts.push(match.filament_type);
  if (match.filament_vendor) parts.push(match.filament_vendor);
  if (match.filament_settings_id_contains) parts.push(`"${match.filament_settings_id_contains}"`);
  return parts.join(' · ');
}

async function loadRules(savedRuleEnabled) {
  const list = document.getElementById('rulesList');
  list.innerHTML = '';
  try {
    const rules = await fetch(chrome.runtime.getURL('assets/rules.json')).then(r => r.json());
    rules.forEach(rule => {
      const enabled = rule.name in savedRuleEnabled ? savedRuleEnabled[rule.name] : rule.enabled;

      const item = document.createElement('div');
      item.className = 'rule-item';

      const header = document.createElement('div');
      header.className = 'rule-header';
      header.innerHTML =
        `<span class="rule-name">${rule.name}</span>` +
        `<span class="rule-desc">${rule.description || ''}</span>` +
        `<span class="rule-match">${describeMatch(rule.match)}</span>` +
        `<label class="rule-toggle" title="Enable/disable rule">` +
          `<input type="checkbox" data-rule="${rule.name}" ${enabled ? 'checked' : ''}>` +
          `<span class="rule-toggle-track"></span>` +
        `</label>`;

      item.appendChild(header);
      list.appendChild(item);
    });
  } catch (err) {
    list.textContent = 'Could not load rules.';
    console.error('[U1 options] rules load failed:', err);
  }
}

function readRuleEnabledState() {
  const state = {};
  document.querySelectorAll('#rulesList input[data-rule]').forEach(cb => {
    state[cb.dataset.rule] = cb.checked;
  });
  return state;
}

// ── Filament mapping table ────────────────────────────────────────────────────

function escAttr(s) {
  return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

function renderMappingRow(type, profile) {
  const tr = document.createElement('tr');
  tr.innerHTML =
    `<td><input type="text" class="map-type"    value="${escAttr(type)}"    placeholder="e.g. PETG"></td>` +
    `<td><input type="text" class="map-profile" value="${escAttr(profile)}" placeholder="e.g. Snapmaker PETG HF"></td>` +
    `<td style="text-align:center"><button class="btn-danger btn-sm" title="Remove row">✕</button></td>`;
  tr.querySelector('button').addEventListener('click', () => tr.remove());
  return tr;
}

function renderMappings(map) {
  const tbody = document.getElementById('mappingBody');
  tbody.innerHTML = '';
  for (const [type, profile] of Object.entries(map)) {
    tbody.appendChild(renderMappingRow(type, profile));
  }
}

function readMappingsFromUI() {
  const map = {};
  for (const tr of document.querySelectorAll('#mappingBody tr')) {
    const type    = tr.querySelector('.map-type')?.value.trim();
    const profile = tr.querySelector('.map-profile')?.value.trim();
    if (type && profile) map[type] = profile;
  }
  return map;
}

// ── Event handlers ────────────────────────────────────────────────────────────

document.getElementById('addMappingBtn').addEventListener('click', () => {
  document.getElementById('mappingBody').appendChild(renderMappingRow('', ''));
});

document.getElementById('resetMappingsBtn').addEventListener('click', () => {
  if (confirm('Reset filament mappings to bundled defaults?')) {
    renderMappings(BUNDLED_FILAMENT_MAP);
  }
});

document.getElementById('saveBtn').addEventListener('click', () => {
  const filamentMap = readMappingsFromUI();
  const settings = {
    profileId:             document.getElementById('profileId').value,
    applyRules:            document.getElementById('applyRules').checked,
    clampSpeeds:           document.getElementById('clampSpeeds').checked,
    preserveColorPainting: document.getElementById('preserveColorPainting').checked,
    insertSwapPauses:      document.getElementById('insertSwapPauses').checked,
    filamentMap:           Object.keys(filamentMap).length ? filamentMap : null,
  };
  const ruleEnabled = readRuleEnabledState();
  chrome.storage.sync.set({ ...settings, ruleEnabled }, () => {
    const status = document.getElementById('saveStatus');
    status.textContent = 'Saved ✓';
    setTimeout(() => { status.textContent = ''; }, 2000);
  });
});

// ── Init ──────────────────────────────────────────────────────────────────────

chrome.storage.sync.get({ ...DEFAULTS, ruleEnabled: {} }, async (s) => {
  document.getElementById('applyRules').checked                = s.applyRules;
  document.getElementById('clampSpeeds').checked               = s.clampSpeeds;
  document.getElementById('preserveColorPainting').checked     = s.preserveColorPainting;
  document.getElementById('insertSwapPauses').checked          = s.insertSwapPauses;
  renderMappings(s.filamentMap || BUNDLED_FILAMENT_MAP);

  await Promise.all([
    loadProfiles(s.profileId),
    loadRules(s.ruleEnabled),
  ]);
});
