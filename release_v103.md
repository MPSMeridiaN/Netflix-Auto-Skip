## 🎬 Netflix Auto Skip v1.0.3

### 🛡️ Race Condition & Episode State Machine Fixes
- **Episode Lifecycle State Machine**: Integrated URL-based episode tracking (`/watch/<id>`) that locks each action (Intro, Recap, Next Episode) to at most **one execution per episode**, preventing duplicate triggers.
- **Eliminated Double-Skip on Native Autoplay**: Added a 15-second minimum playback lockout on episode transitions and intercepted HTML5 History navigation (`pushState`, `replaceState`, `popstate`), ensuring that lingering post-play DOM elements from previous episodes are completely ignored.
- **Manual Navigation & Scrubbing Resilience**: Handled user manual seeks, scrubber changes, and episode list switching gracefully without triggering false skips.

---

### 📦 Direct Installation
1. Download **`netflix-auto-skip-v1.0.3.zip`** below.
2. Extract the archive into a folder.
3. Open `vivaldi://extensions` (or `chrome://extensions`, `edge://extensions`, `brave://extensions`, `opera://extensions`).
4. Turn on **Developer mode** and click **Load unpacked**.
5. Select the extracted folder.
6. Open [Netflix](https://www.netflix.com) and enjoy seamless streaming!
