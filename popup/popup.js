/**
 * Netflix Auto Skip - Popup Controller
 * Uses the same storage service as the content script and service worker.
 */

document.addEventListener('DOMContentLoaded', async () => {
  const constants = globalThis.NetflixAutoSkipConstants;
  const storageModule = globalThis.NetflixAutoSkipStorage;
  if (!constants || !storageModule || !storageModule.createStorage) return;

  const { DEFAULT_SETTINGS, DEFAULT_STATS, SETTING_KEYS, STAT_KEYS } = constants;
  const storage = storageModule.createStorage(chrome);

  const controls = {
    enabled: document.getElementById('toggle-enabled'),
    skipIntro: document.getElementById('toggle-skip-intro'),
    skipRecap: document.getElementById('toggle-skip-recap'),
    skipCredits: document.getElementById('toggle-skip-credits'),
    autoContinue: document.getElementById('toggle-auto-continue'),
    showToast: document.getElementById('toggle-show-toast')
  };
  const statusCard = document.getElementById('status-card');
  const statusText = document.getElementById('status-text');
  const statIntros = document.getElementById('stat-intros');
  const statRecaps = document.getElementById('stat-recaps');
  const statCredits = document.getElementById('stat-credits');
  const statTotal = document.getElementById('stat-total');
  const btnResetStats = document.getElementById('btn-reset-stats');

  function updateStatusCard(isEnabled) {
    if (!statusCard) return;
    statusCard.classList.toggle('disabled', !isEnabled);
    statusCard.classList.toggle('active', Boolean(isEnabled));
    if (statusText) statusText.textContent = isEnabled
      ? 'Active & Monitoring Netflix'
      : 'Extension Paused';
  }

  function renderSettings(settings) {
    const values = { ...DEFAULT_SETTINGS, ...settings };
    for (const key of SETTING_KEYS) {
      if (controls[key]) controls[key].checked = values[key];
    }
    updateStatusCard(values.enabled);
  }

  function renderStats(stats) {
    const values = { ...DEFAULT_STATS, ...stats };
    const fields = {
      introsSkipped: statIntros,
      recapsSkipped: statRecaps,
      creditsSkipped: statCredits,
      totalSkipped: statTotal
    };
    for (const key of Object.keys(fields)) {
      if (fields[key]) fields[key].textContent = Number(values[key] || 0).toLocaleString();
    }
  }

  async function refreshSettings() {
    renderSettings(await storage.getSettings());
  }

  async function refreshStats() {
    renderStats(await storage.getStats());
  }

  for (const key of SETTING_KEYS) {
    const element = controls[key];
    if (!element) continue;
    element.addEventListener('change', async (event) => {
      const value = Boolean(event.target.checked);
      await storage.setSettings({ [key]: value });
      if (key === 'enabled') updateStatusCard(value);
    });
  }

  if (btnResetStats) {
    btnResetStats.addEventListener('click', async () => {
      btnResetStats.classList.add('spin');
      const timer = setTimeout(() => btnResetStats.classList.remove('spin'), 400);
      void timer;
      if (await storage.resetStats()) await refreshStats();
    });
  }

  if (chrome.storage && chrome.storage.onChanged) {
    chrome.storage.onChanged.addListener((changes, areaName) => {
      const settingChanged = SETTING_KEYS.some((key) => key in changes);
      const statChanged = areaName === 'local' && STAT_KEYS.some((key) => key in changes);
      if (settingChanged) void refreshSettings().catch(() => {});
      if (statChanged) void refreshStats().catch(() => {});
    });
  }

  try {
    await refreshSettings();
    await refreshStats();
  } catch (error) {
    console.warn('[Netflix Auto Skip] Failed to load popup data:', error);
  }
});
