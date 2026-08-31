# Chrome Web Store Listing & Disclosure Guide

This document contains the official metadata, permissions justifications, and privacy disclosures for the **Netflix Auto Skip** Chrome Web Store listing.

---

## Store Listing Metadata

- **Extension Name**: Netflix Auto Skip - Intro, Recap & Credits
- **Short Name**: Netflix Auto Skip
- **Version**: 1.1.0
- **Category**: Productivity / Accessibility
- **Primary Language**: English
- **Summary**: Automatically skips intros, recaps, and credits, autoplays next episodes, and dismisses "Still watching" on Netflix.

---

## Detailed Description (Store Copy)

```text
Netflix Auto Skip is a clean, privacy-focused extension that removes playback interruptions on Netflix so you can enjoy your movies and TV series seamlessly.

KEY FEATURES:
• Skip Intro: Automatically clicks "Skip Intro" as soon as it appears.
• Skip Recap: Bypasses previous episode recaps and preplay summaries.
• Next Episode: Automatically transitions to the next episode during post-play credit countdowns.
• Auto-Confirm "Still Watching": Dismisses periodic pause interruption dialogs.
• On-Screen Toast HUD: Sleek, non-intrusive floating indicator when a skip occurs (can be toggled off).
• Individual Feature Controls: Customize exactly which features are active in the popup menu.
• Local Analytics: View your total skip statistics directly in the popup dashboard.

PRIVACY & SAFETY FIRST:
• 100% Offline: Operates entirely within your browser.
• Zero Data Collection: No tracking, no analytics, no external servers, and no cookies collected.
• Scoped Permissions: Runs strictly on netflix.com.

Simple, reliable, and invisible. Install it, sit back, and enjoy your show.
```

---

## Permissions Justification

### 1. `storage`
- **Justification**: Required to persist user automation preferences (e.g., enable/disable intro skip, toggle HUD overlay) and store local skip statistics on the user's device.

### 2. Host Permission: `*://*.netflix.com/*`
- **Justification**: Required to inject the content script into the Netflix video player to detect and click skip buttons during playback. The extension has no access to any other websites.

---

## Privacy & Data Usage Disclosures

| Question | Answer | Details |
| :--- | :---: | :--- |
| **Do you collect personal data?** | **No** | The extension collects zero personal identifiable information. |
| **Do you transmit data to external servers?** | **No** | Zero external network calls or telemetry endpoints. |
| **How are user settings stored?** | **Local / Sync** | Stored in `chrome.storage.sync` (or `local` fallback) within the user's own browser profile. |
| **How are statistics stored?** | **Local Only** | Kept strictly on the user's device in `chrome.storage.local`. |

---

## Version History

- **1.1.0** (2026-08-31): Production hardening, refined DOM selector safety, false-positive protection for control bars and episode drawers, route-scoped performance optimization, single-source storage management, and comprehensive automated test suite.
- **1.0.7** (2026-08-30): Seamless credit countdown bypass selector expansion.
- **1.0.0** (2026-08-30): Initial public release with intro, recap, credits, and still watching auto-skipping.
