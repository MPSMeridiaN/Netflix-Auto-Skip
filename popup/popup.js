/**
 * Netflix Auto Skip - Popup Controller
 * Manages UI interactions, settings persistence, and real-time statistics display.
 */

document.addEventListener('DOMContentLoaded', async () => {
  // UI Elements - Toggles
  const toggleEnabled = document.getElementById('toggle-enabled');
  const toggleSkipIntro = document.getElementById('toggle-skip-intro');
  const toggleSkipRecap = document.getElementById('toggle-skip-recap');
  const toggleSkipCredits = document.getElementById('toggle-skip-credits');
  const toggleAutoContinue = document.getElementById('toggle-auto-continue');
  const toggleShowToast = document.getElementById('toggle-show-toast');

  // UI Elements - Status & Stats
  const statusCard = document.getElementById('status-card');
  const statusText = document.getElementById('status-text');
  const statIntros = document.getElementById('stat-intros');
  const statRecaps = document.getElementById('stat-recaps');
  const statCredits = document.getElementById('stat-credits');
  const statTotal = document.getElementById('stat-total');
  const btnResetStats = document.getElementById('btn-reset-stats');

  // Default configuration
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

  // Safe storage access helper
  async function getStorage(keys) {
    try {
      if (chrome.storage?.sync) {
        return await chrome.storage.sync.get(keys);
      }
    } catch {
      // Fallback
    }
    try {
      if (chrome.storage?.local) {
        return await chrome.storage.local.get(keys);
      }
    } catch {
      // Fallback to default keys
    }
    return keys;
  }

  async function setStorage(items) {
    try {
      if (chrome.storage?.sync) {
        await chrome.storage.sync.set(items);
        return;
      }
    } catch {
      // Fallback
    }
    try {
      if (chrome.storage?.local) {
        await chrome.storage.local.set(items);
      }
    } catch {
      // Ignore
    }
  }

  // Update Status Card UI (with complete null safety)
  function updateStatusCard(isEnabled) {
    if (!statusCard) return;
    if (isEnabled) {
      statusCard.classList.remove('disabled');
      statusCard.classList.add('active');
      if (statusText) statusText.textContent = 'Active & Monitoring Netflix';
    } else {
      statusCard.classList.remove('active');
      statusCard.classList.add('disabled');
      if (statusText) statusText.textContent = 'Extension Paused';
    }
  }

  // Render Stats Numbers (with complete null safety)
  function renderStats(stats) {
    const s = { ...DEFAULT_STATS, ...stats };
    if (statIntros) statIntros.textContent = (s.introsSkipped || 0).toLocaleString();
    if (statRecaps) statRecaps.textContent = (s.recapsSkipped || 0).toLocaleString();
    if (statCredits) statCredits.textContent = (s.creditsSkipped || 0).toLocaleString();
    if (statTotal) statTotal.textContent = (s.totalSkipped || 0).toLocaleString();
  }

  // Load Initial Settings & Stats
  async function loadInitialData() {
    try {
      const settings = await getStorage(DEFAULT_SETTINGS);
      if (toggleEnabled) toggleEnabled.checked = settings.enabled ?? true;
      if (toggleSkipIntro) toggleSkipIntro.checked = settings.skipIntro ?? true;
      if (toggleSkipRecap) toggleSkipRecap.checked = settings.skipRecap ?? true;
      if (toggleSkipCredits) toggleSkipCredits.checked = settings.skipCredits ?? true;
      if (toggleAutoContinue) toggleAutoContinue.checked = settings.autoContinue ?? true;
      if (toggleShowToast) toggleShowToast.checked = settings.showToast ?? true;

      updateStatusCard(toggleEnabled ? toggleEnabled.checked : true);

      // Load stats reliably from local or sync storage
      let stats = DEFAULT_STATS;
      try {
        const localStats = await chrome.storage?.local?.get(DEFAULT_STATS);
        if (localStats && (localStats.totalSkipped || 0) > 0) {
          stats = localStats;
        } else {
          const syncStats = await chrome.storage?.sync?.get(DEFAULT_STATS);
          if (syncStats && (syncStats.totalSkipped || 0) > 0) {
            stats = syncStats;
          } else if (localStats) {
            stats = localStats;
          }
        }
      } catch {
        // Use defaults
      }
      renderStats(stats);
    } catch (err) {
      console.error('[Netflix Auto Skip] Failed to load popup data:', err);
    }
  }

  // Setup Event Listeners for Toggles (with complete null safety)
  function bindToggle(element, key, onToggleExtra) {
    if (!element) return;
    element.addEventListener('change', async (e) => {
      const value = e.target.checked;
      await setStorage({ [key]: value });
      if (onToggleExtra) onToggleExtra(value);
    });
  }

  bindToggle(toggleEnabled, 'enabled', (val) => updateStatusCard(val));
  bindToggle(toggleSkipIntro, 'skipIntro');
  bindToggle(toggleSkipRecap, 'skipRecap');
  bindToggle(toggleSkipCredits, 'skipCredits');
  bindToggle(toggleAutoContinue, 'autoContinue');
  bindToggle(toggleShowToast, 'showToast');

  // Reset Stats Button (Instant reset with visual animation)
  if (btnResetStats) {
    btnResetStats.addEventListener('click', async () => {
      btnResetStats.classList.add('spin');
      setTimeout(() => btnResetStats.classList.remove('spin'), 400);

      try {
        if (chrome.storage?.local) await chrome.storage.local.set(DEFAULT_STATS);
        if (chrome.storage?.sync) await chrome.storage.sync.set(DEFAULT_STATS);
      } catch (err) {
        console.warn('[Netflix Auto Skip] Failed to reset stats:', err);
      }
      renderStats(DEFAULT_STATS);
    });
  }

  // Listen for live updates in storage (both local and sync)
  if (chrome.storage?.onChanged) {
    chrome.storage.onChanged.addListener((changes) => {
      const hasStatChange = ['introsSkipped', 'recapsSkipped', 'creditsSkipped', 'totalSkipped'].some(
        (k) => k in changes
      );
      if (hasStatChange) {
        chrome.storage.local.get(DEFAULT_STATS).then(renderStats).catch(() => {});
      }
    });
  }

  await loadInitialData();
});
