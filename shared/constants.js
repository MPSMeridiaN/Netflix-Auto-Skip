/**
 * Shared extension constants.
 *
 * This file is deliberately a classic script so it can be used by the
 * content script, popup, and Manifest V3 service worker without a bundler.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.NetflixAutoSkipConstants = factory();
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const DEFAULT_SETTINGS = Object.freeze({
    enabled: true,
    skipIntro: true,
    skipRecap: true,
    skipCredits: true,
    autoContinue: true,
    showToast: true
  });

  const DEFAULT_STATS = Object.freeze({
    introsSkipped: 0,
    recapsSkipped: 0,
    creditsSkipped: 0,
    promptsDismissed: 0,
    totalSkipped: 0
  });

  const SETTING_KEYS = Object.freeze(Object.keys(DEFAULT_SETTINGS));
  const STAT_KEYS = Object.freeze(Object.keys(DEFAULT_STATS));

  const COOLDOWN_MS = Object.freeze({
    intro: 3000,
    recap: 3000,
    credits: 15000,
    prompt: 4000
  });

  const ACTION_TYPES = Object.freeze(['intro', 'recap', 'credits', 'prompt']);

  return {
    DEFAULT_SETTINGS,
    DEFAULT_STATS,
    SETTING_KEYS,
    STAT_KEYS,
    COOLDOWN_MS,
    ACTION_TYPES
  };
});
