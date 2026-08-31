/*
 * Production QA for Netflix Auto Skip.
 *
 * The fixtures below provide only browser primitives. All selector, route,
 * state, cooldown, action, and lifecycle assertions call content/engine.js,
 * which is the same module loaded by the extension's content bootstrap.
 */
'use strict';

const assert = require('assert');
const {
  createController,
  TEXT_PATTERNS
} = require('../content/engine.js');
const { createStorage } = require('../shared/storage.js');

class EventHub {
  constructor() {
    this.listeners = new Map();
  }

  addEventListener(type, listener) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type).add(listener);
  }

  removeEventListener(type, listener) {
    this.listeners.get(type)?.delete(listener);
  }

  dispatchEvent(event) {
    const listeners = Array.from(this.listeners.get(event.type) || []);
    for (const listener of listeners) listener.call(this, event);
    return true;
  }

  listenerCount(type) {
    return (this.listeners.get(type) || new Set()).size;
  }
}

class StorageEvent {
  constructor() {
    this.listeners = new Set();
  }

  addListener(listener) {
    this.listeners.add(listener);
  }

  removeListener(listener) {
    this.listeners.delete(listener);
  }

  emit(changes, areaName) {
    for (const listener of Array.from(this.listeners)) listener(changes, areaName);
  }

  get size() {
    return this.listeners.size;
  }
}

function splitSelectorList(selector) {
  const parts = [];
  let current = '';
  let depth = 0;
  let quote = null;

  for (const character of String(selector)) {
    if (quote) {
      current += character;
      if (character === quote) quote = null;
      continue;
    }
    if (character === '"' || character === "'") {
      quote = character;
      current += character;
    } else if (character === '[') {
      depth += 1;
      current += character;
    } else if (character === ']') {
      depth -= 1;
      current += character;
    } else if (character === ',' && depth === 0) {
      parts.push(current.trim());
      current = '';
    } else {
      current += character;
    }
  }
  if (current.trim()) parts.push(current.trim());
  return parts;
}

function matchesSimpleSelector(element, selector) {
  let token = selector.trim();
  if (!token || token === '*') return true;

  const tagMatch = token.match(/^([a-z][\w-]*)/i);
  if (tagMatch && element.tagName !== tagMatch[1].toUpperCase()) return false;
  if (tagMatch) token = token.slice(tagMatch[0].length);

  for (const id of token.matchAll(/#([\w-]+)/g)) {
    if (element.getAttribute('id') !== id[1]) return false;
  }
  for (const classMatch of token.matchAll(/\.([\w-]+)/g)) {
    if (!element.classList.contains(classMatch[1])) return false;
  }

  const attributePattern = /\[\s*([^\]=~*^$!]+?)\s*(?:(=|\*=|\^=|\$=|~=)\s*(?:"([^"]*)"|'([^']*)'|([^\]]*)))?\s*\]/g;
  let attributeMatch;
  while ((attributeMatch = attributePattern.exec(token))) {
    const name = attributeMatch[1].trim();
    const operator = attributeMatch[2];
    const expected = (attributeMatch[3] ?? attributeMatch[4] ?? attributeMatch[5] ?? '').trim();
    const actual = element.getAttribute(name);
    if (actual === null) return false;
    if (!operator) continue;
    if (operator === '=' && actual !== expected) return false;
    if (operator === '*=' && !actual.includes(expected)) return false;
    if (operator === '^=' && !actual.startsWith(expected)) return false;
    if (operator === '$=' && !actual.endsWith(expected)) return false;
    if (operator === '~=' && !actual.split(/\s+/).includes(expected)) return false;
  }

  const withoutAttributes = token.replace(attributePattern, '');
  return withoutAttributes.replace(/[#.][\w-]+/g, '').trim() === '';
}

function matchesSelector(element, selector) {
  const tokens = selector.trim().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return false;
  if (!matchesSimpleSelector(element, tokens[tokens.length - 1])) return false;

  let ancestor = element.parentNode;
  for (let index = tokens.length - 2; index >= 0; index -= 1) {
    while (ancestor && !matchesSimpleSelector(ancestor, tokens[index])) ancestor = ancestor.parentNode;
    if (!ancestor) return false;
    ancestor = ancestor.parentNode;
  }
  return true;
}

function matchesAnySelector(element, selector) {
  return splitSelectorList(selector).some((part) => matchesSelector(element, part));
}

class MockElement extends EventHub {
  constructor(tagName, attributes = {}) {
    super();
    this.tagName = tagName.toUpperCase();
    this.attributes = {};
    this.children = [];
    this.parentNode = null;
    this.disabled = false;
    this.hidden = false;
    this.clickCount = 0;
    this._textContent = '';
    this.innerHTML = '';
    this._className = '';
    this.classList = {
      add: (...names) => names.forEach((name) => this._classNameSet().add(name)),
      remove: (...names) => names.forEach((name) => this._classNameSet().delete(name)),
      contains: (name) => this._classNameSet().has(name),
      toggle: (name, force) => {
        const classes = this._classNameSet();
        const shouldAdd = force === undefined ? !classes.has(name) : Boolean(force);
        if (shouldAdd) classes.add(name); else classes.delete(name);
        return shouldAdd;
      }
    };

    for (const [name, value] of Object.entries(attributes)) this.setAttribute(name, value);
    if ('textContent' in attributes) this.textContent = attributes.textContent;
    if ('duration' in attributes) this.duration = attributes.duration;
    if ('currentTime' in attributes) this.currentTime = attributes.currentTime;
    if ('readyState' in attributes) this.readyState = attributes.readyState;
    if ('currentSrc' in attributes) this.currentSrc = attributes.currentSrc;
  }

  _classNameSet() {
    return new Set(this._className.split(/\s+/).filter(Boolean));
  }

  _syncClassName() {
    this._className = Array.from(this._classNameSet()).join(' ');
    this.attributes.class = this._className;
  }

  get className() {
    return this._className;
  }

  set className(value) {
    this._className = String(value || '');
    this.attributes.class = this._className;
  }

  get textContent() {
    return this._textContent + this.children.map((child) => child.textContent).join('');
  }

  set textContent(value) {
    this._textContent = String(value ?? '');
  }

  get parentElement() {
    return this.parentNode;
  }

  get isConnected() {
    return Boolean(this.parentNode);
  }

  setAttribute(name, value) {
    const normalized = String(name).toLowerCase();
    this.attributes[normalized] = String(value);
    if (normalized === 'class') this.className = value;
    if (normalized === 'disabled') this.disabled = true;
    if (normalized === 'hidden') this.hidden = true;
  }

  getAttribute(name) {
    const value = this.attributes[String(name).toLowerCase()];
    return value === undefined ? null : value;
  }

  removeAttribute(name) {
    const normalized = String(name).toLowerCase();
    delete this.attributes[normalized];
    if (normalized === 'disabled') this.disabled = false;
    if (normalized === 'hidden') this.hidden = false;
  }

  appendChild(child) {
    if (child.parentNode) child.parentNode.removeChild(child);
    this.children.push(child);
    child.parentNode = this;
    return child;
  }

  removeChild(child) {
    const index = this.children.indexOf(child);
    if (index >= 0) {
      this.children.splice(index, 1);
      child.parentNode = null;
    }
    return child;
  }

  remove() {
    if (this.parentNode) this.parentNode.removeChild(this);
  }

  contains(element) {
    if (element === this) return true;
    return this.children.some((child) => child.contains(element));
  }

  querySelectorAll(selector) {
    const matches = [];
    const visit = (node) => {
      for (const child of node.children) {
        if (matchesAnySelector(child, selector)) matches.push(child);
        visit(child);
      }
    };
    visit(this);
    return matches;
  }

  querySelector(selector) {
    return this.querySelectorAll(selector)[0] || null;
  }

  closest(selector) {
    let current = this;
    while (current) {
      if (matchesAnySelector(current, selector)) return current;
      current = current.parentNode;
    }
    return null;
  }

  getBoundingClientRect() {
    return { width: 100, height: 30 };
  }

  click() {
    if (this.disabled || this.getAttribute('aria-disabled') === 'true') return;
    this.clickCount += 1;
    this.dispatchEvent({ type: 'click', target: this });
  }
}

class MockDocument extends EventHub {
  constructor() {
    super();
    this.readyState = 'complete';
    this.documentElement = new MockElement('html');
    this.body = new MockElement('body');
    this.documentElement.appendChild(this.body);
  }

  createElement(tagName) {
    return new MockElement(tagName);
  }

  querySelectorAll(selector) {
    const matches = [];
    const visit = (node) => {
      for (const child of node.children) {
        if (matchesAnySelector(child, selector)) matches.push(child);
        visit(child);
      }
    };
    visit(this.documentElement);
    return matches;
  }

  querySelector(selector) {
    return this.querySelectorAll(selector)[0] || null;
  }

  getElementById(id) {
    return this.querySelector(`[id="${id}"]`);
  }
}

class MockHistory {
  constructor(windowObject) {
    this.windowObject = windowObject;
    this.pushCount = 0;
    this.replaceCount = 0;
  }

  _setPath(url) {
    if (typeof url !== 'string') return;
    this.windowObject.location.pathname = new URL(url, 'https://www.netflix.com').pathname;
  }

  pushState(_state, _title, url) {
    this.pushCount += 1;
    this._setPath(url);
  }

  replaceState(_state, _title, url) {
    this.replaceCount += 1;
    this._setPath(url);
  }
}

class MockWindow extends EventHub {
  constructor(document, pathname) {
    super();
    this.document = document;
    this.location = { pathname };
    this.history = new MockHistory(this);
    this.CustomEvent = class {
      constructor(type) {
        this.type = type;
      }
    };
    this.MouseEvent = class {
      constructor(type, options) {
        this.type = type;
        Object.assign(this, options);
      }
    };
    this.getComputedStyle = () => ({ visibility: 'visible', display: 'block', opacity: '1' });
  }
}

class MockMutationObserver {
  static instances = [];

  constructor(callback) {
    this.callback = callback;
    this.root = null;
    this.options = null;
    this.disconnectCount = 0;
    MockMutationObserver.instances.push(this);
  }

  observe(root, options) {
    this.root = root;
    this.options = options;
  }

  disconnect() {
    this.disconnectCount += 1;
    this.root = null;
  }

  trigger(records = []) {
    if (this.root) this.callback(records, this);
  }
}

class FakeTimers {
  constructor() {
    this.nextId = 1;
    this.timeouts = new Map();
    this.intervals = new Map();
  }

  setTimeout(callback, delay) {
    const id = this.nextId++;
    this.timeouts.set(id, { callback, delay });
    return id;
  }

  clearTimeout(id) {
    this.timeouts.delete(id);
  }

  setInterval(callback, delay) {
    const id = this.nextId++;
    this.intervals.set(id, { callback, delay });
    return id;
  }

  clearInterval(id) {
    this.intervals.delete(id);
  }

  runAll() {
    let guard = 0;
    while (this.timeouts.size > 0 && guard < 1000) {
      guard += 1;
      const [id, task] = this.timeouts.entries().next().value;
      this.timeouts.delete(id);
      task.callback();
    }
    assert.ok(guard < 1000, 'fake timer queue did not settle');
  }

  runIntervals() {
    for (const task of Array.from(this.intervals.values())) task.callback();
  }
}

class MockStorageArea {
  constructor(name, changeEvent) {
    this.name = name;
    this.changeEvent = changeEvent;
    this.data = {};
    this.failGet = false;
    this.failSet = false;
    this.getCalls = [];
    this.setCalls = [];
  }

  async get(keys) {
    this.getCalls.push(keys);
    if (this.failGet) throw new Error(`${this.name}.get failed`);
    if (keys === null || keys === undefined) return { ...this.data };
    if (typeof keys === 'string') return { [keys]: this.data[keys] };
    if (Array.isArray(keys)) return Object.fromEntries(keys.map((key) => [key, this.data[key]]));
    return { ...keys, ...this.data };
  }

  async set(items) {
    this.setCalls.push({ ...items });
    if (this.failSet) throw new Error(`${this.name}.set failed`);
    const changes = {};
    for (const [key, value] of Object.entries(items)) {
      if (this.data[key] !== value) changes[key] = { oldValue: this.data[key], newValue: value };
      this.data[key] = value;
    }
    if (Object.keys(changes).length > 0) this.changeEvent.emit(changes, this.name);
  }

  async remove(keys) {
    if (this.failSet) throw new Error(`${this.name}.remove failed`);
    const names = Array.isArray(keys) ? keys : [keys];
    for (const key of names) delete this.data[key];
  }
}

class MockChrome {
  constructor() {
    const changeEvent = new StorageEvent();
    this.runtime = { id: 'mock-extension-id' };
    this.storage = {
      sync: new MockStorageArea('sync', changeEvent),
      local: new MockStorageArea('local', changeEvent),
      onChanged: changeEvent
    };
  }
}

function createEnv(pathname = '/watch/80123456') {
  MockMutationObserver.instances = [];
  const document = new MockDocument();
  const window = new MockWindow(document, pathname);
  const chrome = new MockChrome();
  const timers = new FakeTimers();
  const clock = { value: 5000 };
  return { document, window, chrome, timers, clock };
}

function makeController(env, overrides = {}) {
  return createController({
    window: env.window,
    document: env.document,
    history: env.window.history,
    chrome: env.chrome,
    MutationObserver: MockMutationObserver,
    now: () => env.clock.value,
    setTimeout: env.timers.setTimeout.bind(env.timers),
    clearTimeout: env.timers.clearTimeout.bind(env.timers),
    setInterval: env.timers.setInterval.bind(env.timers),
    clearInterval: env.timers.clearInterval.bind(env.timers),
    requestAnimationFrame: env.timers.setTimeout.bind(env.timers),
    cancelAnimationFrame: env.timers.clearTimeout.bind(env.timers),
    logger: { warn() {}, error() {} },
    ...overrides
  });
}

function addElement(env, parent, tagName, attributes = {}) {
  const element = env.document.createElement(tagName);
  parent.appendChild(element);
  for (const [key, value] of Object.entries(attributes)) element.setAttribute(key, value);
  return element;
}

function addPlayback(env, currentTime = 30, duration = 1800) {
  const player = addElement(env, env.document.body, 'div', {
    class: 'watch-video',
    'data-uia': 'player'
  });
  const video = addElement(env, player, 'video', {});
  video.currentTime = currentTime;
  video.duration = duration;
  video.readyState = 4;
  video.currentSrc = 'https://cdn.netflix.test/episode.m4v';
  return { player, video };
}

function addButton(env, parent, attributes = {}, text = '') {
  const button = addElement(env, parent, 'button', attributes);
  button.textContent = text;
  return button;
}

async function withController(pathname, callback) {
  const env = createEnv(pathname);
  const controller = makeController(env);
  try {
    await callback(env, controller);
  } finally {
    controller.stop();
  }
}

let totalTests = 0;
let passedTests = 0;

async function it(description, test) {
  totalTests += 1;
  try {
    await test();
    passedTests += 1;
    console.log(`  ✅ PASS: ${description}`);
  } catch (error) {
    console.error(`  ❌ FAIL: ${description}`);
    console.error(`     ${error.stack || error.message}`);
  }
}

async function describe(name, tests) {
  console.log(`\n📦 SUITE: ${name}`);
  await tests();
}

async function runAllTests() {
  console.log('🚀 Starting production-code QA for Netflix Auto Skip...\n');

  await describe('1. Real engine settings and action execution', async () => {
    await it('Master switch disabled prevents production scanning and clicks', async () => {
      await withController('/watch/801', async (env, controller) => {
        env.chrome.storage.sync.data = { enabled: false };
        const { player } = addPlayback(env);
        const button = addButton(env, player, { 'data-uia': 'player-skip-intro' });
        await controller.start();
        assert.strictEqual(await controller.scanAndSkip(), false);
        assert.strictEqual(button.clickCount, 0);
      });
    });

    for (const [key, label, uia] of [
      ['skipIntro', 'intro', 'player-skip-intro'],
      ['skipRecap', 'recap', 'player-skip-recap'],
      ['skipCredits', 'credits', 'next-episode-seamless-button'],
      ['autoContinue', 'prompt', 'interrupt-continue-playing']
    ]) {
      await it(`${label} toggle disabled prevents its production action`, async () => {
        await withController('/watch/801', async (env, controller) => {
          env.chrome.storage.sync.data = { [key]: false };
          const { player } = addPlayback(env, label === 'credits' ? 1700 : 30);
          const parent = label === 'prompt'
            ? addElement(env, player, 'div', { class: 'interrupter-actions' })
            : player;
          const button = addButton(env, parent, { 'data-uia': uia }, label === 'prompt' ? 'Continue Watching' : '');
          await controller.start();
          assert.strictEqual(await controller.scanAndSkip(), false);
          assert.strictEqual(button.clickCount, 0);
        });
      });
    }

    await it('Production action records local stats before the atomic click and suppresses HUD when disabled', async () => {
      await withController('/watch/801', async (env, controller) => {
        env.chrome.storage.sync.data = { showToast: false };
        const { player } = addPlayback(env, 30);
        await controller.start();
        const button = addButton(env, player, { 'data-uia': 'player-skip-intro' });
        assert.strictEqual(await controller.scanAndSkip(), true);
        assert.strictEqual(button.clickCount, 1);
        assert.strictEqual(env.chrome.storage.local.data.introsSkipped, 1);
        assert.strictEqual(env.chrome.storage.local.data.totalSkipped, 1);
        assert.strictEqual(env.document.getElementById('nas-hud-container'), null);
      });
    });

    await it('Awaits the production storage write before dispatching the native click', async () => {
      const env = createEnv('/watch/801');
      const order = [];
      const controller = makeController(env, {
        storage: {
          getSettings: async () => ({ ...require('../shared/constants.js').DEFAULT_SETTINGS, showToast: false }),
          incrementStat: async () => {
            order.push('stats');
            return true;
          }
        }
      });
      try {
        const { player } = addPlayback(env, 30);
        await controller.start();
        const button = addButton(env, player, { 'data-uia': 'player-skip-intro' });
        const nativeClick = button.click.bind(button);
        button.click = () => {
          order.push('click');
          nativeClick();
        };
        assert.strictEqual(await controller.scanAndSkip(), true);
        assert.deepStrictEqual(order, ['stats', 'click']);
      } finally {
        controller.stop();
      }
    });
  });

  await describe('2. Selector confidence and false-positive protection', async () => {
    await it('Rejects a generic Next Episode label in the bottom playback controls', async () => {
      await withController('/watch/801', async (env, controller) => {
        const { player } = addPlayback(env, 1700);
        const controls = addElement(env, player, 'div', { class: 'watch-video--bottom-controls-container' });
        const button = addButton(env, controls, { 'data-uia': 'control-next' }, 'Next Episode');
        await controller.start();
        assert.strictEqual(await controller.scanAndSkip(), false);
        assert.strictEqual(button.clickCount, 0);
      });
    });

    await it('Rejects an explicit next-episode selector inside the episode drawer', async () => {
      await withController('/watch/801', async (env, controller) => {
        const { player } = addPlayback(env, 1700);
        const drawer = addElement(env, player, 'div', { class: 'episode-list' });
        const button = addButton(env, drawer, { 'data-uia': 'next-episode-seamless-button' });
        await controller.start();
        assert.strictEqual(await controller.scanAndSkip(), false);
        assert.strictEqual(button.clickCount, 0);
      });
    });

    await it('Rejects generic Next Episode text without a post-play context', async () => {
      await withController('/watch/801', async (env, controller) => {
        const { player } = addPlayback(env, 1700);
        const button = addButton(env, player, {}, 'Next Episode');
        await controller.start();
        assert.strictEqual(await controller.scanAndSkip(), false);
        assert.strictEqual(button.clickCount, 0);
      });
    });

    await it('Rejects generic Skip Intro text in an audio/subtitle menu', async () => {
      await withController('/watch/801', async (env, controller) => {
        const { player } = addPlayback(env, 30);
        const menu = addElement(env, player, 'div', { class: 'audio-subtitle-controller' });
        const button = addButton(env, menu, {}, 'Skip Intro');
        await controller.start();
        assert.strictEqual(await controller.scanAndSkip(), false);
        assert.strictEqual(button.clickCount, 0);
      });
    });

    await it('Rejects an explicit skip selector outside the recognized player context', async () => {
      await withController('/watch/801', async (env, controller) => {
        addPlayback(env, 30);
        const shell = addElement(env, env.document.body, 'div', { class: 'page-shell' });
        await controller.start();
        const button = addButton(env, shell, { 'data-uia': 'player-skip-intro' });
        assert.strictEqual(await controller.scanAndSkip(), false);
        assert.strictEqual(button.clickCount, 0);
      });
    });

    await it('Uses an explicit Netflix selector before generic text matching', async () => {
      await withController('/watch/801', async (env, controller) => {
        const { player } = addPlayback(env, 30);
        await controller.start();
        const explicit = addButton(env, player, { 'data-uia': 'player-skip-intro' }, 'Skip Intro');
        addButton(env, player, {}, 'Skip Intro');
        assert.strictEqual(await controller.scanAndSkip(), true);
        assert.strictEqual(explicit.clickCount, 1);
      });
    });

    await it('Allows a generic multilingual label only inside the player context', async () => {
      await withController('/watch/801', async (env, controller) => {
        const { player } = addPlayback(env, 30);
        await controller.start();
        const button = addButton(env, player, {}, "Passer l'intro");
        assert.strictEqual(controller.findElement('intro'), button);
        assert.strictEqual(TEXT_PATTERNS.intro.test(button.textContent), true);
      });
    });

    await it('Allows a generic next-episode label only inside post-play context', async () => {
      await withController('/watch/801', async (env, controller) => {
        const { player } = addPlayback(env, 1700);
        const postplay = addElement(env, player, 'div', { class: 'watch-video--postplay-container' });
        await controller.start();
        const button = addButton(env, postplay, {}, 'Next Episode');
        assert.strictEqual(controller.findElement('credits'), button);
      });
    });
  });

  await describe('3. Episode identity, seeking, SPA navigation, and autoplay', async () => {
    await it('Uses the canonical route identity and ignores title mount/unmount/change', async () => {
      await withController('/watch/801', async (env, controller) => {
        const { player } = addPlayback(env, 30);
        const title = addElement(env, player, 'h4', { 'data-uia': 'video-title' });
        title.textContent = 'Episode A';
        await controller.start();
        const intro = addButton(env, player, { 'data-uia': 'player-skip-intro' });
        assert.strictEqual(await controller.scanAndSkip(), true);
        env.timers.runAll();
        const before = controller.getState();
        title.remove();
        const replacement = addElement(env, player, 'h4', { 'data-uia': 'video-title' });
        replacement.textContent = 'Episode B';
        await controller.scanAndSkip();
        const after = controller.getState();
        assert.strictEqual(before.currentKey, 'watch:801');
        assert.strictEqual(after.currentKey, 'watch:801');
        assert.strictEqual(after.handled.intro, true);
        assert.strictEqual(intro.clickCount, 1);
      });
    });

    await it('Resets one-shot state on pushState and replacement route identity', async () => {
      await withController('/watch/801', async (env, controller) => {
        const { player } = addPlayback(env, 30);
        await controller.start();
        const first = addButton(env, player, { 'data-uia': 'player-skip-intro' });
        await controller.scanAndSkip();
        env.timers.runAll();
        env.window.history.pushState({}, '', '/watch/802');
        assert.strictEqual(controller.getState().currentKey, 'watch:802');
        assert.strictEqual(controller.getState().handled.intro, false);
        first.remove();
        const second = addButton(env, player, { 'data-uia': 'player-skip-intro' });
        await controller.scanAndSkip();
        assert.strictEqual(second.clickCount, 1);

        env.window.history.replaceState({}, '', '/watch/803');
        assert.strictEqual(controller.getState().currentKey, 'watch:803');
        assert.strictEqual(controller.getState().handled.intro, false);
      });
    });

    await it('Resets state on popstate and does not reset for query-only changes', async () => {
      await withController('/watch/801', async (env, controller) => {
        const { player } = addPlayback(env, 30);
        await controller.start();
        const button = addButton(env, player, { 'data-uia': 'player-skip-intro' });
        await controller.scanAndSkip();
        env.timers.runAll();
        env.window.history.pushState({}, '', '/watch/801?trackId=2');
        assert.strictEqual(controller.getState().currentKey, 'watch:801');
        assert.strictEqual(controller.getState().handled.intro, true);
        env.window.location.pathname = '/watch/804';
        env.window.dispatchEvent({ type: 'popstate' });
        assert.strictEqual(controller.getState().currentKey, 'watch:804');
        assert.strictEqual(controller.getState().handled.intro, false);
        assert.strictEqual(button.clickCount, 1);
      });
    });

    await it('Guards credits at the start, permits them near the end, and never double-clicks', async () => {
      await withController('/watch/801', async (env, controller) => {
        env.chrome.storage.sync.data = { skipIntro: false, skipRecap: false, autoContinue: false };
        const { player, video } = addPlayback(env, 15);
        await controller.start();
        const next = addButton(env, player, { 'data-uia': 'next-episode-seamless-button' });
        assert.strictEqual(await controller.scanAndSkip(), false);
        assert.strictEqual(next.clickCount, 0);
        video.currentTime = 1700;
        assert.strictEqual(await controller.scanAndSkip(), true);
        env.timers.runAll();
        assert.strictEqual(next.clickCount, 1);
        video.currentTime = 0;
        assert.strictEqual(await controller.scanAndSkip(), false);
        assert.strictEqual(next.clickCount, 1);
      });
    });

    await it('Handles an autoplay click that changes the SPA route without a second click', async () => {
      await withController('/watch/801', async (env, controller) => {
        env.chrome.storage.sync.data = { skipIntro: false, skipRecap: false, autoContinue: false };
        const { player, video } = addPlayback(env, 1700);
        await controller.start();
        const next = addButton(env, player, { 'data-uia': 'next-episode-seamless-button' });
        next.addEventListener('click', () => {
          next.remove();
          video.currentTime = 0;
          env.window.history.pushState({}, '', '/watch/802');
        });
        assert.strictEqual(await controller.scanAndSkip(), true);
        env.timers.runAll();
        assert.strictEqual(next.clickCount, 1);
        assert.strictEqual(controller.getState().currentKey, 'watch:802');
        assert.strictEqual(controller.getState().handled.credits, false);
      });
    });

    await it('Uses a cooldown for recurring Still Watching prompts', async () => {
      await withController('/watch/801', async (env, controller) => {
        env.chrome.storage.sync.data = { skipIntro: false, skipRecap: false, skipCredits: false };
        const { player } = addPlayback(env, 600);
        await controller.start();
        const interrupter = addElement(env, player, 'div', { class: 'interrupter-actions' });
        const prompt = addButton(env, interrupter, {}, 'Continue Watching');
        env.clock.value = 5000;
        assert.strictEqual(await controller.scanAndSkip(), true);
        env.timers.runAll();
        env.clock.value = 6000;
        assert.strictEqual(await controller.scanAndSkip(), false);
        env.clock.value = 15000;
        assert.strictEqual(await controller.scanAndSkip(), true);
        assert.strictEqual(prompt.clickCount, 2);
      });
    });
  });

  await describe('4. Route-scoped activation and media boundaries', async () => {
    await it('Does not treat a catalog preview video as playback context', async () => {
      await withController('/browse', async (env, controller) => {
        const preview = addElement(env, env.document.body, 'div', { class: 'catalog-preview' });
        const video = addElement(env, preview, 'video', {});
        video.duration = 1800;
        video.currentTime = 1700;
        const button = addButton(env, preview, { 'data-uia': 'player-skip-intro' });
        await controller.start();
        assert.strictEqual(controller.isWatchRoute(), false);
        assert.strictEqual(controller.isPlaybackContext(), false);
        assert.strictEqual(await controller.scanAndSkip(), false);
        assert.strictEqual(button.clickCount, 0);
        assert.strictEqual(controller.getDiagnostics().playbackObserverActive, false);
        assert.strictEqual(controller.getDiagnostics().activationObserverActive, false);
        assert.strictEqual(controller.getDiagnostics().pollingActive, false);
      });
    });

    await it('Waits for a player-root video before activating observation and polling', async () => {
      await withController('/watch/801', async (env, controller) => {
        await controller.start();
        assert.strictEqual(controller.isPlaybackContext(), false);
        assert.strictEqual(controller.getDiagnostics().activationObserverActive, true);
        const { player } = addPlayback(env, 30);
        const intro = addButton(env, player, { 'data-uia': 'player-skip-intro' });
        const activation = MockMutationObserver.instances.find((observer) => observer.root === env.document.body);
        assert.ok(activation, 'route activation observer should watch the document body');
        activation.trigger();
        assert.strictEqual(controller.getDiagnostics().playbackObserverActive, true);
        assert.strictEqual(controller.getDiagnostics().activationObserverActive, false);
        assert.strictEqual(controller.getDiagnostics().pollingActive, true);
        await controller.scanAndSkip();
        assert.strictEqual(intro.clickCount, 1);
      });
    });

    await it('Rejects a video outside a recognized player root even on a watch route', async () => {
      await withController('/watch/801', async (env, controller) => {
        const preview = addElement(env, env.document.body, 'div', { class: 'preview-shell' });
        const video = addElement(env, preview, 'video', {});
        video.duration = 1800;
        video.currentTime = 30;
        const button = addButton(env, preview, { 'data-uia': 'player-skip-intro' });
        await controller.start();
        assert.strictEqual(controller.isPlaybackContext(), false);
        assert.strictEqual(await controller.scanAndSkip(), false);
        assert.strictEqual(button.clickCount, 0);
      });
    });
  });

  await describe('5. Shared storage source of truth and failure handling', async () => {
    await it('Keeps settings in sync storage and statistics strictly in local storage', async () => {
      const env = createEnv();
      const storage = createStorage(env.chrome);
      await storage.setSettings({ skipIntro: false });
      assert.strictEqual(env.chrome.storage.sync.data.skipIntro, false);
      assert.strictEqual(env.chrome.storage.local.data.skipIntro, undefined);
      await storage.incrementStat('intro');
      assert.strictEqual(env.chrome.storage.local.data.introsSkipped, 1);
      assert.strictEqual(env.chrome.storage.sync.data.introsSkipped, undefined);
    });

    await it('Falls back to local settings when sync read and write fail', async () => {
      const env = createEnv();
      const storage = createStorage(env.chrome);
      env.chrome.storage.sync.failGet = true;
      env.chrome.storage.sync.failSet = true;
      env.chrome.storage.local.data = { skipRecap: false };
      assert.strictEqual((await storage.getSettings()).skipRecap, false);
      assert.strictEqual(await storage.setSettings({ skipIntro: false }), true);
      assert.strictEqual(env.chrome.storage.local.data.skipIntro, false);
    });

    await it('Migrates a local fallback patch when sync becomes available again', async () => {
      const env = createEnv();
      const storage = createStorage(env.chrome);
      env.chrome.storage.sync.failSet = true;
      await storage.setSettings({ skipIntro: false });
      assert.strictEqual((await storage.getSettings()).skipIntro, false);
      env.chrome.storage.sync.failSet = false;
      assert.strictEqual((await storage.getSettings()).skipIntro, false);
      assert.strictEqual(env.chrome.storage.sync.data.skipIntro, false);
      assert.strictEqual(env.chrome.storage.local.data.__netflixAutoSkipSettingsFallback, undefined);
    });

    await it('Preserves all fallback settings when a later setting changes during sync recovery', async () => {
      const env = createEnv();
      const storage = createStorage(env.chrome);
      env.chrome.storage.sync.failSet = true;
      await storage.setSettings({ skipIntro: false });
      await storage.setSettings({ skipRecap: false });
      env.chrome.storage.sync.failSet = false;
      await storage.setSettings({ showToast: false });
      assert.strictEqual(env.chrome.storage.sync.data.skipIntro, false);
      assert.strictEqual(env.chrome.storage.sync.data.skipRecap, false);
      assert.strictEqual(env.chrome.storage.sync.data.showToast, false);
      assert.strictEqual(env.chrome.storage.local.data.__netflixAutoSkipSettingsFallback, undefined);
    });

    await it('Serializes concurrent stat increments and normalizes malformed counters', async () => {
      const env = createEnv();
      const storage = createStorage(env.chrome);
      await Promise.all(Array.from({ length: 20 }, () => storage.incrementStat('credits')));
      const stats = await storage.getStats();
      assert.strictEqual(stats.creditsSkipped, 20);
      assert.strictEqual(stats.totalSkipped, 20);
      env.chrome.storage.local.data = { introsSkipped: -3, creditsSkipped: 4.8, totalSkipped: 'bad' };
      const normalized = await storage.getStats();
      assert.strictEqual(normalized.introsSkipped, 0);
      assert.strictEqual(normalized.creditsSkipped, 4);
      assert.strictEqual(normalized.totalSkipped, 0);
    });

    await it('Reset stats writes only the complete local stats object', async () => {
      const env = createEnv();
      const storage = createStorage(env.chrome);
      await storage.incrementStat('prompt');
      assert.strictEqual(await storage.resetStats(), true);
      assert.deepStrictEqual(await storage.getStats(), {
        introsSkipped: 0,
        recapsSkipped: 0,
        creditsSkipped: 0,
        promptsDismissed: 0,
        totalSkipped: 0
      });
      assert.strictEqual(env.chrome.storage.sync.setCalls.length, 0);
    });

    await it('Keeps playback action execution best effort when local statistics storage fails', async () => {
      await withController('/watch/801', async (env, controller) => {
        env.chrome.storage.local.failGet = true;
        const { player } = addPlayback(env, 30);
        await controller.start();
        const intro = addButton(env, player, { 'data-uia': 'player-skip-intro' });
        assert.strictEqual(await controller.scanAndSkip(), true);
        assert.strictEqual(intro.clickCount, 1);
      });
    });

    await it('Refreshes production settings through the storage change listener', async () => {
      await withController('/watch/801', async (env, controller) => {
        addPlayback(env, 30);
        await controller.start();
        assert.strictEqual(controller.getConfig().enabled, true);
        await env.chrome.storage.sync.set({ enabled: false });
        await new Promise((resolve) => setImmediate(resolve));
        assert.strictEqual(controller.getConfig().enabled, false);
        assert.strictEqual(env.chrome.storage.onChanged.size, 1);
      });
    });
  });

  await describe('6. Reload, context invalidation, and complete teardown', async () => {
    await it('Prevents wrapper stacking across repeated injection and restores history on stop', async () => {
      const env = createEnv('/watch/801');
      addPlayback(env, 30);
      const first = makeController(env);
      const originalPushState = env.window.history.pushState;
      await first.start();
      const firstWrapper = env.window.history.pushState;
      assert.notStrictEqual(firstWrapper, originalPushState);

      const second = makeController(env);
      await second.start();
      assert.strictEqual(first.getDiagnostics().started, false);
      assert.notStrictEqual(env.window.history.pushState, firstWrapper);
      env.window.history.pushState({}, '', '/watch/802');
      assert.strictEqual(env.window.history.pushCount, 1);
      second.stop();
      assert.strictEqual(env.window.history.pushState, originalPushState);
    });

    await it('Owns and removes observer, interval, media, DOM, storage, and timer resources', async () => {
      await withController('/watch/801', async (env, controller) => {
        const { player, video } = addPlayback(env, 30);
        addButton(env, player, { 'data-uia': 'player-skip-intro' });
        await controller.start();
        await controller.scanAndSkip();
        const beforeStop = controller.getDiagnostics();
        assert.strictEqual(beforeStop.playbackObserverActive, true);
        assert.strictEqual(beforeStop.pollingActive, true);
        assert.ok(video.listenerCount('loadedmetadata') > 0);
        assert.strictEqual(env.chrome.storage.onChanged.size, 1);
        controller.stop();
        const afterStop = controller.getDiagnostics();
        assert.strictEqual(afterStop.started, false);
        assert.strictEqual(afterStop.playbackObserverActive, false);
        assert.strictEqual(afterStop.activationObserverActive, false);
        assert.strictEqual(afterStop.pollingActive, false);
        assert.strictEqual(afterStop.historyPatched, false);
        assert.strictEqual(afterStop.pendingTimers, 0);
        assert.strictEqual(afterStop.pendingAnimationFrames, 0);
        assert.strictEqual(video.listenerCount('loadedmetadata'), 0);
        assert.strictEqual(env.chrome.storage.onChanged.size, 0);
        assert.strictEqual(env.document.getElementById('nas-hud-container'), null);
      });
    });

    await it('Removes a pending DOMContentLoaded listener when stopped before the page is ready', async () => {
      const env = createEnv('/watch/801');
      env.document.readyState = 'loading';
      const controller = makeController(env);
      await controller.start();
      assert.strictEqual(env.document.listenerCount('DOMContentLoaded'), 1);
      controller.stop();
      assert.strictEqual(env.document.listenerCount('DOMContentLoaded'), 0);
      env.document.readyState = 'complete';
      env.document.dispatchEvent({ type: 'DOMContentLoaded' });
      assert.strictEqual(controller.getDiagnostics().playbackObserverActive, false);
    });

    await it('Self-terminates after extension context invalidation', async () => {
      await withController('/watch/801', async (env, controller) => {
        addPlayback(env, 30);
        await controller.start();
        assert.strictEqual(controller.getDiagnostics().started, true);
        env.chrome.runtime.id = null;
        await controller.scanAndSkip();
        assert.strictEqual(controller.getDiagnostics().started, false);
        assert.strictEqual(controller.getDiagnostics().playbackObserverActive, false);
        assert.strictEqual(controller.getDiagnostics().pollingActive, false);
        assert.strictEqual(env.window.__netflixAutoSkipLoaded, false);
      });
    });

    await it('Stops active monitoring when leaving watch route and resumes on return', async () => {
      await withController('/watch/801', async (env, controller) => {
        addPlayback(env, 30);
        await controller.start();
        assert.strictEqual(controller.getDiagnostics().pollingActive, true);
        env.window.history.pushState({}, '', '/browse');
        assert.strictEqual(controller.getDiagnostics().pollingActive, false);
        assert.strictEqual(controller.getDiagnostics().playbackObserverActive, false);
        env.window.history.pushState({}, '', '/watch/801');
        assert.strictEqual(controller.getDiagnostics().pollingActive, true);
      });
    });
  });

  console.log('\n=============================================================');
  console.log(`📊 PRODUCTION QA SUMMARY: ${passedTests}/${totalTests} TESTS PASSED (${totalTests - passedTests} FAILS)`);
  console.log('=============================================================\n');
  if (passedTests !== totalTests) process.exitCode = 1;
}

runAllTests().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
