/**
 * Netflix Auto Skip - Content Script
 * Highly optimized, zero-latency DOM observer for Netflix web player.
 * Automatically skips Intros, Recaps, Post-play Credits, and dismisses 'Still Watching' prompts.
 */

(() => {
  'use strict';

  // Prevent multiple injections
  if (window.__netflixAutoSkipLoaded) return;
  window.__netflixAutoSkipLoaded = true;

  // Active configuration state
  const config = {
    enabled: true,
    skipIntro: true,
    skipRecap: true,
    skipCredits: true,
    autoContinue: true,
    showToast: true,
    skipDelayMs: 0
  };

  // Cooldown tracker to prevent duplicate rapid clicks
  const cooldowns = {
    intro: 0,
    recap: 0,
    credits: 0,
    prompt: 0
  };

  const COOLDOWN_DURATIONS = {
    intro: 2500,
    recap: 2500,
    credits: 6000,
    prompt: 4000
  };

  // Load configuration from chrome storage
  async function loadConfig() {
    try {
      const storage = chrome.storage?.sync || chrome.storage?.local;
      if (storage) {
        const stored = await storage.get(config);
        Object.assign(config, stored);
      }
    } catch (err) {
      console.warn('[Netflix Auto Skip] Failed to load config:', err);
    }
  }

  // Listen for real-time configuration changes from popup
  if (chrome.storage?.onChanged) {
    chrome.storage.onChanged.addListener((changes) => {
      for (const [key, change] of Object.entries(changes)) {
        if (key in config) {
          config[key] = change.newValue;
        }
      }
    });
  }

  /**
   * Verified selector mapping for Netflix player UI elements
   */
  const SELECTORS = {
    intro: [
      'button[data-uia="player-skip-intro"]',
      '[data-uia="skip-intro"]',
      'button.watch-video--skip-content-button[data-uia*="intro"]',
      'button.watch-video--skip-content-button',
      'button.nf-flat-button[data-uia*="intro"]'
    ],
    recap: [
      'button[data-uia="player-skip-recap"]',
      'button[data-uia="player-skip-preplay"]',
      'button[data-uia="skip-recap"]',
      'button[data-uia="skip-preplay"]',
      'button.watch-video--skip-preplay-button'
    ],
    // Credits & Next Episode must ONLY target post-play countdown/overlay buttons
    credits: [
      'button[data-uia="next-episode-seamless-button"]',
      'button[data-uia="next-episode-seamless-button-draining"]',
      'button[data-uia="postplay-stream-preview-play"]',
      '[data-uia="postplay-container"] button[data-uia*="play"]',
      '.watch-video--postplay-container button',
      '.postplay-container button',
      '.postplay-still-container [role="button"]'
    ],
    prompt: [
      'button[data-uia="interrupt-continue-playing"]',
      'button[data-uia="player-autoplay-interrupter"]',
      '.interrupter-actions button'
    ]
  };

  /**
   * Multi-language regex patterns for text/aria-label heuristic matching
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
   * Determines if element belongs to regular bottom player controls
   * (We MUST NEVER click standard player control buttons during regular playback)
   */
  function isPlayerControlBarElement(el) {
    if (!el) return false;
    const uia = el.getAttribute('data-uia') || '';
    if (uia === 'control-next' || uia === 'control-play-pause' || uia === 'control-fullscreen-enter') {
      return true;
    }
    return !!el.closest(
      '.watch-video--bottom-controls-container, .PlayerControlsNeo__button-control-row, .PlayerControlsNeo__all-controls, .controls-container, [data-uia="controls-container"]'
    );
  }

  /**
   * Checks current video playback time to avoid false positives at episode start
   */
  function getVideoProgress() {
    const video = document.querySelector('video');
    if (!video || !video.duration || isNaN(video.duration)) {
      return { currentTime: 0, duration: 0, progress: 0, isAtStart: false, isNearEnd: false };
    }
    const progress = video.currentTime / video.duration;
    const remaining = video.duration - video.currentTime;
    return {
      currentTime: video.currentTime,
      duration: video.duration,
      progress,
      isAtStart: video.currentTime < 120, // First 2 minutes
      isNearEnd: progress >= 0.80 || remaining <= 180 // Last 3 minutes or >= 80%
    };
  }

  /**
   * Checks if an element is visible and interactive in DOM
   */
  function isElementVisible(el) {
    if (!el) return false;
    if (el.disabled) return false;
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return false;
    const style = window.getComputedStyle(el);
    return style.visibility !== 'hidden' && style.display !== 'none' && style.opacity !== '0';
  }

  /**
   * Simulates full mouse and pointer events for React compatibility
   */
  function simulateClick(el) {
    if (!el) return;
    try {
      const eventOptions = { bubbles: true, cancelable: true, view: window, buttons: 1 };
      
      el.dispatchEvent(new PointerEvent('pointerdown', eventOptions));
      el.dispatchEvent(new MouseEvent('mousedown', eventOptions));
      el.dispatchEvent(new PointerEvent('pointerup', eventOptions));
      el.dispatchEvent(new MouseEvent('mouseup', eventOptions));
      el.dispatchEvent(new MouseEvent('click', eventOptions));

      if (typeof el.click === 'function') {
        el.click();
      }
    } catch (err) {
      console.warn('[Netflix Auto Skip] Click dispatch error:', err);
    }
  }

  /**
   * Finds matching button with strict validation
   */
  function findElement(type) {
    const videoProgress = getVideoProgress();

    // Guard: NEVER trigger next episode if we are in the first 2 minutes of the video
    if (type === 'credits' && videoProgress.isAtStart) {
      return null;
    }

    const selectors = SELECTORS[type] || [];
    for (const selector of selectors) {
      try {
        const elements = document.querySelectorAll(selector);
        for (const el of elements) {
          if (!isElementVisible(el)) continue;
          if (isPlayerControlBarElement(el)) continue;

          // For credits, ensure postplay context or near end
          if (type === 'credits') {
            const isSeamless = el.getAttribute('data-uia')?.includes('seamless');
            const isInPostplay = !!el.closest('.watch-video--postplay-container, .postplay, [data-uia*="postplay"]');
            if (!isSeamless && !isInPostplay && !videoProgress.isNearEnd) {
              continue;
            }
          }

          return el;
        }
      } catch {
        // Skip invalid selector syntax if any
      }
    }

    // Heuristic fallback (strictly excluding bottom control bar)
    const pattern = TEXT_PATTERNS[type];
    if (pattern) {
      // For credits heuristic, strictly require postplay container or near video end
      if (type === 'credits' && !videoProgress.isNearEnd) {
        const postplayContainer = document.querySelector(
          '.watch-video--postplay-container, .postplay, [data-uia*="postplay"], [data-uia*="seamless"]'
        );
        if (!postplayContainer) return null;
      }

      const buttons = document.querySelectorAll('button, [role="button"], a.nf-flat-button');
      for (const btn of buttons) {
        if (!isElementVisible(btn)) continue;
        if (isPlayerControlBarElement(btn)) continue;

        // For intro/recap, ensure button is not in postplay
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
   * Directly increments skip stats in storage (Dispatched before click to prevent navigation drops)
   */
  async function incrementStat(skipType) {
    try {
      const storage = chrome.storage?.local || chrome.storage?.sync;
      if (!storage) return;

      const current = await storage.get({
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

      if (chrome.storage?.local) await chrome.storage.local.set(stats);
      if (chrome.storage?.sync) await chrome.storage.sync.set(stats);

      console.log(`[Netflix Auto Skip] Recorded ${skipType} skip. Total: ${stats.totalSkipped}`);
    } catch (err) {
      console.warn('[Netflix Auto Skip] Failed to increment stats:', err);
    }
  }

  /**
   * Executes skip action with cooldown and notification
   */
  function executeSkip(type, title, subtitle) {
    const now = Date.now();
    if (now - (cooldowns[type] || 0) < COOLDOWN_DURATIONS[type]) {
      return false;
    }

    const target = findElement(type);
    if (!target) return false;

    cooldowns[type] = now;

    const performClick = () => {
      // 1. Record stats FIRST before click/navigation can tear down context
      incrementStat(type);
      // 2. Show on-screen toast HUD
      showToastHUD(title, subtitle, TOAST_ICONS[type]);
      // 3. Dispatch click
      simulateClick(target);
    };

    if (config.skipDelayMs > 0) {
      setTimeout(performClick, config.skipDelayMs);
    } else {
      performClick();
    }

    return true;
  }

  /**
   * Core scan cycle
   */
  function scanAndSkip() {
    if (!config.enabled) return;

    // 1. Check Skip Intro (Priority 1)
    if (config.skipIntro) {
      if (executeSkip('intro', 'Skipped Intro', 'Netflix Auto Skip')) return;
    }

    // 2. Check Skip Recap (Priority 2)
    if (config.skipRecap) {
      if (executeSkip('recap', 'Skipped Recap', 'Netflix Auto Skip')) return;
    }

    // 3. Check Next Episode / Post-play Credits (Only near end or post-play countdown)
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
    if (mutationScheduled) return;
    mutationScheduled = true;
    requestAnimationFrame(() => {
      scanAndSkip();
      mutationScheduled = false;
    });
  }

  // Initialize Observer & Lifecycle
  async function init() {
    await loadConfig();

    // Initial check
    scanAndSkip();

    // Start MutationObserver for real-time reactivity
    const observer = new MutationObserver(handleMutations);
    observer.observe(document.body || document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class', 'data-uia', 'style']
    });

    // Secondary fallback polling (every 800ms) to ensure nothing is missed
    setInterval(scanAndSkip, 800);

    console.log('[Netflix Auto Skip] Content script active & monitoring Netflix player.');
  }

  // Start initialization
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
