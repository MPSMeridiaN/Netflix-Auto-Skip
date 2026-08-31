/**
 * Netflix Auto Skip - Content Script
 * Resilient DOM observer with Episode Lifecycle State Machine.
 * Automatically skips Intros, Recaps, Post-play Credits / Next Episode countdowns,
 * and dismisses 'Still Watching' prompts quietly.
 */

(() => {
  'use strict';

  // Terminate any previous content script instance running in this tab
  window.dispatchEvent(new CustomEvent('nas:terminate_instance'));
  window.__netflixAutoSkipLoaded = true;

  /**
   * Validates if extension runtime context is active
   */
  function isContextAlive() {
    try {
      return Boolean(chrome && chrome.runtime && chrome.runtime.id);
    } catch {
      return false;
    }
  }

  // Active configuration state
  const config = {
    enabled: true,
    skipIntro: true,
    skipRecap: true,
    skipCredits: true,
    autoContinue: true,
    showToast: true
  };

  /**
   * Global action mutex to prevent duplicate clicks during DOM transitions
   */
  let isActionInProgress = false;

  /**
   * Episode Lifecycle State Machine
   * Tracks episode identity and prevents duplicate actions within the same episode
   */
  const episodeState = {
    currentKey: '',
    loadedAt: 0,
    handled: {
      intro: false,
      recap: false,
      credits: false
    }
  };

  // Cooldown tracker for click throttling (timestamp in ms)
  const cooldowns = {
    intro: 0,
    recap: 0,
    credits: 0,
    prompt: 0
  };

  const COOLDOWN_DURATIONS = {
    intro: 3000,
    recap: 3000,
    credits: 15000, // 15-second cooldown per next-episode trigger
    prompt: 4000    // 4-second cooldown for recurring 'still watching' prompts
  };

  let observer = null;
  let pollInterval = null;

  /**
   * Cleanly self-terminates observers and intervals if extension is reloaded or tab changes
   */
  function cleanup() {
    if (observer) {
      observer.disconnect();
      observer = null;
    }
    if (pollInterval) {
      clearInterval(pollInterval);
      pollInterval = null;
    }
    window.__netflixAutoSkipLoaded = false;
    window.removeEventListener('nas:terminate_instance', cleanup);
  }

  window.addEventListener('nas:terminate_instance', cleanup);

  /**
   * Checks if current page is an active Netflix video playback view
   */
  function isWatchPage() {
    return window.location.pathname.startsWith('/watch') || Boolean(document.querySelector('video'));
  }

  /**
   * Extracts clean Episode key (Watch ID + Title text) from Netflix SPA DOM
   */
  function getCurrentEpisodeKey() {
    const urlMatch = window.location.pathname.match(/\/watch\/(\d+)/);
    const watchId = urlMatch ? urlMatch[1] : window.location.pathname;

    const titleEl = document.querySelector('[data-uia="video-title"], .video-title, h4');
    const titleText = titleEl ? titleEl.textContent.trim() : '';

    return `${watchId}:${titleText}`;
  }

  /**
   * Detects SPA episode navigation and resets per-episode lifecycle
   */
  function checkAndHandleEpisodeChange() {
    const newKey = getCurrentEpisodeKey();
    if (newKey && newKey !== episodeState.currentKey) {
      episodeState.currentKey = newKey;
      episodeState.loadedAt = Date.now();
      episodeState.handled = {
        intro: false,
        recap: false,
        credits: false
      };
    }
  }

  // Intercept HTML5 History API for instant SPA navigation detection
  const originalPushState = history.pushState;
  history.pushState = function (...args) {
    originalPushState.apply(this, args);
    checkAndHandleEpisodeChange();
  };

  const originalReplaceState = history.replaceState;
  history.replaceState = function (...args) {
    originalReplaceState.apply(this, args);
    checkAndHandleEpisodeChange();
  };

  window.addEventListener('popstate', checkAndHandleEpisodeChange);

  // Load configuration from sync storage (with local fallback)
  async function loadConfig() {
    if (!isContextAlive()) {
      cleanup();
      return;
    }
    try {
      let stored = null;
      if (chrome.storage?.sync) {
        try {
          stored = await chrome.storage.sync.get(config);
        } catch {
          // Sync disabled or quota exceeded, fallback to local
        }
      }
      if (!stored && chrome.storage?.local) {
        stored = await chrome.storage.local.get(config);
      }
      if (stored) {
        Object.assign(config, stored);
      }
    } catch {
      // Suppress extension context invalidation
    }
  }

  // Real-time configuration synchronization
  if (isContextAlive() && chrome.storage?.onChanged) {
    chrome.storage.onChanged.addListener((changes) => {
      if (!isContextAlive()) {
        cleanup();
        return;
      }
      for (const [key, change] of Object.entries(changes)) {
        if (key in config) {
          config[key] = change.newValue;
        }
      }
    });
  }

  /**
   * Verified targeted selector mapping for Netflix player UI elements
   */
  const SELECTORS = {
    intro: [
      'button[data-uia="player-skip-intro"]',
      '[data-uia="skip-intro"]',
      'button.watch-video--skip-content-button[data-uia*="intro"]',
      'button.nf-flat-button[data-uia*="intro"]'
    ],
    recap: [
      'button[data-uia="player-skip-recap"]',
      'button[data-uia="player-skip-preplay"]',
      'button[data-uia="skip-recap"]',
      'button[data-uia="skip-preplay"]',
      'button.watch-video--skip-preplay-button'
    ],
    credits: [
      'button[data-uia="next-episode-seamless-button-draining"]',
      'button[data-uia="next-episode-seamless-button"]',
      'button[data-uia="postplay-stream-preview-play"]',
      'button[data-uia="postplay-stream-preview-seamless-next"]',
      'button[data-uia="play-next-button"]',
      '[data-uia="postplay-container"] button[data-uia*="play"]',
      '[data-uia="postplay-container"] button[data-uia*="next"]',
      '[data-uia="postplay-container"] button[data-uia*="seamless"]',
      '.watch-video--postplay-container button[data-uia*="play"]',
      '.watch-video--postplay-container button[data-uia*="next"]',
      '.watch-video--postplay-container button[data-uia*="seamless"]'
    ],
    prompt: [
      'button[data-uia="interrupt-continue-playing"]',
      'button[data-uia="player-autoplay-interrupter"]',
      '.interrupter-actions button[data-uia*="continue"]',
      '.interrupter-actions button'
    ]
  };

  /**
   * Multi-language regex patterns for fallback heuristic matching
   */
  const TEXT_PATTERNS = {
    intro: /skip\s*intro|ข้ามบทนำ|ข้ามตอนต้น|passer\s*l'intro|intro\s*überspringen|omitir\s*intro|인트로\s*건너뛰기|イントロをスキップ/i,
    recap: /skip\s*recap|ข้ามบทสรุป|ข้ามสรุป|passer\s*le\s*résumé|rückblick\s*überspringen|omitir\s*resumen|요약\s*건너뛰기/i,
    credits: /next\s*episode|play\s*next|ตอนถัดไป|เล่นตอนต่อไป|épisode\s*suivant|nächste\s*folge|siguiente\s*episodio|다음\s*화/i,
    prompt: /continue\s*watching|continue\s*playing|ดูต่อ|ยืนยันดูต่อ|continuer\s*la\s*lecture|weiterschauen|continuar\s*viendo|계속\s*시청/i
  };

  /**
   * SVG Icon definitions for toast HUD
   */
  const TOAST_ICONS = {
    intro: `<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><polygon points="4,4 14,12 4,20"></polygon><polygon points="12,4 22,12 12,20"></polygon></svg>`,
    recap: `<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><polygon points="20,4 10,12 20,20"></polygon><polygon points="12,4 2,12 12,20"></polygon></svg>`,
    credits: `<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><polygon points="5,4 15,12 5,20"></polygon><rect x="17" y="4" width="3" height="16" rx="1"></rect></svg>`,
    prompt: `<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><polygon points="6,4 20,12 6,20"></polygon></svg>`
  };

  /**
   * Identifies elements that should NEVER be clicked (controls, episode drawers, menus)
   */
  function isIgnoredElement(el) {
    if (!el) return true;

    // 1. Bottom playback control bar
    const uia = el.getAttribute('data-uia') || '';
    if (
      uia === 'control-next' ||
      uia === 'control-play-pause' ||
      uia === 'control-fullscreen-enter' ||
      uia === 'control-fullscreen-exit' ||
      uia === 'control-back10' ||
      uia === 'control-forward10'
    ) {
      return true;
    }
    if (
      el.closest(
        '.watch-video--bottom-controls-container, .PlayerControlsNeo__button-control-row, .PlayerControlsNeo__all-controls, .controls-container, [data-uia="controls-container"]'
      )
    ) {
      return true;
    }

    // 2. Episodes / Season selection drawer & panel
    if (
      el.closest(
        '.episode-list, .episodes-pane, [data-uia*="episode-list"], [data-uia*="episodes-"], [data-uia="episode-selector"]'
      )
    ) {
      return true;
    }

    // 3. Audio & Subtitles selector drawer
    if (el.closest('.audio-subtitle-controller, [data-uia*="audio-subtitle"]')) {
      return true;
    }

    // 4. Non-action postplay buttons (e.g., "Watch Credits", "Back to Browse")
    if (
      uia.includes('watch-credits') ||
      uia.includes('postplay-background') ||
      uia.includes('close') ||
      uia.includes('back-to-browse')
    ) {
      return true;
    }

    return false;
  }

  /**
   * Evaluates video playback progress
   */
  function getVideoState() {
    const video = document.querySelector('video');
    if (!video || !video.duration || isNaN(video.duration) || video.duration <= 0) {
      return { isValid: false, currentTime: 0, duration: 0, progress: 0, isAtStart: false, isNearEnd: false };
    }

    const currentTime = video.currentTime || 0;
    const duration = video.duration || 0;
    const progress = currentTime / duration;
    const remaining = duration - currentTime;

    return {
      isValid: true,
      currentTime,
      duration,
      progress,
      // First 45 seconds of episode
      isAtStart: currentTime < 45,
      // Near end: Video played past 75% OR within the last 150 seconds (and past first 45s)
      isNearEnd: currentTime > 45 && (progress >= 0.75 || remaining <= 150)
    };
  }

  /**
   * Checks if an element is visible and interactive in DOM with fast bailouts
   */
  function isElementVisible(el) {
    if (!el || el.disabled) return false;

    // Fast check via dimensions
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return false;

    // Check style only after dimensions confirm existence
    const style = window.getComputedStyle(el);
    return style.visibility !== 'hidden' && style.display !== 'none' && style.opacity !== '0';
  }

  /**
   * Dispatches a clean native click to trigger React synthetic event handlers
   */
  function performAtomicClick(el) {
    if (!el) return;
    try {
      if (typeof el.click === 'function') {
        el.click();
      } else {
        el.dispatchEvent(
          new MouseEvent('click', {
            bubbles: true,
            cancelable: true,
            composed: true,
            view: window
          })
        );
      }
    } catch (err) {
      console.warn('[Netflix Auto Skip] Click dispatch error:', err);
    }
  }

  /**
   * Finds matching button with strict multi-layer race-condition guards
   */
  function findElement(type) {
    // 1. Mutex / Per-Episode Guard: Once handled in this episode, never trigger again (except prompts)
    if (isActionInProgress) {
      return null;
    }
    if (type !== 'prompt' && episodeState.handled[type]) {
      return null;
    }

    const videoState = getVideoState();

    // 2. Credits / Next Episode Guards:
    if (type === 'credits') {
      // Must NOT be at episode start (< 45s)
      if (videoState.isValid && videoState.isAtStart) {
        return null;
      }
    }

    // 3. Intro / Recap Guards:
    if (type === 'intro' || type === 'recap') {
      // Intros & recaps only exist in the first half of an episode
      if (videoState.isValid && videoState.progress > 0.60) {
        return null;
      }
    }

    const selectors = SELECTORS[type] || [];
    for (const selector of selectors) {
      try {
        const elements = document.querySelectorAll(selector);
        for (const el of elements) {
          if (isIgnoredElement(el)) continue;
          if (!isElementVisible(el)) continue;

          // For credits, verify genuine postplay or countdown context
          if (type === 'credits') {
            const isSeamless = el.getAttribute('data-uia')?.includes('seamless');
            const isInPostplay = Boolean(
              el.closest('.watch-video--postplay-container, .postplay, [data-uia*="postplay"]')
            );
            if (!isSeamless && !isInPostplay && !videoState.isNearEnd) {
              continue;
            }
          }

          return el;
        }
      } catch {
        // Skip invalid selector syntax
      }
    }

    // Heuristic fallback (strictly excluding ignored controls and menus)
    const pattern = TEXT_PATTERNS[type];
    if (pattern) {
      if (type === 'credits') {
        const postplayContainer = document.querySelector(
          '.watch-video--postplay-container, .postplay, [data-uia*="postplay"], [data-uia*="seamless"]'
        );
        if (!postplayContainer && !videoState.isNearEnd) return null;
      }

      const buttons = document.querySelectorAll('button, [role="button"], a.nf-flat-button');
      for (const btn of buttons) {
        if (isIgnoredElement(btn)) continue;
        if (!isElementVisible(btn)) continue;

        if ((type === 'intro' || type === 'recap') && btn.closest('.watch-video--postplay-container')) {
          continue;
        }

        const text = btn.textContent || '';
        const aria = btn.getAttribute('aria-label') || '';
        const uia = btn.getAttribute('data-uia') || '';
        if (pattern.test(text) || pattern.test(aria) || pattern.test(uia)) {
          return btn;
        }
      }
    }

    return null;
  }

  /**
   * Displays on-screen HUD toast notification
   */
  function showToastHUD(title, subtitle, iconHtml) {
    if (!config.showToast) return;

    let container = document.getElementById('nas-hud-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'nas-hud-container';
      document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = 'nas-toast';
    toast.innerHTML = `
      <div class="nas-icon">${iconHtml}</div>
      <div class="nas-content">
        <div class="nas-title">${title}</div>
        <div class="nas-subtitle">${subtitle}</div>
      </div>
    `;

    container.appendChild(toast);

    // Trigger enter animation
    requestAnimationFrame(() => {
      toast.classList.add('nas-visible');
    });

    // Auto remove after 2.5s
    setTimeout(() => {
      toast.classList.remove('nas-visible');
      toast.classList.add('nas-hiding');
      setTimeout(() => {
        toast.remove();
      }, 300);
    }, 2500);
  }

  /**
   * Increments skip statistics in chrome.storage.local (single source of truth for stats)
   */
  async function incrementStat(skipType) {
    if (!isContextAlive() || !chrome.storage?.local) {
      return;
    }
    try {
      const current = await chrome.storage.local.get({
        introsSkipped: 0,
        recapsSkipped: 0,
        creditsSkipped: 0,
        promptsDismissed: 0,
        totalSkipped: 0
      });

      const stats = {
        introsSkipped: Number(current.introsSkipped) || 0,
        recapsSkipped: Number(current.recapsSkipped) || 0,
        creditsSkipped: Number(current.creditsSkipped) || 0,
        promptsDismissed: Number(current.promptsDismissed) || 0,
        totalSkipped: Number(current.totalSkipped) || 0
      };

      stats.totalSkipped += 1;

      if (skipType === 'intro') {
        stats.introsSkipped += 1;
      } else if (skipType === 'recap') {
        stats.recapsSkipped += 1;
      } else if (skipType === 'credits') {
        stats.creditsSkipped += 1;
      } else if (skipType === 'prompt') {
        stats.promptsDismissed += 1;
      }

      await chrome.storage.local.set(stats);
    } catch {
      // Gracefully suppress storage errors during tab navigation
    }
  }

  /**
   * Executes skip action with state machine locking, cooldown, and notification
   */
  function executeSkip(type, title, subtitle) {
    if (!isContextAlive()) {
      cleanup();
      return false;
    }

    if (isActionInProgress) {
      return false;
    }

    const now = Date.now();
    if (now - (cooldowns[type] || 0) < COOLDOWN_DURATIONS[type]) {
      return false;
    }

    const target = findElement(type);
    if (!target) return false;

    // Acquire global lock and update state
    isActionInProgress = true;
    if (type !== 'prompt') {
      episodeState.handled[type] = true;
    }
    cooldowns[type] = now;

    // 1. Record stats FIRST before click/navigation can tear down context
    incrementStat(type);

    // 2. Show on-screen toast HUD
    showToastHUD(title, subtitle, TOAST_ICONS[type]);

    // 3. Dispatch single atomic click
    performAtomicClick(target);

    // 4. Release global action lock after 2000ms
    setTimeout(() => {
      isActionInProgress = false;
    }, 2000);

    return true;
  }

  /**
   * Core scan cycle with SPA episode check
   */
  function scanAndSkip() {
    if (!isContextAlive()) {
      cleanup();
      return;
    }
    if (!config.enabled || isActionInProgress) return;

    // If not on watch page and no video player is present, skip heavy DOM scanning
    if (!isWatchPage()) return;

    // Check if SPA navigated to a new episode
    checkAndHandleEpisodeChange();

    // 1. Check Skip Intro (Priority 1)
    if (config.skipIntro) {
      if (executeSkip('intro', 'Skipped Intro', 'Netflix Auto Skip')) return;
    }

    // 2. Check Skip Recap (Priority 2)
    if (config.skipRecap) {
      if (executeSkip('recap', 'Skipped Recap', 'Netflix Auto Skip')) return;
    }

    // 3. Check Next Episode / Post-play Credits (Priority 3)
    if (config.skipCredits) {
      if (executeSkip('credits', 'Playing Next Episode', 'Netflix Auto Skip')) return;
    }

    // 4. Check "Still Watching?" Prompt
    if (config.autoContinue) {
      if (executeSkip('prompt', 'Auto-Confirmed Watching', 'Netflix Auto Skip')) return;
    }
  }

  // Throttled mutation handler
  let mutationScheduled = false;
  function handleMutations() {
    if (!isContextAlive()) {
      cleanup();
      return;
    }
    if (!isWatchPage() || mutationScheduled || isActionInProgress) return;
    mutationScheduled = true;
    requestAnimationFrame(() => {
      scanAndSkip();
      mutationScheduled = false;
    });
  }

  // Initialize Observer & Lifecycle
  async function init() {
    if (!isContextAlive()) return;

    await loadConfig();
    checkAndHandleEpisodeChange();

    // Initial check
    scanAndSkip();

    // Start MutationObserver for real-time reactivity
    observer = new MutationObserver(handleMutations);
    observer.observe(document.body || document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class', 'data-uia', 'style']
    });

    // Secondary fallback polling (every 1000ms)
    pollInterval = setInterval(scanAndSkip, 1000);
  }

  // Start initialization
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

