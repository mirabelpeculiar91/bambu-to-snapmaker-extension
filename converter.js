// Conversion logic: Bambu Lab .3mf → Snapmaker U1 .3mf
// Ported from app.py. Runs in the content script context (has access to chrome.runtime).

const TARGET_FILAMENTS = 4;
const DEFAULT_PROFILE  = 'Snapmaker PLA SnapSpeed @U1';

function normalizeColor(color) {
  if (!color) return '#000000';
  const c = color.replace(/^#/, '');
  if (c.length !== 6 && c.length !== 8) return '#000000';
  if (!/^[0-9A-Fa-f]+$/.test(c)) return '#000000';
  return '#' + c.toUpperCase();
}

function ensureRGBA(color) {
  // color is already normalized: 7 chars (#RRGGBB) or 9 chars (#RRGGBBAA)
  return color.length === 7 ? color + 'FF' : color;
}

function mapFilamentType(type, profileMap) {
  if (!type) return DEFAULT_PROFILE;
  const up = type.toUpperCase();
  for (const [k, v] of Object.entries(profileMap)) {
    const key = k.toUpperCase().replace(/-HF$/, '').replace(/-/g, '');
    const src = up.replace(/-HF$/, '').replace(/-/g, '');
    if (src.includes(key) || key.includes(src)) return v;
  }
  return DEFAULT_PROFILE;
}

function parseXml(str) {
  return new DOMParser().parseFromString(str, 'application/xml');
}

function serializeXml(doc) {
  return new XMLSerializer().serializeToString(doc);
}

function parseFilamentsFromSliceInfo(xmlStr) {
  const doc = parseXml(xmlStr);
  const nodes = Array.from(doc.querySelectorAll('filament'));
  return nodes.map(n => ({
    id:    n.getAttribute('id'),
    color: normalizeColor(n.getAttribute('color') || ''),
    type:  n.getAttribute('type') || 'PLA',
  }));
}

function parseFilamentsFromProjectSettings(jsonStr) {
  const cfg    = JSON.parse(jsonStr);
  const colors = cfg.filament_colour || [];
  const types  = cfg.filament_type   || [];
  return colors.map((color, i) => ({
    id:    String(i + 1),
    color: normalizeColor(color),
    type:  types[i] || 'PLA',
  }));
}

function padArray(arr, length, fillValue) {
  const out = arr.slice(0, length);
  while (out.length < length) out.push(fillValue ?? arr[arr.length - 1]);
  return out;
}

// Apply enabled filament rules whose match conditions are satisfied by
// any slot in the source file. Lower priority fires first; higher wins
// on conflicting keys. Numeric override values are coerced to strings
// (Orca stores all settings as JSON strings).
function applyFilamentRules(combined, rules, origSettings) {
  const {
    filament_settings_id: sids = [],
    filament_vendor:      vens = [],
    filament_type:        typs = [],
  } = origSettings;
  const n = Math.max(sids.length, vens.length, typs.length);

  const sorted = [...rules]
    .filter(r => r.enabled)
    .sort((a, b) => (a.priority || 0) - (b.priority || 0));

  for (const rule of sorted) {
    const m = rule.match || {};
    const needle = (m.filament_settings_id_contains || '').toLowerCase();

    // Check filament-scoped conditions: a rule matches if ANY slot satisfies
    // all specified conditions simultaneously.
    if (needle || m.filament_vendor || m.filament_type) {
      let matched = false;
      for (let i = 0; i < n; i++) {
        const sid = (sids[i] || '').toLowerCase();
        const ven = vens[i] || '';
        const typ = typs[i] || '';
        if (needle && !sid.includes(needle)) continue;
        if (m.filament_vendor && ven !== m.filament_vendor) continue;
        if (m.filament_type   && typ !== m.filament_type)   continue;
        matched = true;
        break;
      }
      if (!matched) continue;
    }

    for (const [k, v] of Object.entries(rule.overrides || {})) {
      combined[k] = (typeof v === 'number') ? String(v) : v;
    }
  }
}

async function convertToU1(inputBuffer, opts = {}) {
  const {
    profileId             = '0.20mm-standard',
    applyRules            = true,
    clampSpeeds           = true,   // always effective — output starts from U1 profile
    preserveColorPainting = true,   // always effective — non-config files are copied as-is
    insertSwapPauses      = false,  // not yet implemented
    filamentMap           = null,
    rules                 = [],
  } = opts;

  const zip = await JSZip.loadAsync(inputBuffer);

  // ── 1. Read source project_settings — needed for filament data + supports detection
  const origSettingsStr = await zip.file('Metadata/project_settings.config').async('string');
  const origSettings    = JSON.parse(origSettingsStr);
  const diff            = origSettings.different_settings_to_system || [];
  const hasSupport      = diff.some(s => typeof s === 'string' && s.includes('enable_support'));

  // ── 2. Load U1 reference profile + filament type map ─────────────────────
  // Try the selected profile first; fall back to the default 0.20mm standard template.
  let u1Settings;
  try {
    u1Settings = await fetch(chrome.runtime.getURL(`assets/profiles/${profileId}.json`)).then(r => {
      if (!r.ok) throw new Error(r.status);
      return r.json();
    });
  } catch {
    u1Settings = await fetch(chrome.runtime.getURL('assets/u1_template.json')).then(r => r.json());
  }

  // Enable supports when the source had them (the selected profile has supports off by default).
  if (hasSupport) u1Settings = { ...u1Settings, enable_support: '1' };

  const profileMap = (filamentMap && Object.keys(filamentMap).length > 0)
    ? filamentMap
    : await fetch(chrome.runtime.getURL('assets/filament_profiles.json')).then(r => r.json());

  // ── 3. Parse source filaments ─────────────────────────────────────────────
  let filaments = [];
  const sliceEntry = zip.file('Metadata/slice_info.config');
  if (sliceEntry) {
    const sliceXml = await sliceEntry.async('string');
    filaments = parseFilamentsFromSliceInfo(sliceXml);
  }
  if (!filaments.length) {
    filaments = parseFilamentsFromProjectSettings(origSettingsStr);
  }
  filaments = filaments.slice(0, TARGET_FILAMENTS);

  // ── 4. Build new filament arrays ──────────────────────────────────────────
  const newColors = filaments.map(f => ensureRGBA(f.color));
  const newTypes  = filaments.map(f => f.type);
  const newIds    = newTypes.map(t => mapFilamentType(t, profileMap));

  while (newColors.length < TARGET_FILAMENTS) newColors.push('#FFFFFFFF');
  while (newTypes.length  < TARGET_FILAMENTS) newTypes.push('PLA');
  while (newIds.length    < TARGET_FILAMENTS) newIds.push(DEFAULT_PROFILE);

  // ── 5. Build combined project_settings ───────────────────────────────────
  const combined = { ...u1Settings };
  combined.filament_colour      = newColors;
  combined.filament_type        = newTypes;
  combined.filament_settings_id = newIds;

  // Normalize all filament_* arrays to TARGET_FILAMENTS length
  for (const [key, val] of Object.entries(combined)) {
    if (key.startsWith('filament_') && Array.isArray(val) && val.length > 0 && val.length !== TARGET_FILAMENTS) {
      combined[key] = padArray(val, TARGET_FILAMENTS, val[val.length - 1]);
    }
  }

  // ── 6. Apply filament rules (speed/setting overrides) ────────────────────
  if (applyRules && rules.length > 0) {
    applyFilamentRules(combined, rules, origSettings);
  }

  const combinedBytes = JSON.stringify(combined, null, 4);

  // ── 7. Build id_mapping for slice_info remapping ──────────────────────────
  const idMapping = {};
  filaments.forEach((f, i) => { idMapping[f.id] = String(i + 1); });

  // ── 8. Modify slice_info.config ───────────────────────────────────────────
  let modifiedSliceInfo = null;
  if (sliceEntry) {
    let sliceXml = await sliceEntry.async('string');
    sliceXml = sliceXml.replace(
      /key="printer_model_id"\s+value="[^"]*"/g,
      'key="printer_model_id" value="Snapmaker U1"'
    );

    const doc = parseXml(sliceXml);
    const parent = doc.querySelector('plate') || doc.documentElement;

    let counter = 1;
    const existingNodes = Array.from(parent.querySelectorAll('filament'));
    existingNodes.forEach(node => {
      const oldId = node.getAttribute('id');
      if (idMapping[oldId] !== undefined) {
        node.setAttribute('id',    String(counter));
        node.setAttribute('color', newColors[counter - 1]);
        node.setAttribute('type',  newTypes[counter - 1]);
        counter++;
      } else {
        node.parentNode.removeChild(node);
      }
    });

    while (counter <= TARGET_FILAMENTS) {
      const dummy = doc.createElement('filament');
      dummy.setAttribute('id',     String(counter));
      dummy.setAttribute('type',   'PLA');
      dummy.setAttribute('color',  '#FFFFFFFF');
      dummy.setAttribute('used_m', '0');
      dummy.setAttribute('used_g', '0');
      parent.appendChild(dummy);
      counter++;
    }

    modifiedSliceInfo = serializeXml(doc);
  }

  // ── 9. Modify model_settings.config ──────────────────────────────────────
  let modifiedModelSettings = null;
  const modelEntry = zip.file('Metadata/model_settings.config');
  if (modelEntry) {
    const modelXml = await modelEntry.async('string');
    const doc = parseXml(modelXml);
    doc.querySelectorAll('metadata[key="extruder"]').forEach(meta => {
      const oldVal = meta.getAttribute('value');
      if (idMapping[oldVal] !== undefined) {
        meta.setAttribute('value', idMapping[oldVal]);
      }
    });
    modifiedModelSettings = serializeXml(doc);
  }

  // ── 10. Write output ZIP ──────────────────────────────────────────────────
  const outZip = new JSZip();
  for (const name of Object.keys(zip.files)) {
    const entry = zip.file(name);
    if (!entry || entry.dir) { if (entry?.dir) outZip.folder(name); continue; }

    const safe = name.replace(/\\/g, '/').replace(/^\/+/, '');
    if (safe.startsWith('..') || safe.includes('/../')) continue;

    if (name === 'Metadata/project_settings.config') {
      outZip.file(name, combinedBytes);
    } else if (name === 'Metadata/slice_info.config' && modifiedSliceInfo) {
      outZip.file(name, modifiedSliceInfo);
    } else if (name === 'Metadata/model_settings.config' && modifiedModelSettings) {
      outZip.file(name, modifiedModelSettings);
    } else {
      outZip.file(name, await entry.async('uint8array'));
    }
  }

  return outZip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' });
}
