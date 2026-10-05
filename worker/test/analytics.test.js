import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ANALYTICS_EXCLUSION_KEY, createAnalytics } from '../../frontend/src/services/analytics.js';

function setup({ url = 'https://debughomelessness.com/', production = true,
  measurementId = 'G-TEST12345', storage = new Map(), blockedStorage = false } = {}) {
  const scripts = [];
  const listeners = new Map();
  const browser = {
    location: { href: url },
    localStorage: {
      getItem(key) { if (blockedStorage) throw new Error('Storage blocked'); return storage.get(key) ?? null; },
      setItem(key, value) { if (blockedStorage) throw new Error('Storage blocked'); storage.set(key, value); },
      removeItem(key) { if (blockedStorage) throw new Error('Storage blocked'); storage.delete(key); },
    },
    history: {
      state: { preserved: true },
      replaceState(state, title, path) {
        assert.deepEqual(state, { preserved: true });
        browser.location.href = new URL(path, browser.location.href).href;
      },
    },
    addEventListener(name, listener) { listeners.set(name, listener); },
  };
  const document = {
    createElement: () => ({}),
    head: { appendChild: script => scripts.push(script) },
  };
  const analytics = createAnalytics({ browser, document, measurementId, production });
  analytics.initialize();
  return { analytics, browser, scripts, storage, listeners };
}

test('GA loads once for a production visitor and leaves page views to enhanced measurement', () => {
  const { analytics, browser, scripts } = setup();
  analytics.initialize();
  assert.equal(scripts.length, 1);
  assert.equal(scripts[0].src, 'https://www.googletagmanager.com/gtag/js?id=G-TEST12345');
  assert.equal(scripts[0].async, true);
  assert.equal(browser['ga-disable-G-TEST12345'], false);
  const commands = browser.dataLayer.map(args => Array.from(args));
  assert.equal(commands.length, 2);
  assert.equal(commands[0][0], 'js');
  assert.deepEqual(commands[1], ['config', 'G-TEST12345', {
    allow_google_signals: false, allow_ad_personalization_signals: false,
  }]);
});

test('the first exclusion visit sends nothing and persists across reloads before GA can load', () => {
  const first = setup({ url: 'https://debughomelessness.com/coc/FL-601?year=2025&analytics=off#history' });
  assert.equal(first.analytics.excluded, true);
  assert.equal(first.storage.get(ANALYTICS_EXCLUSION_KEY), 'true');
  assert.equal(first.browser['ga-disable-G-TEST12345'], true);
  assert.equal(first.browser.dataLayer, undefined);
  assert.equal(first.scripts.length, 0);
  assert.equal(first.browser.location.href, 'https://debughomelessness.com/coc/FL-601?year=2025#history');
  const next = setup({ storage: first.storage });
  assert.equal(next.scripts.length, 0);
  assert.equal(next.analytics.excluded, true);
});

test('restoring tracking clears the preference and initializes a fresh page', () => {
  const result = setup({ url: 'https://debughomelessness.com/?analytics=on',
    storage: new Map([[ANALYTICS_EXCLUSION_KEY, 'true']]) });
  assert.equal(result.analytics.excluded, false);
  assert.equal(result.storage.has(ANALYTICS_EXCLUSION_KEY), false);
  assert.equal(result.scripts.length, 1);
  assert.equal(result.browser.location.href, 'https://debughomelessness.com/');
});

test('local builds, previews, HTTP, and invalid IDs never initialize GA', () => {
  for (const options of [
    { production: false },
    { url: 'http://localhost:3000/' },
    { url: 'https://debughomelessness.workers.dev/' },
    { url: 'https://debughomelessness.com.example.org/' },
    { url: 'http://debughomelessness.com/' },
    { measurementId: '' },
    { measurementId: 'G-INVALID<script>' },
  ]) {
    const result = setup(options);
    assert.equal(result.scripts.length, 0);
    assert.equal(result.browser.dataLayer, undefined);
  }
  assert.equal(setup({ url: 'https://www.debughomelessness.com/' }).scripts.length, 1);
});

test('storage failures fail closed, including explicit exclusion and restoration links', () => {
  for (const query of ['', '?analytics=off', '?analytics=on']) {
    const result = setup({ blockedStorage: true, url: `https://debughomelessness.com/${query}` });
    assert.equal(result.analytics.excluded, true);
    assert.equal(result.analytics.storageAvailable, false);
    assert.equal(result.scripts.length, 0);
    assert.equal(result.browser['ga-disable-G-TEST12345'], true);
  }
});

test('an exclusion saved in another tab disables an already-loaded tag', () => {
  const result = setup();
  result.storage.set(ANALYTICS_EXCLUSION_KEY, 'true');
  result.listeners.get('storage')({ key: ANALYTICS_EXCLUSION_KEY });
  assert.equal(result.browser['ga-disable-G-TEST12345'], true);
  assert.equal(result.analytics.excluded, true);
});

test('an exclusion is saved even before a measurement ID is configured', () => {
  const result = setup({ measurementId: '', url: 'https://debughomelessness.com/?analytics=off' });
  assert.equal(result.storage.get(ANALYTICS_EXCLUSION_KEY), 'true');
  assert.equal(setup({ storage: result.storage }).scripts.length, 0);
});
