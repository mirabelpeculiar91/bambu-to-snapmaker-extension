# Bambu to Snapmaker U1 — Chrome Extension

A Chrome extension that adds a **Snapmaker U1** option to MakerWorld's printer filter carousel. Selecting it converts any model's print profile from Bambu Lab format to Snapmaker U1 format and downloads the converted `.3mf` file — without leaving your browser.

## How it works

1. On a MakerWorld model page, a **Snapmaker U1** slide appears in the printer filter carousel.
2. Clicking it changes the primary button to **Convert to Snapmaker U1**.
3. Clicking the button intercepts MakerWorld's own authenticated download, sends the `.3mf` to a locally-running conversion service, and downloads the converted file.

## Prerequisites

**The local conversion service must be running before you click Convert.**

Clone and start [bambu-to-snapmaker-u1](https://github.com/thadius83/bambu-to-snapmaker-u1) via Docker Compose:

```bash
git clone https://github.com/thadius83/bambu-to-snapmaker-u1.git
cd bambu-to-snapmaker-u1
docker compose up
```

The service runs at `http://localhost:8084` by default.

## Installation

This extension is not published to the Chrome Web Store. Load it unpacked:

1. Open Chrome and go to `chrome://extensions`
2. Enable **Developer mode** (top-right toggle)
3. Click **Load unpacked**
4. Select the `bambu-to-snapmaker-extension` folder

## Usage

1. Make sure the conversion service is running (`http://localhost:8084`)
2. Go to a MakerWorld model page, e.g. `https://makerworld.com/en/models/...`
3. Select a print profile from the profile list on the page
4. Click **Snapmaker U1** in the printer filter carousel
5. Click **Convert to Snapmaker U1**
6. The converted `.3mf` will download automatically

## Settings

Click the extension icon → **Options** to configure:

- **Service URL** — change if you're running the service on a different port
- **Reference profile** — the Snapmaker U1 profile used as the conversion base
- **Filament rules** — view, edit, enable/disable, or create custom YAML filament mapping rules

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

## Credits and Attribution

The conversion service this extension depends on is [bambu-to-snapmaker-u1](https://github.com/thadius83/bambu-to-snapmaker-u1) by thadius83, licensed under [PolyForm Noncommercial 1.0.0](https://polyformproject.org/licenses/noncommercial/1.0.0/).

> **Required Notice: Copyright thadius83 (https://github.com/thadius83)**

## License

The extension code in this repository is licensed under the MIT License — see [LICENSE](LICENSE).

**Note:** Because this extension depends on `bambu-to-snapmaker-u1`, the combined workflow is subject to the PolyForm Noncommercial 1.0.0 license terms of that project. **Non-commercial use only.** Commercial use requires a separate license from thadius83.
