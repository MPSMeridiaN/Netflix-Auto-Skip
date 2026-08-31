/**
 * Netflix Auto Skip - Background Service Worker (Manifest V3)
 * Handles extension installation and initial storage setup.
 */

const DEFAULT_SETTINGS = {
  enabled: true,
  skipIntro: true,
  skipRecap: true,
  skipCredits: true,
  autoContinue: true,
  showToast: true
};

const DEFAULT_STATS = {
  introsSkipped: 0,
  recapsSkipped: 0,
  creditsSkipped: 0,
  promptsDismissed: 0,
  totalSkipped: 0
};

// Safe storage access helper for settings (supports sync with fallback to local)
async function initSettings() {
  try {
    if (chrome.storage?.sync) {
      const current = await chrome.storage.sync.get(DEFAULT_SETTINGS);
      await chrome.storage.sync.set({ ...DEFAULT_SETTINGS, ...current });
      return;
    }
  } catch {
    // Fallback to local if sync is unavailable
  }

  if (chrome.storage?.local) {
    const current = await chrome.storage.local.get(DEFAULT_SETTINGS);
    await chrome.storage.local.set({ ...DEFAULT_SETTINGS, ...current });
  }
}

async function initStats() {
  if (chrome.storage?.local) {
    const current = await chrome.storage.local.get(DEFAULT_STATS);
    await chrome.storage.local.set({ ...DEFAULT_STATS, ...current });
  }
}

// Initialize settings and stats on installation or update
chrome.runtime.onInstalled.addListener(async (details) => {
  await initSettings();
  await initStats();
});

