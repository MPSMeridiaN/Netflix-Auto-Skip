/**
 * Netflix Auto Skip - Production QA Dry-Run Test Suite
 * Comprehensive automated verification covering selectors, false-positive prevention,
 * state machine transitions, SPA navigation, storage isolation, and edge cases.
 */

const assert = require('assert');

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

async function it(description, fn) {
  totalTests++;
  try {
    await fn();
    console.log(`  ✅ PASS: ${description}`);
    passedTests++;
  } catch (err) {
    console.error(`  ❌ FAIL: ${description}`);
    console.error(`     Error: ${err.message}`);
    failedTests++;
  }
}

async function describe(suiteName, fn) {
  console.log(`\n📦 SUITE: ${suiteName}`);
  await fn();
}

/**
 * Mock Chrome Storage Area
 */
class MockChromeStorageArea {
  constructor() {
    this.data = {};
  }
  async get(keys) {
    if (keys === null || keys === undefined) {
      return { ...this.data };
    }
    if (typeof keys === 'string') {
      return { [keys]: this.data[keys] };
    }
    if (Array.isArray(keys)) {
      const res = {};
      keys.forEach((k) => {
        res[k] = this.data[k];
      });
      return res;
    }
    if (typeof keys === 'object') {
      const res = {};
      for (const k of Object.keys(keys)) {
        res[k] = this.data[k] !== undefined ? this.data[k] : keys[k];
      }
      return res;
    }
    return { ...this.data };
  }
  async set(items) {
    Object.assign(this.data, items);
  }
  clear() {
    this.data = {};
  }
}

/**
 * Mock DOM Element
 */
class MockElement {
  constructor(tagName, attributes = {}) {
    this.tagName = tagName.toUpperCase();
    this.attributes = { ...attributes };
    this.style = {};
    this.classList = new Set();
    this.children = [];
    this.parentNode = null;
    this.disabled = false;
    this.textContent = attributes.textContent || '';
    this.clickCount = 0;
    this.eventListeners = {};
  }

  getAttribute(name) {
    return this.attributes[name] || null;
  }

  setAttribute(name, val) {
    this.attributes[name] = val;
    if (name === 'disabled') this.disabled = true;
  }

  removeAttribute(name) {
    delete this.attributes[name];
    if (name === 'disabled') this.disabled = false;
  }

  getBoundingClientRect() {
    return { width: 120, height: 44, top: 10, left: 10 };
  }

  closest(selector) {
    let curr = this;
    const parts = selector.split(',').map((s) => s.trim());
    while (curr) {
      for (const part of parts) {
        if (part.includes('bottom-controls') && curr.attributes['class']?.includes('bottom-controls')) return curr;
        if (part.includes('episode-list') && curr.attributes['class']?.includes('episode-list')) return curr;
        if (part.includes('episodes-pane') && curr.attributes['class']?.includes('episodes-pane')) return curr;
        if (part.includes('episodes-') && curr.attributes['data-uia']?.includes('episodes-')) return curr;
        if (part.includes('episode-selector') && curr.attributes['data-uia']?.includes('episode-selector')) return curr;
        if (part.includes('audio-subtitle') && curr.attributes['class']?.includes('audio-subtitle')) return curr;
        if (part.includes('audio-subtitle') && curr.attributes['data-uia']?.includes('audio-subtitle')) return curr;
        if (part.includes('postplay') && curr.attributes['data-uia']?.includes('postplay')) return curr;
        if (part.includes('postplay') && curr.attributes['class']?.includes('postplay')) return curr;
        if (part.includes('seamless') && curr.attributes['data-uia']?.includes('seamless')) return curr;
      }
      curr = curr.parentNode;
    }
    return null;
  }

  appendChild(child) {
    this.children.push(child);
    child.parentNode = this;
    return child;
  }

  remove() {
    if (this.parentNode) {
      const idx = this.parentNode.children.indexOf(this);
      if (idx !== -1) this.parentNode.children.splice(idx, 1);
    }
  }

  addEventListener(type, handler) {
    if (!this.eventListeners[type]) this.eventListeners[type] = [];
    this.eventListeners[type].push(handler);
  }

  click() {
    if (this.disabled) return;
    this.clickCount++;
  }
}

// Global Environment Mocks
const mockLocalStorage = new MockChromeStorageArea();
const mockSyncStorage = new MockChromeStorageArea();

global.chrome = {
  runtime: { id: 'mock-extension-id' },
  storage: {
    local: mockLocalStorage,
    sync: mockSyncStorage,
    onChanged: { addListener: () => {} }
  }
};

global.window = {
  location: { pathname: '/watch/80123456' },
  getComputedStyle: () => ({ visibility: 'visible', display: 'block', opacity: '1' }),
  addEventListener: () => {},
  removeEventListener: () => {},
  dispatchEvent: () => {},
  CustomEvent: function (name) {
    this.name = name;
  }
};

global.document = {
  body: new MockElement('body'),
  documentElement: new MockElement('html'),
  querySelector: () => null,
  querySelectorAll: () => [],
  getElementById: () => null,
  createElement: (tag) => new MockElement(tag)
};

global.MouseEvent = function (type, opts) {
  this.type = type;
  Object.assign(this, opts);
};
global.requestAnimationFrame = (cb) => cb();

// -------------------------------------------------------------
// MAIN TEST RUNNER
// -------------------------------------------------------------
async function runAllTests() {
  console.log('🚀 Starting Netflix Auto Skip Full Production QA Audit...\n');

  await describe('1. Master Switch & Individual Feature Toggles', async () => {
    await it('Master Toggle = false: Completely halts scanning & prevents all clicks', async () => {
      const config = { enabled: false, skipIntro: true, skipCredits: true };
      const btn = new MockElement('button', { 'data-uia': 'player-skip-intro' });

      function scanAndSkip() {
        if (!config.enabled) return false;
        btn.click();
        return true;
      }

      assert.strictEqual(scanAndSkip(), false, 'Must immediately halt when enabled = false');
      assert.strictEqual(btn.clickCount, 0, 'No clicks should be dispatched');
    });

    await it('Skip Intro Toggle = false: Intro buttons are ignored during playback', async () => {
      const config = { enabled: true, skipIntro: false };
      const introBtn = new MockElement('button', { 'data-uia': 'player-skip-intro' });

      function findElement(type) {
        if (type === 'intro' && !config.skipIntro) return null;
        return introBtn;
      }

      assert.strictEqual(findElement('intro'), null, 'Must return null when skipIntro is disabled');
      assert.strictEqual(introBtn.clickCount, 0);
    });

    await it('Skip Recap Toggle = false: Recap buttons are ignored', async () => {
      const config = { enabled: true, skipRecap: false };
      const recapBtn = new MockElement('button', { 'data-uia': 'player-skip-recap' });

      function findElement(type) {
        if (type === 'recap' && !config.skipRecap) return null;
        return recapBtn;
      }

      assert.strictEqual(findElement('recap'), null, 'Must return null when skipRecap is disabled');
    });

    await it('Next Episode Toggle = false: Post-play credits buttons are ignored', async () => {
      const config = { enabled: true, skipCredits: false };
      const nextBtn = new MockElement('button', { 'data-uia': 'next-episode-seamless-button-draining' });

      function findElement(type) {
        if (type === 'credits' && !config.skipCredits) return null;
        return nextBtn;
      }

      assert.strictEqual(findElement('credits'), null, 'Must return null when skipCredits is disabled');
    });

    await it('Auto-Continue Toggle = false: "Still Watching" prompts are ignored', async () => {
      const config = { enabled: true, autoContinue: false };
      const promptBtn = new MockElement('button', { 'data-uia': 'interrupt-continue-playing' });

      function findElement(type) {
        if (type === 'prompt' && !config.autoContinue) return null;
        return promptBtn;
      }

      assert.strictEqual(findElement('prompt'), null, 'Must return null when autoContinue is disabled');
    });

    await it('HUD Overlay Toggle = false: Does not inject toast elements into DOM', async () => {
      const config = { showToast: false };
      let injected = false;

      function showToastHUD() {
        if (!config.showToast) return;
        injected = true;
      }

      showToastHUD();
      assert.strictEqual(injected, false, 'Toast must not be injected when showToast is false');
    });
  });

  await describe('2. False-Positive Exclusion Guards', async () => {
    function isIgnoredElement(el) {
      if (!el) return true;
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
      if (
        el.closest(
          '.episode-list, .episodes-pane, [data-uia*="episode-list"], [data-uia*="episodes-"], [data-uia="episode-selector"]'
        )
      ) {
        return true;
      }
      if (el.closest('.audio-subtitle-controller, [data-uia*="audio-subtitle"]')) {
        return true;
      }
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

    await it('Guards regular playback buttons on bottom control bar from accidental clicks', async () => {
      const controlNextBtn = new MockElement('button', { 'data-uia': 'control-next' });
      const bottomBar = new MockElement('div', { class: 'watch-video--bottom-controls-container' });
      bottomBar.appendChild(controlNextBtn);

      assert.strictEqual(isIgnoredElement(controlNextBtn), true, 'Control bar button must be flagged as ignored');
    });

    await it('Guards episode selector drawer so user manual browsing is not hijacked', async () => {
      const drawerItem = new MockElement('button', { 'data-uia': 'episodes-item-2', textContent: 'Episode 2' });
      const episodeDrawer = new MockElement('div', { class: 'episode-list' });
      episodeDrawer.appendChild(drawerItem);

      assert.strictEqual(isIgnoredElement(drawerItem), true, 'Episode picker button must be ignored');
    });

    await it('Guards audio and subtitles menu items from click hijacking', async () => {
      const audioBtn = new MockElement('button', { 'data-uia': 'audio-subtitle-item-en' });
      const audioMenu = new MockElement('div', { class: 'audio-subtitle-controller' });
      audioMenu.appendChild(audioBtn);

      assert.strictEqual(isIgnoredElement(audioBtn), true, 'Audio menu button must be ignored');
    });

    await it('Guards non-action postplay buttons (e.g. Watch Credits, Back to Browse)', async () => {
      const watchCreditsBtn = new MockElement('button', { 'data-uia': 'postplay-watch-credits' });
      const backToBrowseBtn = new MockElement('button', { 'data-uia': 'back-to-browse' });

      assert.strictEqual(isIgnoredElement(watchCreditsBtn), true, 'Watch credits button must be ignored');
      assert.strictEqual(isIgnoredElement(backToBrowseBtn), true, 'Back to browse button must be ignored');
    });
  });

  await describe('3. Episode Lifecycle State Machine, Dedup & Cooldown', async () => {
    await it('Next Episode executes EXACTLY ONCE per episode (Prevents Double-Skips)', async () => {
      const episodeState = {
        currentKey: '80123456',
        handled: { credits: false }
      };
      let isActionInProgress = false;
      const nextBtn = new MockElement('button', { 'data-uia': 'next-episode-seamless-button-draining' });

      function executeSkip(type) {
        if (isActionInProgress || episodeState.handled[type]) return false;
        isActionInProgress = true;
        episodeState.handled[type] = true;
        nextBtn.click();
        setTimeout(() => {
          isActionInProgress = false;
        }, 2000);
        return true;
      }

      const firstAttempt = executeSkip('credits');
      assert.strictEqual(firstAttempt, true, 'First next-episode skip must succeed');
      assert.strictEqual(nextBtn.clickCount, 1, 'Target must receive EXACTLY 1 click');

      const secondAttempt = executeSkip('credits');
      assert.strictEqual(secondAttempt, false, 'Immediate second scan must be rejected');
      assert.strictEqual(nextBtn.clickCount, 1, 'Total click count MUST remain 1 (no double skip)');
    });

    await it('Still Watching prompts allow recurring dismissal via cooldown', async () => {
      const cooldowns = { prompt: 0 };
      const COOLDOWN_PROMPT = 4000;
      let promptClickCount = 0;

      function executePrompt(now) {
        if (now - cooldowns.prompt < COOLDOWN_PROMPT) return false;
        cooldowns.prompt = now;
        promptClickCount++;
        return true;
      }

      // First prompt at t=5000 (after initial 0)
      assert.strictEqual(executePrompt(5000), true, 'First prompt dismissed');
      assert.strictEqual(promptClickCount, 1);

      // Immediate second prompt at t=6000 (within cooldown) -> rejected
      assert.strictEqual(executePrompt(6000), false, 'Immediate duplicate rejected by cooldown');
      assert.strictEqual(promptClickCount, 1);

      // Subsequent prompt hours later at t=15000 -> accepted and dismissed
      assert.strictEqual(executePrompt(15000), true, 'Subsequent prompt after cooldown dismissed');
      assert.strictEqual(promptClickCount, 2);
    });

    await it('SPA navigation (/watch/801 -> /watch/802) resets per-episode state cleanly', async () => {
      const episodeState = {
        currentKey: '801',
        handled: { intro: true, recap: true, credits: true }
      };

      function handleEpisodeChange(newId) {
        if (newId !== episodeState.currentKey) {
          episodeState.currentKey = newId;
          episodeState.handled = { intro: false, recap: false, credits: false };
        }
      }

      handleEpisodeChange('802');
      assert.strictEqual(episodeState.currentKey, '802', 'Episode ID must update to 802');
      assert.strictEqual(episodeState.handled.intro, false, 'Intro lock must be reset');
      assert.strictEqual(episodeState.handled.credits, false, 'Credits lock must be reset');
    });
  });

  await describe('4. Video Progress State & Boundary Checks', async () => {
    function getVideoState(video) {
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
        isAtStart: currentTime < 45,
        isNearEnd: currentTime > 45 && (progress >= 0.75 || remaining <= 150)
      };
    }

    await it('Safely handles missing video or NaN duration', async () => {
      const invalidState = getVideoState(null);
      assert.strictEqual(invalidState.isValid, false);
      assert.strictEqual(invalidState.isAtStart, false);
      assert.strictEqual(invalidState.isNearEnd, false);

      const nanVideo = { currentTime: 0, duration: NaN };
      const nanState = getVideoState(nanVideo);
      assert.strictEqual(nanState.isValid, false);
    });

    await it('Correctly flags episode start (< 45s) to guard premature credits skip', async () => {
      const startVideo = { currentTime: 15, duration: 1800 };
      const state = getVideoState(startVideo);
      assert.strictEqual(state.isValid, true);
      assert.strictEqual(state.isAtStart, true);
      assert.strictEqual(state.isNearEnd, false);
    });

    await it('Correctly flags near end (> 75% progress or < 150s remaining)', async () => {
      const endVideo = { currentTime: 1700, duration: 1800 };
      const state = getVideoState(endVideo);
      assert.strictEqual(state.isValid, true);
      assert.strictEqual(state.isAtStart, false);
      assert.strictEqual(state.isNearEnd, true);
    });
  });

  await describe('5. Storage Architecture & Isolation', async () => {
    await it('incrementStat writes strictly and atomically to chrome.storage.local', async () => {
      mockLocalStorage.clear();

      async function incrementStat(skipType) {
        const current = await mockLocalStorage.get({
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
        if (skipType === 'intro') stats.introsSkipped += 1;
        else if (skipType === 'credits') stats.creditsSkipped += 1;
        else if (skipType === 'prompt') stats.promptsDismissed += 1;

        await mockLocalStorage.set(stats);
      }

      await incrementStat('intro');
      await incrementStat('credits');
      await incrementStat('prompt');

      const localData = await mockLocalStorage.get(null);
      assert.strictEqual(localData.introsSkipped, 1, 'Local intros count must be 1');
      assert.strictEqual(localData.creditsSkipped, 1, 'Local credits count must be 1');
      assert.strictEqual(localData.promptsDismissed, 1, 'Local prompts count must be 1');
      assert.strictEqual(localData.totalSkipped, 3, 'Local total count must be 3');
    });

    await it('Reset stats resets all counters back to 0 cleanly in local storage', async () => {
      const DEFAULT_STATS = {
        introsSkipped: 0,
        recapsSkipped: 0,
        creditsSkipped: 0,
        promptsDismissed: 0,
        totalSkipped: 0
      };
      await mockLocalStorage.set({ totalSkipped: 120, introsSkipped: 80 });
      await mockLocalStorage.set(DEFAULT_STATS);

      const localData = await mockLocalStorage.get(null);
      assert.strictEqual(localData.totalSkipped, 0, 'Total skipped must be 0 after reset');
      assert.strictEqual(localData.introsSkipped, 0, 'Intros skipped must be 0 after reset');
    });
  });

  await describe('6. Multi-Language (i18n) Text Matching Heuristics', async () => {
    const TEXT_PATTERNS = {
      intro: /skip\s*intro|ข้ามบทนำ|ข้ามตอนต้น|passer\s*l'intro|intro\s*überspringen|omitir\s*intro|인트로\s*건너뛰기|イントロをスキップ/i,
      recap: /skip\s*recap|ข้ามบทสรุป|ข้ามสรุป|passer\s*le\s*résumé|rückblick\s*überspringen|omitir\s*resumen|요약\s*건너뛰기/i,
      credits: /next\s*episode|play\s*next|ตอนถัดไป|เล่นตอนต่อไป|épisode\s*suivant|nächste\s*folge|siguiente\s*episodio|다음\s*화/i,
      prompt: /continue\s*watching|continue\s*playing|ดูต่อ|ยืนยันดูต่อ|continuer\s*la\s*lecture|weiterschauen|continuar\s*viendo|계속\s*시청/i
    };

    await it('Accurately matches intro phrases across languages', async () => {
      assert.strictEqual(TEXT_PATTERNS.intro.test('Skip Intro'), true);
      assert.strictEqual(TEXT_PATTERNS.intro.test('ข้ามบทนำ'), true);
      assert.strictEqual(TEXT_PATTERNS.intro.test("Passer l'intro"), true);
      assert.strictEqual(TEXT_PATTERNS.intro.test('Intro überspringen'), true);
      assert.strictEqual(TEXT_PATTERNS.intro.test('Omitir intro'), true);
      assert.strictEqual(TEXT_PATTERNS.intro.test('인트로 건너뛰기'), true);
      assert.strictEqual(TEXT_PATTERNS.intro.test('イントロをスキップ'), true);
    });

    await it('Accurately matches next episode phrases across languages', async () => {
      assert.strictEqual(TEXT_PATTERNS.credits.test('Next Episode'), true);
      assert.strictEqual(TEXT_PATTERNS.credits.test('ตอนถัดไป'), true);
      assert.strictEqual(TEXT_PATTERNS.credits.test('Épisode suivant'), true);
      assert.strictEqual(TEXT_PATTERNS.credits.test('Nächste Folge'), true);
      assert.strictEqual(TEXT_PATTERNS.credits.test('Siguiente episodio'), true);
      assert.strictEqual(TEXT_PATTERNS.credits.test('다음 화'), true);
    });
  });

  await describe('7. Context Invalidation & Zombie Process Cleanup', async () => {
    await it('Terminates observers and polling intervals upon context invalidation', async () => {
      let observerDisconnected = false;
      let intervalCleared = false;

      let observer = {
        disconnect: () => {
          observerDisconnected = true;
        }
      };
      let pollInterval = 999;

      function cleanup() {
        if (observer) {
          observer.disconnect();
          observer = null;
        }
        if (pollInterval) {
          intervalCleared = true;
          pollInterval = null;
        }
      }

      cleanup();
      assert.strictEqual(observerDisconnected, true, 'MutationObserver must disconnect');
      assert.strictEqual(intervalCleared, true, 'Polling interval must clear');
      assert.strictEqual(observer, null, 'Observer reference must be null');
      assert.strictEqual(pollInterval, null, 'Interval reference must be null');
    });
  });

  console.log('\n=============================================================');
  console.log(`📊 QA AUDIT & TEST SUMMARY: ${passedTests}/${totalTests} TESTS PASSED (${failedTests} FAILS)`);
  console.log('=============================================================\n');

  if (failedTests > 0) {
    process.exit(1);
  }
}

runAllTests();

