<div align="center">

# 🎬 Netflix Auto Skip

**A high-performance, zero-latency open-source browser extension that automates Netflix playback interactions — instantly skipping intros, recaps, post-play credits, and auto-dismissing 'Are you still watching?' interruptions.**

[![Manifest V3](https://img.shields.io/badge/Manifest-V3-E50914.svg?style=for-the-badge&logo=googlechrome&logoColor=white)](https://developer.chrome.com/docs/extensions/mv3/intro/)
[![License: MIT](https://img.shields.io/badge/License-MIT-F5A623.svg?style=for-the-badge)](LICENSE)
[![Cross Browser](https://img.shields.io/badge/Universal-All%20Chromium%20Browsers-30D158.svg?style=for-the-badge)](#-universal-browser-compatibility)
[![Privacy](https://img.shields.io/badge/Privacy-100%25%20Local%20%26%20Safe-0A84FF.svg?style=for-the-badge)](#-privacy--security)

<br/>

<img src="assets/infographic.png" alt="Netflix Auto Skip Infographic" width="850" style="border-radius: 12px; box-shadow: 0 12px 36px rgba(0,0,0,0.6);" />

</div>

---

## ⚡ Key Features

- **Instant Intro Skip** `⚡ 0ms` — Automatically clicks "Skip Intro" within milliseconds of rendering.
- **Auto Recap Skip** `⏩ Instant` — Bypasses previous episode summaries and preplay recaps automatically.
- **Instant Next Episode** `⏭️ Seamless` — Skips credit countdowns and transitions to the next episode immediately.
- **Auto-Confirm "Still Watching"** `▶️ Auto` — Automatically dismisses periodic playback interruption prompts.
- **On-Screen HUD Toast** `🔔 Overlay` — Displays a sleek, non-intrusive floating glassmorphism notification on skip.
- **Real-Time Analytics** `📊 Dashboard` — Built-in popup statistics counter tracking total skips and time saved.
- **Modular Toggle Controls** `🎛️ Custom` — Enable or disable each automation feature independently.
- **100% Private & Offline** `🛡️ Local` — Runs completely locally with zero tracking, cookies, or telemetry.

---

## 🌐 Universal Browser Compatibility

This extension is built on modern **Manifest V3** WebExtension standards and works identically across **all modern desktop browsers**:

| Browser | Supported | Engine | Installation Method |
|:---|:---:|:---|:---|
| **Vivaldi** | ✅ 100% | Chromium | `vivaldi://extensions` ➔ Load unpacked |
| **Google Chrome** | ✅ 100% | Chromium | `chrome://extensions` ➔ Load unpacked |
| **Microsoft Edge** | ✅ 100% | Chromium | `edge://extensions` ➔ Load unpacked |
| **Brave Browser** | ✅ 100% | Chromium | `brave://extensions` ➔ Load unpacked |
| **Opera / Opera GX** | ✅ 100% | Chromium | `opera://extensions` ➔ Load unpacked |
| **Arc Browser** | ✅ 100% | Chromium | `arc://extensions` ➔ Load unpacked |
| **Chromium / Kiwi** | ✅ 100% | Chromium | Standard unpacked extension |

---

## 🚀 Installation Guide

### Option 1: Quick Install via Release ZIP (Recommended)
1. Download the latest [`netflix-auto-skip-v1.0.7.zip`](dist/netflix-auto-skip-v1.0.7.zip) from the [`dist/`](dist/) folder or [GitHub Releases](https://github.com/MPSMeridiaN/Netflix-Auto-Skip/releases).
2. Extract the ZIP file into a folder on your computer.
3. Open your browser's extension management page:
   - **Vivaldi**: `vivaldi://extensions`
   - **Chrome**: `chrome://extensions`
   - **Edge**: `edge://extensions`
   - **Brave**: `brave://extensions`
   - **Opera**: `opera://extensions`
4. Toggle on **Developer mode** (usually in the top-right corner).
5. Click **Load unpacked** and select the extracted folder.
6. Open [Netflix](https://www.netflix.com) and start watching!

---

### Option 2: Install via Git Clone
```bash
git clone https://github.com/MPSMeridiaN/Netflix-Auto-Skip.git
```
Then load the cloned folder as an unpacked extension using the steps above.

---

## 🏗️ Architecture & Engine Details

Netflix's modern player is a single-page application built on dynamic React streaming components. Standard extension scripts often run into race conditions or trigger issues. Netflix Auto Skip solves this using a multi-layer engine:

```
┌────────────────────────────────────────────────────────┐
│               Netflix Video Player DOM                 │
└──────────────────────────┬─────────────────────────────┘
                           │
                 [ MutationObserver ] (Batched with RAF)
                           │
       ┌───────────────────┴───────────────────┐
       ▼                                       ▼
[ Button Detection ]                   [ Video Progress Guard ]
- [data-uia="player-skip-intro"]       - Start Guard (< 2m): Blocks next ep
- [data-uia="player-skip-recap"]       - End Guard (> 80% / < 180s): Allows postplay
- [data-uia="next-episode-seamless"]   - Strict exclusion of bottom control bar
       │                                       │
       └───────────────────┬───────────────────┘
                           │ Validated
                           ▼
           [ Atomic Click & State Machine ]
           Episode Lock → Mutex Guard → Atomic Native Click
                            │
                            ▼
           [ Action Execution & Toast HUD ]
```

1. **`MutationObserver` + RAF Batching**: Zero CPU overhead; catches DOM changes at 60fps without video stutter.
2. **Episode Lifecycle State Machine**: URL & title-based tracking ensuring single-execution per action per episode.
3. **Atomic Single-Click Engine**: Clean W3C native execution preventing duplicate React synthetic event triggers.
4. **Isolated HUD Styling**: Floating glassmorphism notifications insulated with high z-index and isolated CSS namespaces.

---

## 📂 Clean Repository Structure

```
Netflix Auto Skip/
├── manifest.json              # Manifest V3 extension configuration
├── LICENSE                    # MIT Open Source License
├── README.md                  # Comprehensive documentation and setup guide
├── CHANGELOG.md             # Standard-compliant release and change history
├── CONTRIBUTING.md          # Guidelines for open-source contributors
├── package.json             # NPM scripts for building, testing, and packaging
├── assets/                  # Project visual assets & infographic
│   └── infographic.png
├── dist/                    # Pre-packaged release zip for users
│   └── netflix-auto-skip-v1.0.7.zip
├── icons/                   # High-definition PNG icons (16, 32, 48, 128 px)
│   ├── icon-16.png
│   ├── icon-32.png
│   ├── icon-48.png
│   └── icon-128.png
├── background/
│   └── service-worker.js     # Service worker (state synchronization & storage)
├── content/
│   ├── content.js            # Video player observer & synthetic click engine
│   └── content.css           # Glassmorphism on-screen HUD styling
├── popup/
│   ├── popup.html            # Luxury dark-mode popup interface
│   ├── popup.css             # Netflix Red glassmorphism styling
│   └── popup.js              # Settings controller and live analytics
└── scripts/
    └── generate-icons.py     # Developer script to regenerate icons
```

---

## 🔒 Privacy & Security

- **Strict Scoping**: Host permissions are limited solely to `*://*.netflix.com/*`.
- **Zero Data Collection**: No cookies, account information, browsing history, or viewing metrics are ever logged, sent, or shared.
- **Local Storage**: All preferences and skip statistics reside 100% locally on your machine via `chrome.storage`.

---

## 🤝 Contributing

Contributions, feature requests, and bug reports are welcome! Check out [CONTRIBUTING.md](CONTRIBUTING.md) to get involved.

---

## 📄 License

Distributed under the [MIT License](LICENSE).
