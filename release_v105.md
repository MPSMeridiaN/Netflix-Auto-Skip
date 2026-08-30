## 🎬 Netflix Auto Skip v1.0.5

### 🛡️ Root-Cause Fixes in v1.0.5
- **Atomic Single-Click Dispatch**: Replaced duplicate event firing (`PointerEvent` + `MouseEvent` + `el.click()`) with a single, atomic W3C `el.click()` and immediate target pointer neutralization (`disabled=true`, `pointerEvents='none'`). This resolves the exact root cause where Netflix's React playlist controller received two click events in the same tick and skipped 2 episodes (e.g. 475 ➔ 477).
- **Global Action Mutex**: Added `isActionInProgress` lock preventing all concurrent or trailing observer/interval scans from triggering while an episode transition is in progress.
- **60-Second Hard Lockout**: Extended the next-episode cooldown to 60 seconds to ensure strict single-episode progression.

---

### 📦 Direct Installation
1. Download **`netflix-auto-skip-v1.0.5.zip`** below.
2. Extract the archive into a folder.
3. Open `vivaldi://extensions` (or `chrome://extensions`, `edge://extensions`, `brave://extensions`, `opera://extensions`).
4. Turn on **Developer mode** and click **Load unpacked**.
5. Select the extracted folder.
6. Open [Netflix](https://www.netflix.com) and enjoy seamless streaming!
