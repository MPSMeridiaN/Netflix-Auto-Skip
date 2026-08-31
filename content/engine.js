/**
 * Netflix Auto Skip - production playback engine.
 *
 * The engine is exposed as a small factory so the exact implementation used
 * by the browser content script can also be exercised with DOM fixtures in
 * automated QA. It has no DOM or Chrome API work at module load time.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(
      require('../shared/constants.js'),
      require('../shared/storage.js')
    );
  } else {
    root.NetflixAutoSkipEngine = factory(
      root.NetflixAutoSkipConstants,
      root.NetflixAutoSkipStorage
    );
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function (constants, storageModule) {
  if (!constants || !storageModule) {
    throw new Error('Netflix Auto Skip shared modules must load before the engine');
  }

  const { DEFAULT_SETTINGS, COOLDOWN_MS, ACTION_TYPES } = constants;
  const { createStorage } = storageModule;

  const TERMINATE_EVENT = 'nas:terminate_instance';
  const SINGLETON_KEY = '__netflixAutoSkipInstance';
  const LOADED_KEY = '__netflixAutoSkipLoaded';
  const ACTION_LOCK_MS = 2000;
  const SETTING_BY_ACTION = Object.freeze({
    intro: 'skipIntro',
    recap: 'skipRecap',
    credits: 'skipCredits',
    prompt: 'autoContinue'
  });

  const PLAYER_CONTEXT_SELECTOR = [
    '[data-uia="player"]',
    '[data-uia="video-player"]',
    '[data-uia="watch-video"]',
    '[data-uia*="player"]',
    '.watch-video',
    '[class*="watch-video"]',
    '.nf-player-container',
    '.NFPlayer'
  ].join(', ');

  const POSTPLAY_SELECTOR = [
    '.watch-video--postplay-container',
    '.postplay',
    '[data-uia*="postplay"]',
    '[data-uia*="seamless"]'
  ].join(', ');

  const PROMPT_SELECTOR = [
    '.interrupter-actions',
    '.interrupter',
    '[data-uia*="interrupter"]',
    '[role="dialog"]'
  ].join(', ');

  const IGNORED_REGION_SELECTOR = [
    '.watch-video--bottom-controls-container',
    '.PlayerControlsNeo__button-control-row',
    '.PlayerControlsNeo__all-controls',
    '.controls-container',
    '[data-uia="controls-container"]',
    '.episode-list',
    '.episodes-pane',
    '[data-uia*="episode-list"]',
    '[data-uia*="episodes-"]',
    '[data-uia="episode-selector"]',
    '.audio-subtitle-controller',
    '[data-uia*="audio-subtitle"]'
  ].join(', ');

  const CONTROL_UIA = new Set([
    'control-next',
    'control-play-pause',
    'control-fullscreen-enter',
    'control-fullscreen-exit',
    'control-back10',
    'control-forward10'
  ]);

  const SELECTORS = Object.freeze({
    intro: Object.freeze([
      'button[data-uia="player-skip-intro"]',
      '[data-uia="skip-intro"]',
      'button.watch-video--skip-content-button[data-uia*="intro"]',
      'button.nf-flat-button[data-uia*="intro"]'
    ]),
    recap: Object.freeze([
      'button[data-uia="player-skip-recap"]',
      'button[data-uia="player-skip-preplay"]',
      'button[data-uia="skip-recap"]',
      'button[data-uia="skip-preplay"]',
      'button.watch-video--skip-preplay-button'
    ]),
    credits: Object.freeze([
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
    ]),
    prompt: Object.freeze([
      'button[data-uia="interrupt-continue-playing"]',
      'button[data-uia="player-autoplay-interrupter"]',
      '.interrupter-actions button[data-uia*="continue"]',
      '.interrupter-actions button'
    ])
  });

  const TEXT_PATTERNS = Object.freeze({
    intro: /skip\s*intro|ข้ามบทนำ|ข้ามตอนต้น|passer\s*l'intro|intro\s*überspringen|omitir\s*intro|인트로\s*건너뛰기|イントロをスキップ/i,
    recap: /skip\s*recap|ข้ามบทสรุป|ข้ามสรุป|passer\s*le\s*résumé|rückblick\s*überspringen|omitir\s*resumen|요약\s*건너뛰기/i,
    credits: /next\s*episode|play\s*next|ตอนถัดไป|เล่นตอนต่อไป|épisode\s*suivant|nächste\s*folge|siguiente\s*episodio|다음\s*화/i,
    prompt: /continue\s*watching|continue\s*playing|ดูต่อ|ยืนยันดูต่อ|continuer\s*la\s*lecture|weiterschauen|continuar\s*viendo|계속\s*시청/i
  });

  const TOAST_ICONS = Object.freeze({
    intro: '<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><polygon points="4,4 14,12 4,20"></polygon><polygon points="12,4 22,12 12,20"></polygon></svg>',
    recap: '<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><polygon points="20,4 10,12 20,20"></polygon><polygon points="12,4 2,12 12,20"></polygon></svg>',
    credits: '<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><polygon points="5,4 15,12 5,20"></polygon><rect x="17" y="4" width="3" height="16" rx="1"></rect></svg>',
    prompt: '<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><polygon points="6,4 20,12 6,20"></polygon></svg>'
  });

  function createController(options) {
    const settings = options || {};
    const win = settings.window || (typeof window !== 'undefined' ? window : root);
    const doc = settings.document || (win && win.document);
    const chromeApi = settings.chrome || (typeof chrome !== 'undefined' ? chrome : null);
    const historyApi = settings.history || (win && win.history);
    const storage = settings.storage || createStorage(chromeApi);
    const logger = settings.logger || {
      warn: (...args) => {
        if (typeof console !== 'undefined' && console.warn) console.warn(...args);
      },
      error: (...args) => {
        if (typeof console !== 'undefined' && console.error) console.error(...args);
      }
    };

    const now = typeof settings.now === 'function' ? settings.now : () => Date.now();
    const setTimeoutFn = settings.setTimeout || (win && win.setTimeout) || (typeof setTimeout === 'function' ? setTimeout : null);
    const clearTimeoutFn = settings.clearTimeout || (win && win.clearTimeout) || (typeof clearTimeout === 'function' ? clearTimeout : null);
    const setIntervalFn = settings.setInterval || (win && win.setInterval) || (typeof setInterval === 'function' ? setInterval : null);
    const clearIntervalFn = settings.clearInterval || (win && win.clearInterval) || (typeof clearInterval === 'function' ? clearInterval : null);
    const rafFn = settings.requestAnimationFrame || (win && win.requestAnimationFrame);
    const cancelRafFn = settings.cancelAnimationFrame || (win && win.cancelAnimationFrame);
    const MutationObserverClass = settings.MutationObserver || (win && win.MutationObserver);

    const config = { ...DEFAULT_SETTINGS };
    const episodeState = {
      currentKey: null,
      loadedAt: 0,
      handled: {
        intro: false,
        recap: false,
        credits: false
      }
    };
    const cooldowns = {
      intro: null,
      recap: null,
      credits: null,
      prompt: null
    };

    let started = false;
    let stopped = true;
    let lifecycleToken = 0;
    let actionInProgress = false;
    let actionTimer = null;
    let playbackObserver = null;
    let activationObserver = null;
    let playbackRoot = null;
    let activeVideo = null;
    let pollInterval = null;
    let scheduledScan = null;
    let mutationScheduled = false;
    let domReadyListener = null;
    let terminationListener = null;
    let popstateListener = null;
    let hashchangeListener = null;
    let storageChangeListener = null;
    const historyOriginals = {};
    const historyWrappers = {};
    const ownedTimers = new Set();
    const ownedRafs = new Set();
    const mediaListeners = [];

    const api = {
      start,
      stop,
      scanAndSkip,
      executeSkip,
      findElement,
      getCurrentEpisodeKey,
      getVideoState,
      isWatchRoute,
      isPlaybackContext,
      getConfig: () => ({ ...config }),
      getState: () => ({
        currentKey: episodeState.currentKey,
        loadedAt: episodeState.loadedAt,
        handled: { ...episodeState.handled },
        cooldowns: { ...cooldowns },
        actionInProgress
      }),
      getDiagnostics: () => ({
        started: started && !stopped,
        actionInProgress,
        playbackObserverActive: Boolean(playbackObserver),
        activationObserverActive: Boolean(activationObserver),
        pollingActive: pollInterval !== null,
        historyPatched: Object.keys(historyWrappers).some((key) => historyApi && historyApi[key] === historyWrappers[key]),
        pendingTimers: ownedTimers.size,
        pendingAnimationFrames: ownedRafs.size
      })
    };

    function isCurrentInstance() {
      try {
        return Boolean(win && win[SINGLETON_KEY] === api);
      } catch {
        return false;
      }
    }

    function isContextAlive() {
      try {
        return Boolean(chromeApi && chromeApi.runtime && chromeApi.runtime.id);
      } catch {
        return false;
      }
    }

    function safeRemoveEventListener(target, type, listener) {
      if (target && listener && typeof target.removeEventListener === 'function') {
        try {
          target.removeEventListener(type, listener);
        } catch {
          // A page can replace DOM event methods. Teardown remains best effort.
        }
      }
    }

    function safeClearTimeout(id) {
      if (id !== null && id !== undefined && typeof clearTimeoutFn === 'function') {
        try {
          clearTimeoutFn(id);
        } catch {
          // Ignore teardown races.
        }
      }
      ownedTimers.delete(id);
    }

    function setOwnedTimeout(callback, delay) {
      if (typeof setTimeoutFn !== 'function') return null;
      let timerId = null;
      const wrapped = () => {
        ownedTimers.delete(timerId);
        if (!stopped) callback();
      };
      try {
        timerId = setTimeoutFn(wrapped, delay);
        ownedTimers.add(timerId);
        return timerId;
      } catch {
        return null;
      }
    }

    function scheduleFrame(callback) {
      let frameId = null;
      const frameCallback = () => {
        ownedRafs.delete(frameId);
        if (!stopped) callback();
      };
      try {
        if (typeof rafFn === 'function') {
          frameId = rafFn(frameCallback);
        } else if (typeof setTimeoutFn === 'function') {
          frameId = setTimeoutFn(frameCallback, 0);
        } else {
          return null;
        }
        ownedRafs.add(frameId);
        return frameId;
      } catch {
        return null;
      }
    }

    function cancelScheduledScan() {
      if (scheduledScan === null) return;
      if (typeof cancelRafFn === 'function') {
        try {
          cancelRafFn(scheduledScan);
        } catch {
          // Ignore teardown races.
        }
      } else if (typeof clearTimeoutFn === 'function') {
        try {
          clearTimeoutFn(scheduledScan);
        } catch {
          // Ignore teardown races.
        }
      }
      ownedRafs.delete(scheduledScan);
      scheduledScan = null;
      mutationScheduled = false;
    }

    function cancelActionLock() {
      if (actionTimer !== null) {
        safeClearTimeout(actionTimer);
        actionTimer = null;
      }
      actionInProgress = false;
    }

    function clearOwnedTimers() {
      for (const timerId of Array.from(ownedTimers)) safeClearTimeout(timerId);
      ownedTimers.clear();
      actionTimer = null;
    }

    function clearOwnedRafs() {
      for (const frameId of Array.from(ownedRafs)) {
        if (typeof cancelRafFn === 'function') {
          try {
            cancelRafFn(frameId);
          } catch {
            // Ignore teardown races.
          }
        } else if (typeof clearTimeoutFn === 'function') {
          try {
            clearTimeoutFn(frameId);
          } catch {
            // Ignore teardown races.
          }
        }
      }
      ownedRafs.clear();
      scheduledScan = null;
      mutationScheduled = false;
    }

    function getPathname() {
      try {
        return String((win && win.location && win.location.pathname) || '');
      } catch {
        return '';
      }
    }

    function getWatchRoute() {
      const pathname = getPathname();
      if (!/^\/watch(?:\/|$)/i.test(pathname)) return null;

      const match = pathname.match(/^\/watch\/([^/]+)/i);
      let identity = 'route';
      if (match && match[1]) {
        try {
          identity = decodeURIComponent(match[1]);
        } catch {
          identity = match[1];
        }
      }

      return {
        pathname,
        identityKey: `watch:${identity}`
      };
    }

    function isWatchRoute() {
      return Boolean(getWatchRoute());
    }

    function resetHandledState() {
      episodeState.handled = {
        intro: false,
        recap: false,
        credits: false
      };
    }

    function getCurrentEpisodeKey() {
      const route = getWatchRoute();
      return route ? route.identityKey : null;
    }

    function updateEpisodeIdentity() {
      const newKey = getCurrentEpisodeKey();
      if (newKey === episodeState.currentKey) return false;

      episodeState.currentKey = newKey;
      episodeState.loadedAt = newKey ? now() : 0;
      resetHandledState();
      cooldowns.intro = null;
      cooldowns.recap = null;
      cooldowns.credits = null;
      lifecycleToken += 1;
      cancelActionLock();
      return true;
    }

    function closest(element, selector) {
      if (!element || typeof element.closest !== 'function') return null;
      try {
        return element.closest(selector);
      } catch {
        return null;
      }
    }

    function getVideos() {
      if (!doc || typeof doc.querySelectorAll !== 'function') return [];
      try {
        return Array.from(doc.querySelectorAll('video'));
      } catch {
        return [];
      }
    }

    function isHidden(element) {
      if (!element) return true;
      try {
        if (element.hidden || element.getAttribute('aria-hidden') === 'true') return true;
        return Boolean(closest(element, '[aria-hidden="true"]'));
      } catch {
        return false;
      }
    }

    function findActiveVideo() {
      if (!isWatchRoute()) return null;

      // A video is considered playback evidence only when it belongs to a
      // recognized Netflix player context. Catalog previews are intentionally
      // excluded even if they are visible and have a non-zero duration.
      for (const video of getVideos()) {
        if (isHidden(video)) continue;
        if (closest(video, PLAYER_CONTEXT_SELECTOR)) return video;
      }
      return null;
    }

    function isPlaybackContext() {
      return Boolean(findActiveVideo());
    }

    function getVideoState(videoOverride) {
      const video = videoOverride || findActiveVideo();
      const duration = Number(video && video.duration);
      if (!video || !Number.isFinite(duration) || duration <= 0) {
        return {
          isValid: false,
          currentTime: 0,
          duration: 0,
          progress: 0,
          isAtStart: false,
          isNearEnd: false
        };
      }

      const rawCurrentTime = Number(video.currentTime);
      const currentTime = Number.isFinite(rawCurrentTime)
        ? Math.max(0, Math.min(rawCurrentTime, duration))
        : 0;
      const progress = currentTime / duration;
      const remaining = duration - currentTime;

      return {
        isValid: true,
        currentTime,
        duration,
        progress,
        isAtStart: currentTime < 45,
        isNearEnd: currentTime > 45 && (progress >= 0.75 || remaining <= 150)
      };
    }

    function isConnected(element) {
      if (!element) return false;
      try {
        if (element.isConnected === false) return false;
        const rootElement = doc && doc.documentElement;
        if (rootElement && typeof rootElement.contains === 'function') {
          return rootElement.contains(element);
        }
      } catch {
        return false;
      }
      return true;
    }

    function isElementVisible(element) {
      if (!element) return false;
      try {
        if (element.disabled || element.hidden || getAttribute(element, 'aria-disabled') === 'true') return false;
        if (getAttribute(element, 'aria-hidden') === 'true') return false;
        if (closest(element, '[aria-hidden="true"]')) return false;

        if (typeof element.getBoundingClientRect === 'function') {
          const rect = element.getBoundingClientRect();
          if (!rect || rect.width === 0 || rect.height === 0) return false;
        }

        if (win && typeof win.getComputedStyle === 'function') {
          const style = win.getComputedStyle(element);
          if (style.visibility === 'hidden' || style.display === 'none' || style.opacity === '0') return false;
        }
        return true;
      } catch {
        return false;
      }
    }

    function getAttribute(element, name) {
      try {
        return element && typeof element.getAttribute === 'function'
          ? element.getAttribute(name) || ''
          : '';
      } catch {
        return '';
      }
    }

    function isIgnoredElement(element) {
      if (!element) return true;

      const uia = getAttribute(element, 'data-uia').toLowerCase();
      if (CONTROL_UIA.has(uia)) return true;
      if (closest(element, IGNORED_REGION_SELECTOR)) return true;

      if (
        uia.includes('watch-credits') ||
        uia.includes('postplay-background') ||
        uia.includes('back-to-browse') ||
        /^close(?:-|$)/.test(uia) ||
        /^dismiss(?:-|$)/.test(uia)
      ) {
        return true;
      }

      return false;
    }

    function hasPostplayContext(element) {
      if (closest(element, POSTPLAY_SELECTOR)) return true;
      const uia = getAttribute(element, 'data-uia').toLowerCase();
      return uia.includes('postplay') || uia.includes('seamless') || uia.includes('next-episode');
    }

    function hasPromptContext(element) {
      return Boolean(closest(element, PROMPT_SELECTOR));
    }

    function isInPlayerContext(element) {
      // The broad player data-uia fallback can also match a control's own
      // `player-*` identifier. Check ancestors so a button cannot certify
      // itself as the player context.
      return Boolean(element && closest(element.parentElement, PLAYER_CONTEXT_SELECTOR));
    }

    function isCandidateAllowed(type, element, videoState, allowGeneric) {
      if (!isConnected(element) || isIgnoredElement(element) || !isElementVisible(element)) return false;

      if ((type === 'intro' || type === 'recap') && !isInPlayerContext(element)) return false;
      if (type === 'prompt' && !isInPlayerContext(element) && !hasPromptContext(element)) return false;
      if (type === 'credits' && !isInPlayerContext(element) && !hasPostplayContext(element)) return false;
      if ((type === 'intro' || type === 'recap') && hasPostplayContext(element)) return false;

      if (type === 'credits') {
        if (!videoState.isValid || videoState.isAtStart) return false;
        if (!videoState.isNearEnd && !hasPostplayContext(element)) return false;
      }

      if (!allowGeneric) return true;
      if (type === 'intro' || type === 'recap') return isInPlayerContext(element);
      if (type === 'credits') return hasPostplayContext(element);
      if (type === 'prompt') return hasPromptContext(element);
      return false;
    }

    function queryAll(selector) {
      if (!doc || typeof doc.querySelectorAll !== 'function') return [];
      try {
        return Array.from(doc.querySelectorAll(selector));
      } catch {
        return [];
      }
    }

    function elementText(element) {
      return [
        element && element.textContent,
        getAttribute(element, 'aria-label'),
        getAttribute(element, 'data-uia')
      ].filter(Boolean).join(' ');
    }

    function findElement(type) {
      if (!ACTION_TYPES.includes(type) || actionInProgress || !isPlaybackContext()) return null;
      if (type !== 'prompt' && episodeState.handled[type]) return null;

      const videoState = getVideoState();
      if (type === 'credits' && videoState.isValid && videoState.isAtStart) return null;
      if ((type === 'intro' || type === 'recap') && videoState.isValid && videoState.progress > 0.60) return null;

      // Explicit Netflix selectors are the high-confidence path.
      for (const selector of SELECTORS[type]) {
        for (const element of queryAll(selector)) {
          if (isCandidateAllowed(type, element, videoState, false)) return element;
        }
      }

      // Text matching is deliberately last-resort and requires a contextual
      // container in addition to route, player, visibility, and progress checks.
      const pattern = TEXT_PATTERNS[type];
      if (!pattern) return null;
      for (const element of queryAll('button, [role="button"], a.nf-flat-button')) {
        if (!isCandidateAllowed(type, element, videoState, true)) continue;
        if (pattern.test(elementText(element))) return element;
      }

      return null;
    }

    function addClass(element, className) {
      try {
        if (element.classList && typeof element.classList.add === 'function') element.classList.add(className);
      } catch {
        // Toast UI is non-critical.
      }
    }

    function removeClass(element, className) {
      try {
        if (element.classList && typeof element.classList.remove === 'function') element.classList.remove(className);
      } catch {
        // Toast UI is non-critical.
      }
    }

    function removeElement(element) {
      try {
        if (element && typeof element.remove === 'function') element.remove();
        else if (element && element.parentNode && typeof element.parentNode.removeChild === 'function') {
          element.parentNode.removeChild(element);
        }
      } catch {
        // Toast UI is non-critical.
      }
    }

    function showToastHUD(title, subtitle, iconHtml) {
      if (!config.showToast || !doc || !doc.body || typeof doc.createElement !== 'function') return;

      try {
        let container = typeof doc.getElementById === 'function'
          ? doc.getElementById('nas-hud-container')
          : null;
        if (!container) {
          container = doc.createElement('div');
          container.id = 'nas-hud-container';
          doc.body.appendChild(container);
        }

        const toast = doc.createElement('div');
        toast.className = 'nas-toast';

        const icon = doc.createElement('div');
        icon.className = 'nas-icon';
        icon.innerHTML = iconHtml;

        const content = doc.createElement('div');
        content.className = 'nas-content';
        const titleElement = doc.createElement('div');
        titleElement.className = 'nas-title';
        titleElement.textContent = title;
        const subtitleElement = doc.createElement('div');
        subtitleElement.className = 'nas-subtitle';
        subtitleElement.textContent = subtitle;

        content.appendChild(titleElement);
        content.appendChild(subtitleElement);
        toast.appendChild(icon);
        toast.appendChild(content);
        container.appendChild(toast);

        scheduleFrame(() => addClass(toast, 'nas-visible'));
        const hideTimer = setOwnedTimeout(() => {
          removeClass(toast, 'nas-visible');
          addClass(toast, 'nas-hiding');
          setOwnedTimeout(() => removeElement(toast), 300);
        }, 2500);
        void hideTimer;
      } catch (error) {
        logger.warn('[Netflix Auto Skip] Toast rendering error:', error);
      }
    }

    function performAtomicClick(element) {
      if (!element) return false;
      try {
        if (typeof element.click === 'function') {
          element.click();
          return true;
        }
        if (typeof element.dispatchEvent === 'function' && win && typeof win.MouseEvent === 'function') {
          element.dispatchEvent(new win.MouseEvent('click', {
            bubbles: true,
            cancelable: true,
            composed: true,
            view: win
          }));
          return true;
        }
      } catch (error) {
        logger.warn('[Netflix Auto Skip] Click dispatch error:', error);
      }
      return false;
    }

    async function recordStat(type) {
      try {
        if (storage && typeof storage.incrementStat === 'function') {
          return await storage.incrementStat(type);
        }
      } catch {
        // Statistics are best effort and must not block playback automation.
      }
      return false;
    }

    function isCoolingDown(type, timestamp) {
      const lastAction = cooldowns[type];
      if (lastAction === null || lastAction === undefined) return false;
      const elapsed = timestamp - lastAction;
      return elapsed >= 0 && elapsed < COOLDOWN_MS[type];
    }

    async function executeSkip(type, title, subtitle) {
      if (!ACTION_TYPES.includes(type) || stopped || !isCurrentInstance()) return false;
      if (!isContextAlive()) {
        stop('context-invalidated');
        return false;
      }

      updateEpisodeIdentity();
      if (
        !episodeState.currentKey ||
        !config.enabled ||
        !config[SETTING_BY_ACTION[type]] ||
        !isPlaybackContext() ||
        actionInProgress
      ) return false;

      const timestamp = now();
      if (isCoolingDown(type, timestamp)) return false;

      const target = findElement(type);
      if (!target) return false;

      const actionKey = episodeState.currentKey;
      const actionLifecycle = lifecycleToken;
      actionInProgress = true;
      if (type !== 'prompt') episodeState.handled[type] = true;
      cooldowns[type] = timestamp;

      let clicked = false;
      try {
        // Persist before the native click so navigation cannot discard the
        // counter write. The action lock prevents another scan meanwhile.
        await recordStat(type);

        if (
          stopped ||
          !isCurrentInstance() ||
          !isContextAlive() ||
          !config.enabled ||
          !config[SETTING_BY_ACTION[type]] ||
          lifecycleToken !== actionLifecycle ||
          episodeState.currentKey !== actionKey ||
          !isPlaybackContext()
        ) {
          return false;
        }

        const currentVideoState = getVideoState();
        if (!isCandidateAllowed(type, target, currentVideoState, false)) return false;

        showToastHUD(title, subtitle, TOAST_ICONS[type]);
        clicked = performAtomicClick(target);
        return clicked;
      } finally {
        if (!clicked) {
          if (episodeState.currentKey === actionKey && lifecycleToken === actionLifecycle) {
            if (type !== 'prompt') episodeState.handled[type] = false;
            cooldowns[type] = null;
          }
          cancelActionLock();
        } else if (episodeState.currentKey === actionKey && lifecycleToken === actionLifecycle && !stopped) {
          actionTimer = setOwnedTimeout(() => {
            actionInProgress = false;
            actionTimer = null;
          }, ACTION_LOCK_MS);
        } else {
          cancelActionLock();
        }
      }
    }

    async function scanAndSkip() {
      if (stopped || !isCurrentInstance()) return false;
      if (!isContextAlive()) {
        stop('context-invalidated');
        return false;
      }

      updateEpisodeIdentity();
      if (!config.enabled) {
        stopPlaybackMonitoring();
        return false;
      }

      if (!isPlaybackContext()) {
        ensurePlaybackMonitoring();
        return false;
      }

      if (actionInProgress) return false;

      const actions = [
        ['skipIntro', 'intro', 'Skipped Intro', 'Netflix Auto Skip'],
        ['skipRecap', 'recap', 'Skipped Recap', 'Netflix Auto Skip'],
        ['skipCredits', 'credits', 'Playing Next Episode', 'Netflix Auto Skip'],
        ['autoContinue', 'prompt', 'Auto-Confirmed Watching', 'Netflix Auto Skip']
      ];

      for (const [settingKey, type, title, subtitle] of actions) {
        if (!config[settingKey]) continue;
        if (await executeSkip(type, title, subtitle)) return true;
      }
      return false;
    }

    function scheduleScan() {
      if (stopped || !isPlaybackContext()) return scheduledScan;
      if (scheduledScan !== null) return scheduledScan;
      scheduledScan = scheduleFrame(() => {
        scheduledScan = null;
        mutationScheduled = false;
        void scanAndSkip();
      });
      if (scheduledScan === null) mutationScheduled = false;
      return scheduledScan;
    }

    function detachMediaListeners() {
      for (const { target, type, listener } of mediaListeners.splice(0)) {
        safeRemoveEventListener(target, type, listener);
      }
      activeVideo = null;
    }

    function attachMediaListeners(video) {
      if (!video || typeof video.addEventListener !== 'function') return;
      if (activeVideo === video) return;
      detachMediaListeners();
      for (const type of ['loadedmetadata', 'durationchange', 'emptied']) {
        const listener = () => {
          if (!isCurrentInstance()) return;
          updateEpisodeIdentity();
          ensurePlaybackMonitoring();
          scheduleScan();
        };
        try {
          video.addEventListener(type, listener);
          mediaListeners.push({ target: video, type, listener });
        } catch {
          // Media event hooks are an optimization; polling remains available.
        }
      }
      activeVideo = video;
    }

    function getObservationRoot(video) {
      const playerRoot = closest(video, PLAYER_CONTEXT_SELECTOR);
      if (playerRoot) return playerRoot;
      return (video && video.parentElement) || (doc && (doc.body || doc.documentElement));
    }

    function stopPlaybackMonitoring() {
      if (playbackObserver) {
        try {
          playbackObserver.disconnect();
        } catch {
          // Ignore teardown races.
        }
        playbackObserver = null;
      }
      playbackRoot = null;
      if (pollInterval !== null && typeof clearIntervalFn === 'function') {
        try {
          clearIntervalFn(pollInterval);
        } catch {
          // Ignore teardown races.
        }
      }
      pollInterval = null;
      detachMediaListeners();
      cancelScheduledScan();
    }

    function stopActivationObserver() {
      if (!activationObserver) return;
      try {
        activationObserver.disconnect();
      } catch {
        // Ignore teardown races.
      }
      activationObserver = null;
    }

    function startActivationObserver() {
      if (activationObserver || !isWatchRoute() || !doc || !MutationObserverClass) return;
      const rootElement = doc.body || doc.documentElement;
      if (!rootElement) return;

      try {
        activationObserver = new MutationObserverClass(() => {
          if (!isCurrentInstance() || !isContextAlive()) {
            if (!isContextAlive()) stop('context-invalidated');
            return;
          }
          if (isPlaybackContext()) ensurePlaybackMonitoring();
        });
        activationObserver.observe(rootElement, {
          childList: true,
          subtree: true
        });
      } catch {
        activationObserver = null;
      }
    }

    function handleMutations() {
      if (!isCurrentInstance()) return;
      if (!isContextAlive()) {
        stop('context-invalidated');
        return;
      }
      if (!isPlaybackContext()) {
        ensurePlaybackMonitoring();
        return;
      }
      if (mutationScheduled || actionInProgress) return;
      mutationScheduled = true;
      scheduleScan();
    }

    function startPlaybackMonitoring() {
      const video = findActiveVideo();
      if (!video) return false;

      const rootElement = getObservationRoot(video);
      if (!rootElement) return false;
      stopActivationObserver();
      attachMediaListeners(video);

      if (!playbackObserver || playbackRoot !== rootElement) {
        if (playbackObserver) {
          try {
            playbackObserver.disconnect();
          } catch {
            // Ignore teardown races.
          }
        }
        playbackObserver = null;
        playbackRoot = rootElement;
        if (MutationObserverClass) {
          try {
            playbackObserver = new MutationObserverClass(handleMutations);
            playbackObserver.observe(rootElement, {
              childList: true,
              subtree: true,
              attributes: true,
              attributeFilter: ['class', 'data-uia', 'style', 'aria-hidden', 'disabled']
            });
          } catch {
            playbackObserver = null;
          }
        }
      }

      if (pollInterval === null && typeof setIntervalFn === 'function') {
        try {
          pollInterval = setIntervalFn(() => {
            if (!isCurrentInstance() || !isContextAlive()) {
              if (!isContextAlive()) stop('context-invalidated');
              return;
            }
            if (!isPlaybackContext()) {
              ensurePlaybackMonitoring();
              return;
            }
            void scanAndSkip();
          }, 1000);
        } catch {
          pollInterval = null;
        }
      }

      scheduleScan();
      return true;
    }

    function ensurePlaybackMonitoring() {
      if (stopped || !isCurrentInstance()) return;
      if (!config.enabled || !isWatchRoute()) {
        stopPlaybackMonitoring();
        stopActivationObserver();
        return;
      }

      if (!isPlaybackContext()) {
        stopPlaybackMonitoring();
        startActivationObserver();
        return;
      }

      startPlaybackMonitoring();
    }

    async function refreshSettings() {
      if (stopped || !isCurrentInstance()) return;
      try {
        const loaded = await storage.getSettings();
        if (loaded && typeof loaded === 'object') {
          for (const key of Object.keys(DEFAULT_SETTINGS)) {
            if (typeof loaded[key] === 'boolean') config[key] = loaded[key];
          }
        }
      } catch {
        // Defaults remain active if storage is unavailable.
      }
      if (!stopped && isCurrentInstance()) ensurePlaybackMonitoring();
    }

    function handleStorageChange(changes, areaName) {
      if (!isCurrentInstance()) return;
      if (!isContextAlive()) {
        stop('context-invalidated');
        return;
      }
      if (areaName !== 'sync' && areaName !== 'local') return;
      const hasSettingChange = Object.keys(DEFAULT_SETTINGS).some((key) => key in (changes || {}));
      if (hasSettingChange) void refreshSettings();
    }

    function installStorageListener() {
      const event = chromeApi && chromeApi.storage && chromeApi.storage.onChanged;
      if (!event || typeof event.addListener !== 'function') return;
      storageChangeListener = handleStorageChange;
      try {
        event.addListener(storageChangeListener);
      } catch {
        storageChangeListener = null;
      }
    }

    function installHistoryHooks() {
      if (!historyApi) return;
      for (const method of ['pushState', 'replaceState']) {
        if (typeof historyApi[method] !== 'function') continue;
        const original = historyApi[method];
        historyOriginals[method] = original;
        const wrapper = function (...args) {
          const result = original.apply(this, args);
          if (isCurrentInstance()) handleNavigation();
          return result;
        };
        historyWrappers[method] = wrapper;
        try {
          historyApi[method] = wrapper;
        } catch {
          delete historyOriginals[method];
          delete historyWrappers[method];
        }
      }
    }

    function restoreHistoryHooks() {
      if (!historyApi) return;
      for (const method of ['pushState', 'replaceState']) {
        if (!historyWrappers[method] || historyOriginals[method] === undefined) continue;
        try {
          if (historyApi[method] === historyWrappers[method]) historyApi[method] = historyOriginals[method];
        } catch {
          // Another owner may have replaced the method; never overwrite it.
        }
        delete historyOriginals[method];
        delete historyWrappers[method];
      }
    }

    function handleNavigation() {
      if (!isCurrentInstance()) return;
      updateEpisodeIdentity();
      ensurePlaybackMonitoring();
      scheduleScan();
    }

    function installNavigationListeners() {
      if (!win || typeof win.addEventListener !== 'function') return;
      popstateListener = handleNavigation;
      hashchangeListener = handleNavigation;
      terminationListener = () => stop('replaced');
      try {
        win.addEventListener('popstate', popstateListener);
        win.addEventListener('hashchange', hashchangeListener);
        win.addEventListener(TERMINATE_EVENT, terminationListener);
      } catch {
        // Teardown remains safe even if a host page wraps event APIs.
      }
    }

    function dispatchTerminationEvent() {
      try {
        if (win && typeof win.dispatchEvent === 'function' && typeof win.CustomEvent === 'function') {
          win.dispatchEvent(new win.CustomEvent(TERMINATE_EVENT));
        }
      } catch {
        // The singleton reference is the primary ownership mechanism.
      }
    }

    async function initialize() {
      if (stopped || !isCurrentInstance() || !isContextAlive()) return;
      await refreshSettings();
      if (stopped || !isCurrentInstance()) return;
      updateEpisodeIdentity();
      ensurePlaybackMonitoring();
      if (isPlaybackContext()) await scanAndSkip();
    }

    async function start() {
      if (started && !stopped) return api;
      if (!isContextAlive()) return api;

      const previous = win && win[SINGLETON_KEY];
      if (previous && previous !== api && typeof previous.stop === 'function') {
        try {
          previous.stop('replaced');
        } catch {
          // Continue; the explicit event below also handles older instances.
        }
      }
      dispatchTerminationEvent();

      started = true;
      stopped = false;
      lifecycleToken += 1;
      try {
        win[SINGLETON_KEY] = api;
        win[LOADED_KEY] = true;
      } catch {
        // Without a singleton owner we still run, but cannot coordinate a reload.
      }

      installNavigationListeners();
      installHistoryHooks();
      installStorageListener();

      if (doc && doc.readyState === 'loading' && typeof doc.addEventListener === 'function') {
        domReadyListener = () => {
          safeRemoveEventListener(doc, 'DOMContentLoaded', domReadyListener);
          domReadyListener = null;
          void initialize();
        };
        doc.addEventListener('DOMContentLoaded', domReadyListener);
      } else {
        await initialize();
      }
      return api;
    }

    function stop(reason) {
      void reason;
      if (!started || stopped) return;
      stopped = true;
      lifecycleToken += 1;
      safeRemoveEventListener(doc, 'DOMContentLoaded', domReadyListener);
      safeRemoveEventListener(win, 'popstate', popstateListener);
      safeRemoveEventListener(win, 'hashchange', hashchangeListener);
      safeRemoveEventListener(win, TERMINATE_EVENT, terminationListener);

      const changeEvent = chromeApi && chromeApi.storage && chromeApi.storage.onChanged;
      if (changeEvent && storageChangeListener && typeof changeEvent.removeListener === 'function') {
        try {
          changeEvent.removeListener(storageChangeListener);
        } catch {
          // Ignore teardown races.
        }
      }

      domReadyListener = null;
      popstateListener = null;
      hashchangeListener = null;
      terminationListener = null;
      storageChangeListener = null;

      stopPlaybackMonitoring();
      stopActivationObserver();
      cancelActionLock();
      clearOwnedTimers();
      clearOwnedRafs();
      restoreHistoryHooks();

      try {
        const current = win && win[SINGLETON_KEY] === api;
        if (current) {
          delete win[SINGLETON_KEY];
          win[LOADED_KEY] = false;
          const hud = doc && typeof doc.getElementById === 'function'
            ? doc.getElementById('nas-hud-container')
            : null;
          removeElement(hud);
        }
      } catch {
        // Teardown should never surface an extension error to Netflix.
      }
    }

    return api;
  }

  return {
    createController,
    SELECTORS,
    TEXT_PATTERNS,
    PLAYER_CONTEXT_SELECTOR,
    POSTPLAY_SELECTOR,
    PROMPT_SELECTOR
  };
});
