// Extension settings page — in-browser conversion (no external service required)

const DEFAULTS = {
  templateMode:          'auto',
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

// ── Filament mapping table ────────────────────────────────────────────────────

function escAttr(s) {
  return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

function renderMappingRow(type, profile) {
  const tr = document.createElement('tr');
  tr.innerHTML =
    `<td><input type="text" class="map-type"    value="${escAttr(type)}"    placeholder="e.g. PETG"></td>` +
    `<td><input type="text" class="map-profile" value="${escAttr(profile)}" placeholder="e.g. Snapmaker PETG HF"></td>` +
    `<td style="text-align:center"><button class="btn-danger" title="Remove row">✕</button></td>`;
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
    templateMode:          document.getElementById('templateMode').value,
    applyRules:            document.getElementById('applyRules').checked,
    clampSpeeds:           document.getElementById('clampSpeeds').checked,
    preserveColorPainting: document.getElementById('preserveColorPainting').checked,
    insertSwapPauses:      document.getElementById('insertSwapPauses').checked,
    filamentMap:           Object.keys(filamentMap).length ? filamentMap : null,
  };
  chrome.storage.sync.set(settings, () => {
    const status = document.getElementById('saveStatus');
    status.textContent = 'Saved ✓';
    setTimeout(() => { status.textContent = ''; }, 2000);
  });
});

// ── Init ──────────────────────────────────────────────────────────────────────

chrome.storage.sync.get(DEFAULTS, (s) => {
  document.getElementById('templateMode').value                = s.templateMode;
  document.getElementById('applyRules').checked                = s.applyRules;
  document.getElementById('clampSpeeds').checked               = s.clampSpeeds;
  document.getElementById('preserveColorPainting').checked     = s.preserveColorPainting;
  document.getElementById('insertSwapPauses').checked          = s.insertSwapPauses;
  renderMappings(s.filamentMap || BUNDLED_FILAMENT_MAP);
});
