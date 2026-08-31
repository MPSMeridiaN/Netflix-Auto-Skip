# Contributing to Netflix Auto Skip

Thank you for your interest in contributing to **Netflix Auto Skip**! We welcome community contributions to keep this extension fast, reliable, and up to date with Netflix UI changes across all Chromium browsers.

## Code of Conduct

Please be respectful, constructive, and helpful when participating in issues, pull requests, and discussions.

## How to Contribute

### 1. Reporting Bugs & Netflix DOM Updates
Netflix regularly updates its web player interface, which may change element class names or `data-uia` attributes. If an auto-skip feature stops working:
- Open a GitHub Issue.
- Include your Browser & Version (e.g., Vivaldi 6.x, Chrome 120+, Edge, Brave).
- Include the affected Netflix route or title only after removing account identifiers; do not share credentials, cookies, payment details, or private account data.
- If possible, inspect the button element in DevTools and copy its HTML/selectors.

### 2. Developing Locally
1. Clone or download this repository.
2. Open your Chromium-based browser (Vivaldi, Chrome, Edge, Brave, etc.).
3. Navigate to `chrome://extensions` or `vivaldi://extensions`.
4. Enable **Developer mode** toggle.
5. Click **Load unpacked** and select the root directory of this repository.
6. Open Netflix (`https://www.netflix.com`) and test playback.

### 3. Guidelines
- Follow **Manifest V3** best practices.
- Do NOT use `eval()`, inline scripts, or inline event handlers (`onclick="..."`).
- Keep content script DOM checks throttled with `requestAnimationFrame` to prevent any stutter or performance impact on video playback.
- Write clear, concise commit messages.

## License
By contributing, you agree that your contributions will be licensed under the project's [MIT License](LICENSE).
