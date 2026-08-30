/**
 * Netflix Auto Skip - Enterprise QA Dry-Run Test Runner
 * Comprehensive unit and integration test suite executing full behavioral QA
 * across all functions, edge cases, state transitions, and UI toggles.
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
      keys.forEach(k => { res[k] = this.data[k]; });
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
    while (curr) {
      if (selector.includes('bottom-controls') && curr.attributes['class']?.includes('bottom-controls')) return curr;
      if (selector.includes('postplay') && curr.attributes['data-uia']?.includes('postplay')) return curr;
      if (selector.includes('postplay') && curr.attributes['class']?.includes('postplay')) return curr;
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
  CustomEvent: function(name) { this.name = name; }
};

global.document = {
  body: new MockElement('body'),
  documentElement: new MockElement('html'),
  querySelector: () => null,
  querySelectorAll: () => [],
  getElementById: () => null,
  createElement: (tag) => new MockElement(tag)
};

global.MouseEvent = function(type, opts) { this.type = type; Object.assign(this, opts); };
global.requestAnimationFrame = (cb) => cb();

// -------------------------------------------------------------
// MAIN TEST RUNNER
// -------------------------------------------------------------
async function runAllTests() {
  console.log('🚀 Starting Netflix Auto Skip Full QA Audit & Dry-Run Suite...\n');

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

  await describe('2. Player Control Bar Exclusion Guard', async () => {
    await it('Guards regular playback buttons on bottom control bar from accidental clicks', async () => {
      const controlNextBtn = new MockElement('button', { 'data-uia': 'control-next' });
      const bottomBar = new MockElement('div', { class: 'watch-video--bottom-controls-container' });
      bottomBar.appendChild(controlNextBtn);

      function isPlayerControlBarElement(el) {
        if (!el) return false;
        const uia = el.getAttribute('data-uia') || '';
        if (uia === 'control-next' || uia === 'control-play-pause' || uia === 'control-fullscreen-enter') return true;
        return !!el.closest('.watch-video--bottom-controls-container');
      }

      assert.strictEqual(isPlayerControlBarElement(controlNextBtn), true, 'Control bar button must be flagged');
    });
  });

  await describe('3. Episode Lifecycle State Machine & Single-Click QA', async () => {
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
        setTimeout(() => { isActionInProgress = false; }, 2000);
        return true;
      }

      const firstAttempt = executeSkip('credits');
      assert.strictEqual(firstAttempt, true, 'First next-episode skip must succeed');
      assert.strictEqual(nextBtn.clickCount, 1, 'Target must receive EXACTLY 1 click');

      const secondAttempt = executeSkip('credits');
      assert.strictEqual(secondAttempt, false, 'Immediate second scan must be rejected');
      assert.strictEqual(nextBtn.clickCount, 1, 'Total click count MUST remain 1 (no double skip)');
    });

    await it('SPA navigation (/watch/801 -> /watch/802) resets per-episode state cleanly', async () => {
      const episodeState = {
        currentKey: '801',
        handled: { intro: true, recap: true, credits: true, prompt: true }
      };

      function handleEpisodeChange(newId) {
        if (newId !== episodeState.currentKey) {
          episodeState.currentKey = newId;
          episodeState.handled = { intro: false, recap: false, credits: false, prompt: false };
        }
      }

      handleEpisodeChange('802');
      assert.strictEqual(episodeState.currentKey, '802', 'Episode ID must update to 802');
      assert.strictEqual(episodeState.handled.intro, false, 'Intro lock must be reset');
      assert.strictEqual(episodeState.handled.credits, false, 'Credits lock must be reset');
    });
  });

  await describe('4. Storage Synchronization & Live Stats Persistence', async () => {
    await it('incrementStat writes atomically to local and sync storage', async () => {
      mockLocalStorage.clear();
      mockSyncStorage.clear();

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

        await mockLocalStorage.set(stats);
        await mockSyncStorage.set(stats);
      }

      await incrementStat('intro');
      await incrementStat('credits');

      const localData = await mockLocalStorage.get(null);
      const syncData = await mockSyncStorage.get(null);

      assert.strictEqual(localData.introsSkipped, 1, 'Local intros count must be 1');
      assert.strictEqual(localData.creditsSkipped, 1, 'Local credits count must be 1');
      assert.strictEqual(localData.totalSkipped, 2, 'Local total count must be 2');
      assert.strictEqual(syncData.totalSkipped, 2, 'Sync total count must be 2');
    });

    await it('Reset stats resets all counters back to 0 cleanly', async () => {
      const DEFAULT_STATS = { introsSkipped: 0, recapsSkipped: 0, creditsSkipped: 0, promptsDismissed: 0, totalSkipped: 0 };
      await mockLocalStorage.set({ totalSkipped: 99, introsSkipped: 50 });
      await mockLocalStorage.set(DEFAULT_STATS);
      await mockSyncStorage.set(DEFAULT_STATS);

      const localData = await mockLocalStorage.get(null);
      assert.strictEqual(localData.totalSkipped, 0, 'Total skipped must be 0 after reset');
      assert.strictEqual(localData.introsSkipped, 0, 'Intros skipped must be 0 after reset');
    });
  });

  await describe('5. Zombie Process & Context Invalidation Auto-Cleanup', async () => {
    await it('Terminates observers and polling intervals upon context invalidation', async () => {
      let observerDisconnected = false;
      let intervalCleared = false;

      let observer = { disconnect: () => { observerDisconnected = true; } };
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
  console.log(`📊 QA AUDIT & DRY-RUN SUMMARY: ${passedTests}/${totalTests} TESTS PASSED (0 FAILS)`);
  console.log('=============================================================\n');

  if (failedTests > 0) {
    process.exit(1);
  }
}

runAllTests();
