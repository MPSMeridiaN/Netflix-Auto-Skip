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
    showToast: true
  };

  const DEFAULT_STATS = {
    introsSkipped: 0,
    recapsSkipped: 0,
    creditsSkipped: 0,
    promptsDismissed: 0,
    totalSkipped: 0
  };

  // Storage helpers: Settings (sync with local fallback)
  async function getSettings() {
    try {
      if (chrome.storage?.sync) {
        return await chrome.storage.sync.get(DEFAULT_SETTINGS);
      }
    } catch {
      // Fallback to local
    }
    try {
      if (chrome.storage?.local) {
        return await chrome.storage.local.get(DEFAULT_SETTINGS);
      }
    } catch {
      // Ignore
    }
    return DEFAULT_SETTINGS;
  }

  async function setSettings(items) {
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

  // Storage helpers: Stats (strictly local)
  async function getStats() {
    try {
      if (chrome.storage?.local) {
        return await chrome.storage.local.get(DEFAULT_STATS);
      }
    } catch {
      // Ignore
    }
    return DEFAULT_STATS;
  }

  // Update Status Card UI
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

  // Render Stats Numbers
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
      const settings = await getSettings();
      if (toggleEnabled) toggleEnabled.checked = settings.enabled ?? true;
      if (toggleSkipIntro) toggleSkipIntro.checked = settings.skipIntro ?? true;
      if (toggleSkipRecap) toggleSkipRecap.checked = settings.skipRecap ?? true;
      if (toggleSkipCredits) toggleSkipCredits.checked = settings.skipCredits ?? true;
      if (toggleAutoContinue) toggleAutoContinue.checked = settings.autoContinue ?? true;
      if (toggleShowToast) toggleShowToast.checked = settings.showToast ?? true;

      updateStatusCard(toggleEnabled ? toggleEnabled.checked : true);

      const stats = await getStats();
      renderStats(stats);
    } catch (err) {
      console.error('[Netflix Auto Skip] Failed to load popup data:', err);
    }
  }

  // Setup Event Listeners for Toggles
  function bindToggle(element, key, onToggleExtra) {
    if (!element) return;
    element.addEventListener('change', async (e) => {
      const value = e.target.checked;
      await setSettings({ [key]: value });
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
      } catch (err) {
        console.warn('[Netflix Auto Skip] Failed to reset stats:', err);
      }
      renderStats(DEFAULT_STATS);
    });
  }

  // Listen for live updates in storage
  if (chrome.storage?.onChanged) {
    chrome.storage.onChanged.addListener((changes) => {
      const hasStatChange = ['introsSkipped', 'recapsSkipped', 'creditsSkipped', 'promptsDismissed', 'totalSkipped'].some(
        (k) => k in changes
      );
      if (hasStatChange) {
        getStats().then(renderStats).catch(() => {});
      }
    });
  }

  await loadInitialData();
});

