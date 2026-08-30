## 🎬 Netflix Auto Skip v1.0.6

### 🛡️ Critical Fixes in v1.0.6
- **Instant Skip Intro & Recap Execution**: Fixed button click suppression caused by premature element disabling before native click execution, restoring instant intro and recap skipping.
- **Cross-Instance Zombie Killer**: Dispatched `nas:terminate_instance` event to automatically shut down any previous content script instances running in the tab.

---

### 📦 Direct Installation
1. Download **`netflix-auto-skip-v1.0.6.zip`** below.
2. Extract the archive into a folder.
3. Open `vivaldi://extensions` (or `chrome://extensions`, `edge://extensions`, `brave://extensions`, `opera://extensions`).
4. Turn on **Developer mode** and click **Load unpacked**.
5. Select the extracted folder.
6. Open [Netflix](https://www.netflix.com) and enjoy seamless streaming!
