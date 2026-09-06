# AI Vision Prompt Generator — Chrome Extension

[![⬇️ Download ZIP (v3.2.2)](https://img.shields.io/badge/⬇️_Download_Extension_ZIP-v3.2.2-2563eb?style=for-the-badge&logo=github&logoColor=white)](https://github.com/jahidulislamseo/ai-vision-prompt-generator/archive/refs/heads/master.zip)
[![Manifest V3](https://img.shields.io/badge/Manifest_V3-Chrome_Extension-059669?style=for-the-badge&logo=google-chrome&logoColor=white)](https://developer.chrome.com/docs/extensions/mv3/)

> 🚀 **Direct Download:** **[👉 Click Here to Download Extension ZIP (v3.2.2)](https://github.com/jahidulislamseo/ai-vision-prompt-generator/archive/refs/heads/master.zip)**  
> *Unzip the file → Go to `chrome://extensions` → Turn on **Developer mode** → Click **Load unpacked** and select the folder.*

A high-performance Manifest V3 Chrome Extension that converts any web image or local desktop graphic into detailed, production-ready AI image generation prompts for Midjourney v6, DALL-E 3, Flux Schnell/Dev, and Stable Diffusion XL.

![AI Vision Prompt Generator Icon](Icon/icon128.png)

## Features

### 🖼️ Instant Image-to-Prompt Vision Engine
- **Webpage Image Analysis:** Hover over any image on any webpage and click the floating AI button to analyze lighting, color temperature, shot framing, subject details, and stylistic markers.
- **Desktop Drag & Drop (Popup):** Ingest local images straight from your computer or Mac desktop into the extension popup without needing to browse a webpage.
- **3-Part Structured Prompt Architecture:** Produces a standardized, high-yield prompt:
  1. `MAIN PROMPT:` Dense photographic description detailing subject physical traits, apparel textures, background gradient, camera focal length, and art direction.
  2. `NEGATIVE:` High-precision exclusion parameters (deformations, bad hands, artifacts, blurs).
  3. `IMAGE DETAILS:` Lighting scheme, camera perspective, color grade, and dynamic aspect ratio (`--ar`).

### 📐 Dynamic Aspect Ratio Detection
- **Auto Dimension Detection:** Automatically calculates natural image dimensions (`naturalWidth / naturalHeight`) and dynamically maps them to the appropriate Midjourney aspect ratio flag (e.g. `--ar 16:9`, `--ar 9:16`, `--ar 1:1`, `--ar 21:9`, `--ar 4:5`, `--ar 2:3`).

### ⚡ 100-Image Bulk Batching & CSV Export
- **Bulk Extraction & Batch Ingestion:** Process up to 100 images simultaneously from any web gallery.
- **Unrestricted Spreadsheet CSV Export:** Export complete generation history, timestamps, detected styles, and full prompts directly to `.csv` with zero paywall gating.

### 📋 Instant Auto-Copy to Clipboard
- **Zero Extra Clicks:** Generates prompts and instantly writes them to the system clipboard (`navigator.clipboard.writeText`) with a visual confirmation badge.

### 💾 Persistent Local History Vault
- Stores up to 1,000 prompt generations locally with zero midnight wipes. Search, replay, and copy any past prompt in one click.

---

## Folder Structure

```text
ai-vision-prompt-generator/
├── manifest.json         # Extension Manifest V3 configuration
├── PRIVACY.md            # Privacy policy
├── popup.html            # Main popup interface (Drag & Drop, History, Settings)
├── popup.js              # UI logic, drag & drop ingestion, and history management
├── content.js            # In-page hover triggers and 100-image bulk batch engine
├── background.js         # Multi-modal AI vision worker and storage controller
├── README.md             # Documentation and quick installation guide
└── Icon/
    ├── icon16.png
    ├── icon48.png
    └── icon128.png
```

---

## 🚀 How to Download & Install from GitHub

You do **not** need Node.js or any build tools to use this extension. It runs natively in Google Chrome, Microsoft Edge, Brave, and other Chromium browsers.

### Method 1: Download ZIP (Easiest)

1. Click the green **`<> Code`** button at the top of this GitHub repository.
2. Select **"Download ZIP"** (or [click here to download](https://github.com/jahidulislamseo/ai-vision-prompt-generator/archive/refs/heads/master.zip)).
3. Extract (unzip) the downloaded file on your computer. You will get a folder named `ai-vision-prompt-generator-master`.
4. Open Google Chrome (or Edge / Brave / Opera).
5. In the address bar, type **`chrome://extensions`** and press **Enter**.
6. Turn **ON** the **"Developer mode"** toggle in the top-right corner.
7. Click the **"Load unpacked"** button in the top-left corner.
8. Select the unzipped `ai-vision-prompt-generator-master` folder (the folder containing `manifest.json`).
9. Done! The extension icon will appear in your browser toolbar. Click the puzzle icon 🧩 and pin **AI Vision Prompt Generator** for quick access.

### Method 2: Git Clone

```bash
git clone https://github.com/jahidulislamseo/ai-vision-prompt-generator.git
```
Then follow steps 4–9 above and select the cloned `ai-vision-prompt-generator` folder.

---

## 🔑 Setting Up Your Free AI API Key

The extension supports direct BYOK (Bring Your Own Key) using Google Gemini or Groq:

1. Click the extension icon in your browser toolbar.
2. Go to the **Settings** tab.
3. Paste your free **Gemini API Key** (generate one for free at [Google AI Studio](https://aistudio.google.com/apikey)) or free **Groq API Key** ([console.groq.com](https://console.groq.com)).
4. Click **Save Settings**. Your key is securely stored in your browser's private local storage.

---

## 🔄 How to Update to the Latest Version

If you already installed the extension and want to get the latest version:
1. Re-download the ZIP or run `git pull origin master` inside your folder.
2. Go to **`chrome://extensions`**.
3. Find **"AI Vision Prompt Generator"** and click the **Reload (🔄)** icon button.

---

## Publishing to the Chrome Web Store

To build a clean `.zip` package for Chrome Web Store distribution:

```bash
zip -r ai-vision-prompt-generator.zip . -x "*.git*" "*.DS_Store*" "*.vscode*" "*.zip" "*scratch*"
```

Upload the resulting `ai-vision-prompt-generator.zip` file directly to the [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole).
