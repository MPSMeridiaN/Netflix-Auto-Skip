# Chrome Web Store Listing & Disclosure Guide

This document contains the official metadata, permissions justifications, and privacy disclosures for the **Netflix Auto Skip** Chrome Web Store listing.

---

## Store Listing Metadata

- **Extension Name**: Netflix Auto Skip - Intro, Recap & Credits
- **Short Name**: Netflix Auto Skip
- **Version**: 1.1.3
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
• Local Skip Counters: View your skip statistics directly in the popup dashboard.

PRIVACY & SAFETY FIRST:
• No telemetry or network backend: No telemetry, analytics, remote backend, or extension-initiated external network requests.
• Playback-only data handling: The extension does not intentionally collect or transmit credentials, cookies, payment details, or account data.
• Scoped Permissions: Injects only on https://www.netflix.com/* and requests the storage permission.
• Storage is transparent: settings may sync through the browser profile, while skip counters remain in local browser storage.

Simple, reliable, and invisible. Install it, sit back, and enjoy your show.
```

---

## Permissions Justification

### 1. `storage`
- **Justification**: Required to persist user automation preferences (e.g., enable/disable intro skip, toggle HUD overlay) and store local skip statistics on the user's device.

### 2. Host Permission: `https://www.netflix.com/*`
- **Justification**: Required to inject the content script into the Netflix video player to detect and click supported controls during playback. No other origins are included.

---

## Privacy & Data Usage Disclosures

| Question | Answer | Details |
| :--- | :---: | :--- |
| **Do you collect personal data?** | **No** | No credentials, cookies, payment details, or account data are intentionally collected or transmitted. |
| **Do you transmit data to external servers?** | **No** | No telemetry, analytics, remote backend, or extension-initiated external network requests. |
| **How are user settings stored?** | **Local / Sync** | Stored in `chrome.storage.sync` when available, with a local fallback in the user's browser profile. |
| **How are statistics stored?** | **Local Only** | Skip counters are written strictly to `chrome.storage.local`. |

---

## Version History

- **1.1.3** (2026-09-01): Fixed Vivaldi startup races, missed watch-route transitions, delayed player activation, and stale player monitoring during episode transitions.

- **1.1.2** (2026-08-31): Fixed Skip Intro detection at episode start, stale video-progress blocking during transitions, and DOM re-render races.

- **1.1.1** (2026-08-31): Final production hardening: production-code DOM fixtures, owned lifecycle teardown, stable route identity, stricter playback scoping, storage fallback migration, deterministic release packaging, and release audits.
- **1.1.0** (2026-08-31): Production hardening, refined DOM selector safety, false-positive protection for control bars and episode drawers, route-scoped performance optimization, single-source storage management, and comprehensive automated test suite.
- **1.0.7** (2026-08-30): Seamless credit countdown bypass selector expansion.
- **1.0.0** (2026-08-30): Initial public release with intro, recap, credits, and still watching auto-skipping.
