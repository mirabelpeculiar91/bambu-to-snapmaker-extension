# Third-Party Notices

This file contains attribution and required notices for third-party software
and content included in or derived from this project.

---

## bambu-to-snapmaker-u1

- **Project:** bambu-to-snapmaker-u1
- **Author:** thadius83
- **Source:** https://github.com/thadius83/bambu-to-snapmaker-u1
- **License:** PolyForm Noncommercial License 1.0.0
  https://polyformproject.org/licenses/noncommercial/1.0.0

> **Required Notice: Copyright thadius83 (https://github.com/thadius83)**

**What was used:**

The following portions of this repository are derived from or directly include
content from bambu-to-snapmaker-u1:

- Conversion algorithm logic (`converter.js`) — ported and adapted from
  `backend/converter.py`, `backend/rules_engine.py`, and related modules
- Filament rule data (`assets/rules.json`) — derived from the YAML rule files
  in the `rules/` directory
- Reference print profiles (`assets/profiles/`) — extracted from the `.3mf`
  reference profile files in the `profiles/` directory
- Filament type mapping (`assets/filament_profiles.json`) — derived from
  the filament profile mapping in the original service

These portions may be used only for purposes permitted by the PolyForm
Noncommercial License 1.0.0. See `LICENSE-POLYFORM` for the full license text.

---

## JSZip

- **Project:** JSZip
- **Source:** https://stuk.github.io/jszip/
- **License:** MIT License / GPLv3 (dual-licensed; MIT is used here)

JSZip is used to read and write `.3mf` archive files in-browser.
