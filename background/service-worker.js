/**
 * Netflix Auto Skip - Background Service Worker (Manifest V3)
 * Manages default settings initialization, stats aggregation, and extension lifecycle.
 */

const DEFAULT_SETTINGS = {
  enabled: true,
  skipIntro: true,
  skipRecap: true,
  skipCredits: true,
  autoContinue: true,
  showToast: true,
  skipDelayMs: 0
};

const DEFAULT_STATS = {
  introsSkipped: 0,
  recapsSkipped: 0,
  creditsSkipped: 0,
  promptsDismissed: 0,
  totalSkipped: 0
};

// Safe storage access helper (supports sync with fallback to local)
async function getStorageData(keys) {
  try {
    if (chrome.storage?.sync) {
      return await chrome.storage.sync.get(keys);
    }
  } catch {
    // Fallback to local storage if sync is disabled or quota exceeded
  }
  return await chrome.storage.local.get(keys);
}

async function setStorageData(items) {
  try {
    if (chrome.storage?.sync) {
      await chrome.storage.sync.set(items);
      return;
    }
  } catch {
    // Fallback
  }
  await chrome.storage.local.set(items);
}

// Initialize settings and stats on installation or update
chrome.runtime.onInstalled.addListener(async (details) => {
  const currentSettings = await getStorageData(DEFAULT_SETTINGS);
  const newSettings = { ...DEFAULT_SETTINGS, ...currentSettings };
  await setStorageData(newSettings);

  const currentStats = await chrome.storage.local.get(DEFAULT_STATS);
  const newStats = { ...DEFAULT_STATS, ...currentStats };
  await chrome.storage.local.set(newStats);

  console.log(`[Netflix Auto Skip] Initialized (Reason: ${details.reason})`);
});

// Listen for messages from content scripts (e.g. stats updates, toast triggers)
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || !message.type) return false;

  if (message.type === 'RECORD_SKIP') {
    (async () => {
      try {
        const { skipType } = message;
        const currentStats = await chrome.storage.local.get(DEFAULT_STATS);
        const stats = { ...DEFAULT_STATS, ...currentStats };

        stats.totalSkipped = (stats.totalSkipped || 0) + 1;

        if (skipType === 'intro') {
          stats.introsSkipped = (stats.introsSkipped || 0) + 1;
        } else if (skipType === 'recap') {
          stats.recapsSkipped = (stats.recapsSkipped || 0) + 1;
        } else if (skipType === 'credits') {
          stats.creditsSkipped = (stats.creditsSkipped || 0) + 1;
        } else if (skipType === 'prompt') {
          stats.promptsDismissed = (stats.promptsDismissed || 0) + 1;
        }

        await chrome.storage.local.set(stats);
        sendResponse({ success: true, stats });
      } catch (err) {
        console.error('[Netflix Auto Skip] Failed to record skip:', err);
        sendResponse({ success: false, error: err.message });
      }
    })();
    return true; // Keep message channel open for async response
  }

  if (message.type === 'GET_CONFIG') {
    (async () => {
      try {
        const settings = await getStorageData(DEFAULT_SETTINGS);
        sendResponse({ success: true, settings });
      } catch (err) {
        sendResponse({ success: false, error: err.message });
      }
    })();
    return true;
  }

  return false;
});
