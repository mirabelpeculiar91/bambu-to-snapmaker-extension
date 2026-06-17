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
    // Fuzzy match: "PETG" matches "PETG-HF", etc.
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

async function convertToU1(inputBuffer, opts = {}) {
  const {
    templateMode          = 'auto',
    applyRules            = true,
    clampSpeeds           = true,   // always effective — output starts from U1 template
    preserveColorPainting = true,   // always effective — non-config files are copied as-is
    insertSwapPauses      = false,  // not yet implemented
    filamentMap           = null,
  } = opts;

  const zip = await JSZip.loadAsync(inputBuffer);

  // ── 1. Read original project_settings to detect support template ──────────
  const origSettingsStr = await zip.file('Metadata/project_settings.config').async('string');
  const origSettings    = JSON.parse(origSettingsStr);
  const diff            = origSettings.different_settings_to_system || [];
  const hasSupport      = diff.some(s => typeof s === 'string' && s.includes('enable_support'));

  // ── 2. Load U1 template + filament profile map ────────────────────────────
  let useSupports;
  if (templateMode === 'supports')     useSupports = true;
  else if (templateMode === 'standard') useSupports = false;
  else                                  useSupports = hasSupport; // 'auto'

  const templateFile = useSupports ? 'assets/u1_template_supports.json' : 'assets/u1_template.json';

  // Use caller-supplied filament map or fall back to bundled defaults
  let profileMap;
  if (applyRules && filamentMap && Object.keys(filamentMap).length > 0) {
    profileMap = filamentMap;
  } else if (applyRules) {
    profileMap = await fetch(chrome.runtime.getURL('assets/filament_profiles.json')).then(r => r.json());
  } else {
    profileMap = {}; // disabled — mapFilamentType() will return DEFAULT_PROFILE for all types
  }

  const u1Settings = await fetch(chrome.runtime.getURL(templateFile)).then(r => r.json());

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

  // Cap at TARGET_FILAMENTS
  filaments = filaments.slice(0, TARGET_FILAMENTS);

  // ── 4. Build new color/type/settings_id arrays ────────────────────────────
  const newColors = filaments.map(f => ensureRGBA(f.color));
  const newTypes  = filaments.map(f => f.type);
  const newIds    = newTypes.map(t => mapFilamentType(t, profileMap));

  // Pad to 4
  while (newColors.length < TARGET_FILAMENTS) { newColors.push('#FFFFFFFF'); }
  while (newTypes.length  < TARGET_FILAMENTS) { newTypes.push('PLA'); }
  while (newIds.length    < TARGET_FILAMENTS) { newIds.push(DEFAULT_PROFILE); }

  // ── 5. Build combined project_settings ───────────────────────────────────
  const combined = { ...u1Settings };
  combined.filament_colour      = newColors;
  combined.filament_type        = newTypes;
  combined.filament_settings_id = newIds;

  // Normalize all filament_* list keys to TARGET_FILAMENTS length
  for (const [key, val] of Object.entries(combined)) {
    if (key.startsWith('filament_') && Array.isArray(val) && val.length > 0 && val.length !== TARGET_FILAMENTS) {
      combined[key] = padArray(val, TARGET_FILAMENTS, val[val.length - 1]);
    }
  }

  const combinedBytes = JSON.stringify(combined, null, 4);

  // ── 6. Build id_mapping for slice_info remapping ──────────────────────────
  const idMapping = {};
  filaments.forEach((f, i) => { idMapping[f.id] = String(i + 1); });

  // ── 7. Modify slice_info.config ───────────────────────────────────────────
  let modifiedSliceInfo = null;
  if (sliceEntry) {
    let sliceXml = await sliceEntry.async('string');

    // Replace printer_model_id
    sliceXml = sliceXml.replace(
      /key="printer_model_id"\s+value="[^"]*"/g,
      'key="printer_model_id" value="Snapmaker U1"'
    );

    const doc = parseXml(sliceXml);
    const parent = doc.querySelector('plate') || doc.documentElement;

    // Remap existing filament nodes
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

    // Pad with dummy white-PLA nodes
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

  // ── 8. Modify model_settings.config ──────────────────────────────────────
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

  // ── 9. Write output ZIP ───────────────────────────────────────────────────
  const outZip = new JSZip();
  const files   = Object.keys(zip.files);

  for (const name of files) {
    const entry = zip.file(name);
    if (!entry || entry.dir) {
      if (entry && entry.dir) outZip.folder(name);
      continue;
    }

    // Zip-slip defence: skip absolute or traversal paths
    const safe = name.replace(/\\/g, '/').replace(/^\/+/, '');
    if (safe.startsWith('..') || safe.includes('/../')) continue;

    if (name === 'Metadata/project_settings.config') {
      outZip.file(name, combinedBytes);
    } else if (name === 'Metadata/slice_info.config' && modifiedSliceInfo) {
      outZip.file(name, modifiedSliceInfo);
    } else if (name === 'Metadata/model_settings.config' && modifiedModelSettings) {
      outZip.file(name, modifiedModelSettings);
    } else {
      const data = await entry.async('uint8array');
      outZip.file(name, data);
    }
  }

  return outZip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' });
}
