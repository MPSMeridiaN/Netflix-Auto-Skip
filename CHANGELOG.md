# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

_Changes for the next release go here. Run `npm run release:prepare -- <version>` to promote this section._

---

## [1.1.1] - 2026-08-31

### Changed
- **Production-Code QA**: Replaced copied-logic tests with DOM-fixture tests that call the production playback engine.
- **Lifecycle Ownership**: Added singleton instance replacement, history-wrapper restoration, listener cleanup, media hook cleanup, and owned timer/frame teardown.
- **Playback Scoping**: Restricted execution to exact Netflix watch routes with a recognized player-root video; catalog and unrecognized preview videos are ignored.
- **Episode Identity**: Switched one-shot state to canonical watch-route identity so transient title DOM changes do not reset episode state.
- **Storage Contract**: Centralized settings/statistics behavior, serialized local counter increments, and added migration for settings written during sync fallback.
- **Release Verification**: Added static release audits and deterministic ZIP metadata/content verification.
- **Release Automation**: Added tag-driven CI/release workflows, synchronized version preparation, and changelog-backed GitHub release notes.

### Fixed
- Prevented history `pushState`/`replaceState` wrapper stacking after repeated injection or extension reload.
- Prevented stale in-flight actions from clicking DOM belonging to a later SPA route.
- Replaced absolute privacy wording with behavior-based network, storage, and data-handling disclosures.

---

## [1.1.0] - 2026-08-31

### Added
- **Multi-Layer False-Positive Protection**: Added explicit exclusion filters for player control bars, episode picker drawers, audio/subtitle selection panels, and non-action postplay buttons.
- **Dedicated Technical Architecture Doc**: Created [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) detailing DOM observation lifecycle, state machine transitions, and storage isolation.
- **Official Web Store Guide**: Created [`CHROMEWEBSTORE.md`](CHROMEWEBSTORE.md) with metadata, permissions justifications, and privacy disclosures.
- **Reproducible Build Script**: Added automated `scripts/build-zip.py` and `npm run build` command for reproducible release packaging.

### Changed
- **Route-Scoped Performance**: Active DOM observation and polling now strictly activate on watch pages (`/watch/*`) or when video elements are mounted, dropping CPU overhead to near-zero while browsing Netflix catalogs.
- **Still Watching Cooldown**: Transitioned "Still Watching" pause interrupters from permanent episode locks to a 4-second cooldown, ensuring recurring prompts during long binge sessions are properly dismissed.
- **Clean Storage Ownership**: User preferences reside in `chrome.storage.sync` (with local fallback) while skip statistics reside strictly in `chrome.storage.local`.
- **Product Documentation Overhaul**: Modernized `README.md` into a visual-first, concise, premium product page with honest privacy disclosures.

### Fixed
- **Dead Code Elimination**: Removed obsolete `RECORD_SKIP` and `GET_CONFIG` service worker listeners and unused configuration keys.
- **Icon Generator Path**: Fixed `scripts/generate-icons.py` output directory to target root `icons/` folder directly.

---

## [1.0.7] - 2026-08-30

### Fixed
- **Instant Next Episode Countdown Bypass**: Expanded post-play & seamless draining button selectors (`[data-uia*="seamless"]`, `[data-uia*="postplay"]`) and refined video progress checks so the end-of-episode countdown is clicked in 0ms without waiting.

---

## [1.0.6] - 2026-08-30

### Fixed
- **Instant Skip Intro & Recap Execution**: Fixed button click suppression caused by premature element disabling before native click execution, restoring instant intro and recap skipping.
- **Cross-Instance Zombie Killer**: Dispatched `nas:terminate_instance` event to automatically shut down any previous content script instances running in the tab.

---

## [1.0.5] - 2026-08-30

### Fixed
- **Root-Cause Double-Click Fix**: Replaced duplicate multi-event simulation with a single atomic W3C click to prevent Netflix React playlist controller from advancing two episodes.
- **Global Action Mutex**: Added `isActionInProgress` lock preventing concurrent observer scans during episode transitions.
- **60-Second Hard Lockout**: Extended next-episode cooldown to 60 seconds.

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

---

[unreleased]: https://github.com/MPSMeridiaN/Netflix-Auto-Skip/compare/v1.1.1...HEAD
[1.1.1]: https://github.com/MPSMeridiaN/Netflix-Auto-Skip/compare/v1.1.0...v1.1.1
[1.1.0]: https://github.com/MPSMeridiaN/Netflix-Auto-Skip/compare/v1.0.7...v1.1.0
[1.0.7]: https://github.com/MPSMeridiaN/Netflix-Auto-Skip/compare/v1.0.6...v1.0.7
[1.0.6]: https://github.com/MPSMeridiaN/Netflix-Auto-Skip/compare/v1.0.5...v1.0.6
[1.0.5]: https://github.com/MPSMeridiaN/Netflix-Auto-Skip/compare/v1.0.4...v1.0.5
[1.0.4]: https://github.com/MPSMeridiaN/Netflix-Auto-Skip/compare/v1.0.3...v1.0.4
[1.0.3]: https://github.com/MPSMeridiaN/Netflix-Auto-Skip/compare/v1.0.2...v1.0.3
[1.0.2]: https://github.com/MPSMeridiaN/Netflix-Auto-Skip/compare/v1.0.1...v1.0.2
[1.0.1]: https://github.com/MPSMeridiaN/Netflix-Auto-Skip/compare/v1.0.0...v1.0.1
[1.0.0]: https://github.com/MPSMeridiaN/Netflix-Auto-Skip/releases/tag/v1.0.0
