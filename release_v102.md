## 🎬 Netflix Auto Skip v1.0.2

### 🛠️ Fixes & Improvements in v1.0.2
- **Pre-Navigation Stats Persistence**: Reordered execution sequence so skip statistics are stored *before* button click dispatch, preventing data write aborts caused by Netflix's immediate URL navigation on next episode / skip.
- **Dual Storage Synchronization**: Stats are now written concurrently to both `chrome.storage.local` and `chrome.storage.sync` with multi-area storage change listeners for 100% reliable counter updates.
- **Clean Repository Metadata**: Removed redundant store metadata and replaced all placeholder clone URLs with the official GitHub repository link.
- **Version & Changelog Toolchain**: Standardized semantic versioning in `package.json`, `manifest.json`, and `CHANGELOG.md`.

---

### 📦 Direct Installation
1. Download **`netflix-auto-skip-v1.0.2.zip`** below.
2. Extract the archive into a folder.
3. Open `vivaldi://extensions` (or `chrome://extensions`, `edge://extensions`, `brave://extensions`, `opera://extensions`).
4. Turn on **Developer mode** and click **Load unpacked**.
5. Select the extracted folder.
6. Open [Netflix](https://www.netflix.com) and enjoy seamless streaming!
