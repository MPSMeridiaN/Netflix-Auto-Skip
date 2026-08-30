# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.0.5] - 2026-08-30

### Fixed
- **Root-Cause Double-Click Fix (Atomic Single-Click)**: Replaced duplicate synthetic event firing (`PointerEvent` + `MouseEvent` + `el.click()`) with a single, atomic W3C `el.click()` and immediate element pointer neutralization (`disabled=true`, `pointerEvents='none'`). This resolves the root cause where Netflix's React playlist controller received two click events in the same tick and skipped 2 episodes (e.g. 475 ➔ 477).
- **Global Action Mutex**: Added `isActionInProgress` lock preventing all concurrent or trailing observer/interval scans from triggering while an episode transition is in progress.
- **60-Second Hard Lockout**: Extended the next-episode cooldown to 60 seconds to ensure strict single-episode progression.

---

## [1.0.4] - 2026-08-30

### Fixed
- **Start-Clock Confirmation Guard**: Next Episode trigger is now strictly locked until `video.currentTime < 60s` has been observed for the new episode.
- **Context Invalidation Auto-Cleanup**: Added `isContextAlive()` guards and automatic self-destruction of observers and intervals when extension is reloaded.

---

## [1.0.3] - 2026-08-30

### Fixed
- **Episode Lifecycle State Machine**: Integrated URL-based episode tracking (`/watch/<id>`) that locks each action (Intro, Recap, Next Episode) to at most one execution per episode.
- **SPA Stale DOM Race Condition**: Intercepted HTML5 History API (`pushState`, `replaceState`, `popstate`) and enforced startup lockout.

---

## [1.0.2] - 2026-08-30

### Fixed
- **Pre-Navigation Stats Persistence**: Reordered execution sequence so skip statistics are stored *before* button click dispatch, preventing data write aborts caused by Netflix's immediate URL navigation on next episode / skip.
- **Dual Storage Synchronization**: Stats are now written concurrently to both `chrome.storage.local` and `chrome.storage.sync`.
- **Clean Repository Metadata**: Removed redundant `CHROMEWEBSTORE.md` and replaced all placeholder clone URLs with the official GitHub repository link.

---

## [1.0.1] - 2026-08-30

### Fixed
- **Direct Storage Stats Increment**: Switched to direct storage writes from content script, eliminating reliance on ephemeral Manifest V3 background service workers.
- **Popup Reset Button**: Fixed non-responsive reset counter button by removing blocked modal `window.confirm()` calls and adding instant visual 360° spin feedback.
- **False-Positive Next Episode Trigger**: Added video playback progress guards (`currentTime < 120s` start lock) and strict exclusion of bottom player control bar (`.watch-video--bottom-controls-container`) to prevent premature episode skipping at startup.
- **Null-Safety Guards**: Added defensive element checks across all popup UI queries to prevent runtime ReferenceErrors.

### Changed
- **Luxury UI Redesign**: Upgraded extension popup to an Apple/Netflix-inspired dark glassmorphism interface with live pulse ring indicator and iOS-style switches.
- **Lanczos Master Icons**: Re-rendered all PNG icon assets (16px, 32px, 48px, 128px) from high-definition 1024px vector master with smooth antialiasing.
- **Vector Icons**: Replaced OS system emojis in popup and toast HUD with crisp inline SVG graphics.

---

## [1.0.0] - 2026-08-30

### Added
- **Instant Intro Skip**: Automatic 0ms detection and skipping for Netflix intros.
- **Auto Recap Skip**: Automatic skipping for previous episode recaps and preplay summaries.
- **Instant Next Episode**: Bypasses post-play credit countdowns and starts the next episode immediately.
- **Auto-Confirm 'Still Watching'**: Automatic dismissal of playback pause interruption prompts.
- **On-Screen HUD Toast**: Non-intrusive floating toast notifications inside the player.
- **Popup Settings & Analytics**: Dark-mode popup dashboard with individual feature toggles and statistics.
- **Universal Chromium Compatibility**: Full Manifest V3 support for Vivaldi, Chrome, Edge, Brave, Opera, and Arc.
- **Open Source Foundation**: MIT License and contributing guidelines.
