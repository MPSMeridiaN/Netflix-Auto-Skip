## 🎬 Netflix Auto Skip v1.0.4

### 🛡️ Critical Fixes in v1.0.4
- **Start-Clock Confirmation Guard**: Next Episode skip is now strictly locked until `video.currentTime < 60s` has been observed for the new episode, completely eliminating previous episode residual video time (e.g. 23:45 / 24:00) causing double skips (e.g. skipping 475 ➔ 476 ➔ 477).
- **30-Second Hard Next-Episode Cooldown**: Enforced an absolute 30-second lockout on next-episode actions to prevent rapid chaining.
- **Context Invalidation Auto-Cleanup**: Added `isContextAlive()` guards and automatic self-destruction of observers and intervals when the extension is reloaded.

---

### 📦 Direct Installation
1. Download **`netflix-auto-skip-v1.0.4.zip`** below.
2. Extract the archive into a folder.
3. Open `vivaldi://extensions` (or `chrome://extensions`, `edge://extensions`, `brave://extensions`, `opera://extensions`).
4. Turn on **Developer mode** and click **Load unpacked**.
5. Select the extracted folder.
6. Open [Netflix](https://www.netflix.com) and enjoy seamless streaming!
