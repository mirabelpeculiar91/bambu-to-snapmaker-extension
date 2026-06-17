# Bambu to Snapmaker U1 — Chrome Extension ![Beta](https://img.shields.io/badge/version-1.0%20Beta-blue)

<a href="https://www.buymeacoffee.com/gmeek" target="_blank"><img src="https://cdn.buymeacoffee.com/buttons/v2/default-blue.png" alt="Buy Me a Coffee" style="height: 60px !important;width: 217px !important;" ></a>

A Chrome extension that adds a **Snapmaker U1** option to MakerWorld's printer filter carousel. Selecting it converts any model's print profile from Bambu Lab format to Snapmaker U1 format and downloads the converted `.3mf` file — without leaving your browser.

## How it works

The extension injects a **Snapmaker U1** tile into the printer filter carousel on any MakerWorld model page. Clicking it swaps the download button to **Convert to Snapmaker U1**. One more click intercepts MakerWorld's own authenticated download, converts the `.3mf` entirely in-browser, and saves the converted file — no external service or Docker container required.

![Printer filter with Snapmaker U1 option and Download 3MF button](screenshots/1.png)

*The injected Snapmaker U1 option appears alongside the standard printer filters.*

---

![Snapmaker U1 selected, Convert to Snapmaker U1 button](screenshots/2.png)

*Selecting Snapmaker U1 changes the button to Convert to Snapmaker U1.*

---

![Converting profile in progress](screenshots/3.png)

*While conversion runs, the button shows a spinner and "Converting profile".*

---

![Save dialog with U1.3mf filename](screenshots/4.png)

*The converted file is named after the original model with a `-U1.3mf` suffix.*

## First Use

The first time you click **Convert to Snapmaker U1**, your browser will show this prompt:

![Browser prompt asking to allow makerworld.com to access other apps](screenshots/allow-access.png)

This is the browser asking permission for MakerWorld to open Bambu Studio via its `bambu-studio://` protocol. Click **Allow** — the extension intercepts the file during this process, so Bambu Studio won't actually open and the converted `.3mf` will download instead. You should only see this prompt once per browser session.

## Prerequisites

No external software required. The extension converts `.3mf` files entirely in your browser using bundled conversion logic.

You must be **logged in to MakerWorld** for the download interception to work.

## Browser Compatibility

Tested and working in:

| Browser | Status |
|---|---|
| Chrome | ✅ Tested |
| Microsoft Edge | ✅ Tested |
| Brave | ✅ Tested |
| Opera, Vivaldi, Arc | Should work (Chromium-based, untested) |
| Firefox | ❌ Not supported (different extension format) |
| Safari | ❌ Not supported |

## Installation

This extension is not published to the Chrome Web Store. Load it unpacked:

1. Open your browser's extension page (`chrome://extensions` in Chrome/Brave, `edge://extensions` in Edge)
2. Enable **Developer mode** (top-right toggle)
3. Click **Load unpacked**
4. Select the `bambu-to-snapmaker-extension` folder

## Usage

1. Go to a MakerWorld model page, e.g. `https://makerworld.com/en/models/...`
2. Select a print profile from the profile list on the page
3. Click **Snapmaker U1** in the printer filter carousel
4. Click **Convert to Snapmaker U1**
5. The converted `.3mf` will download automatically

## Settings

Click the extension icon → **Options** to configure conversion behavior.

![Extension settings page](screenshots/5.png)

| Setting | Description |
|---|---|
| Conversion Template | U1 template used as the conversion base — Auto-detect picks Supports when the original model has supports enabled |
| Apply filament type mappings | Map Bambu filament types (PLA, PETG, ABS, TPU) to the correct Snapmaker profile names |
| Clamp speeds to U1 limits | Ensure output speeds stay within U1 hardware limits |
| Preserve color painting | Keep multi-color painting data from the original file |
| Insert M600 swap pauses | Add filament-change pauses for multi-color prints (coming soon) |

### Filament Type Mappings

The mappings table shows how each Bambu filament type is translated to a Snapmaker profile name. Matching is by substring (e.g. "PLA" matches "PLA-CF"). You can add, edit, or remove rows, and reset to the bundled defaults at any time.

## Button states

| State | Icon | Label |
|---|---|---|
| Ready | Conversion arrows | Convert to Snapmaker U1 |
| Converting | Spinning arrow | Converting profile |
| Success | Checkmark | U1 profile ready |
| Error | Warning triangle | Conversion failed |

## Notes

- You must be **logged in to MakerWorld** for the download interception to work.
- Select a **print profile** on the model page before clicking Convert — the button needs an active profile to trigger the download.
- The extension intercepts MakerWorld's own authenticated fetch rather than making its own request, so no credentials are stored or transmitted by the extension.
- Conversion runs entirely in your browser — no Docker, no local service, no external dependencies.

## Credits and Attribution

The conversion logic in this extension is ported from [bambu-to-snapmaker-u1](https://github.com/thadius83/bambu-to-snapmaker-u1) by thadius83, licensed under [PolyForm Noncommercial 1.0.0](https://polyformproject.org/licenses/noncommercial/1.0.0/).

> **Required Notice: Copyright thadius83 (https://github.com/thadius83)**

## License

The extension code in this repository is licensed under the MIT License — see [LICENSE](LICENSE).

**Note:** The conversion logic is ported from `bambu-to-snapmaker-u1`, so the combined work is subject to the PolyForm Noncommercial 1.0.0 license terms of that project. **Non-commercial use only.** Commercial use requires a separate license from thadius83.
