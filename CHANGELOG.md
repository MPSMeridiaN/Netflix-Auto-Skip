# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.0.1] - 2026-08-30

### Fixed
- **Direct Storage Stats Increment**: Fixed skip counters failing to increment by writing directly to `chrome.storage.local` from the content script, eliminating reliance on ephemeral Manifest V3 service workers.
- **Popup Reset Button**: Fixed non-responsive reset counter button by removing blocked modal `window.confirm()` calls and adding instant visual spin feedback.
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
- **Open Source Foundation**: MIT License, contributing guidelines, and Chrome Web Store submission metadata.
