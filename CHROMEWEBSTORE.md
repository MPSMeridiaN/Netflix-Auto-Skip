# Chrome Web Store Listing & Metadata

> **Last Updated**: 2026-08-30
> **Extension Name**: Netflix Auto Skip - Intro, Recap & Credits
> **Short Name**: Netflix Auto Skip
> **Version**: 1.0.0
> **Target Manifest**: Manifest V3

---

## 1. Store Listing Metadata

### Extension Name
Netflix Auto Skip - Intro, Recap & Credits

### Summary / Short Description (max 132 chars)
Automatically skips Netflix intros, recaps, and credits, autoplays next episodes, and dismisses 'Are you still watching?'.

### Detailed Description
Tired of manually clicking "Skip Intro" or waiting 15 seconds for the next episode to start? **Netflix Auto Skip** provides seamless, zero-interruption binge-watching on Netflix.

Features:
⏩ **Auto Skip Intro**: Instantly clicks "Skip Intro" the moment it appears on screen.
⏪ **Auto Skip Recap**: Automatically skips previous episode recaps and preplay summaries.
⏭️ **Auto Next Episode / Skip Credits**: Instantly starts the next episode as soon as credits begin, bypassing the countdown timer.
▶️ **Auto Dismiss "Still Watching?"**: Automatically confirms playback continuation so your watch session remains uninterrupted.
🔔 **Subtle On-Screen HUD**: Optional sleek, non-intrusive toast notifications showing when an action was performed.
📊 **Time Saved & Skip Statistics**: Track how many intros, recaps, and episodes you have skipped right from the popup.
🎛️ **Customizable Controls**: Toggle any feature on or off independently with single-click switches.

Lightweight, ultra-fast, and respects your privacy. Works with 100% of Chromium-based browsers including Vivaldi, Google Chrome, Microsoft Edge, Brave, Opera, and Arc.

---

## 2. Category & Language
- **Category**: Productivity / Accessibility / Entertainment
- **Default Language**: English

---

## 3. Permissions Justification

| Permission | Scope | Technical Justification |
|---|---|---|
| `storage` | Storage API | Required to persist user configuration preferences (toggle states for intro, recap, next episode, toast notifications) and local skip statistics across browser sessions using `chrome.storage.sync` and `chrome.storage.local`. |
| `*://*.netflix.com/*` (Host Permission) | Host Permission | Required to run content scripts on Netflix web player pages (`netflix.com`) to detect playback buttons (Skip Intro, Skip Recap, Next Episode, Continue Watching) and simulate user interaction. |

---

## 4. Privacy & Data Disclosures
- **Single Purpose**: Automatically skip Netflix player prompts and intros for uninterrupted viewing.
- **Data Collection**: No personal data, browsing history, Netflix account credentials, or telemetry is ever collected, transmitted, or sold. All statistics are stored 100% locally on the user's device via `chrome.storage`.
- **Remote Code**: None. 100% compliant with Manifest V3 restrictions against remote code execution.

---

## 5. Version History

### Version 1.0.0 (2026-08-30)
- Initial open-source release for Vivaldi, Chrome, Edge, Brave, Opera, Arc.
- Real-time MutationObserver detection with zero latency.
- Comprehensive selector mapping covering modern React player UI and multilingual fallbacks.
- Sleek Netflix-themed popup UI with real-time statistics tracking.
