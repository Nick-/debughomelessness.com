import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ANALYTICS_EXCLUSION_KEY, analyticsLinkEvent, analyticsPageContext, createAnalytics } from '../../frontend/src/services/analytics.js';

function setup({ url = 'https://debughomelessness.com/', production = true, diagnostics = false,
  measurementId = 'G-TEST12345', storage = new Map(), blockedStorage = false } = {}) {
  const scripts = [];
  const listeners = new Map();
  const documentListeners = new Map();
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
    addEventListener(name, listener) { documentListeners.set(name, listener); },
    createElement: () => ({}),
    head: { appendChild: script => scripts.push(script) },
  };
  const requests = [];
  if (diagnostics) {
    Object.assign(browser, {
      sessionStorage: { getItem: () => null, setItem: () => {} },
      crypto: { randomUUID: () => '550e8400-e29b-41d4-a716-446655440000' },
      fetch: async (url, options) => { requests.push(JSON.parse(options.body)); },
      setTimeout: () => 1, clearTimeout: () => {},
    });
    document.visibilityState = 'hidden';
  }
  const analytics = createAnalytics({ browser, document, measurementId, production });
  analytics.initialize();
  return { analytics, browser, scripts, storage, listeners, documentListeners, requests };
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

test('first-party diagnostics obey the same exclusion and production gates and ignore automatic loads', () => {
  for (const options of [{ url: 'https://debughomelessness.com/?analytics=off' },
    { url: 'http://localhost:3000/' }, { production: false }, { blockedStorage: true }]) {
    const f = setup({ ...options, diagnostics: true });
    f.analytics.track('discord_click');
    assert.equal(f.requests.length, 0);
  }
  const f = setup({ diagnostics: true });
  f.analytics.track('coc_detail_view', { coc_id: 'FL-601' });
  f.analytics.track('data_load_error', { data_section: 'dashboard' });
  assert.deepEqual(f.requests.map(r => r.event), ['page_view']);
  f.analytics.track('discord_click');
  assert.equal(f.requests.at(-1).event, 'interaction');
  f.storage.set(ANALYTICS_EXCLUSION_KEY, 'true');
  f.analytics.track('discord_click'); f.analytics.pageView();
  assert.equal(f.requests.length, 2);
  const independent = setup({ diagnostics: true, measurementId: '' });
  independent.analytics.track('discord_click');
  assert.deepEqual(independent.requests.map(r => r.event), ['page_view', 'interaction']);
  assert.equal(independent.scripts.length, 0);
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

test('meaningful events include the current route and only allowlisted public parameters', () => {
  const { analytics, browser } = setup();
  browser.location.href = 'https://debughomelessness.com/coc/FL-601?email=private@example.com#history';
  assert.equal(analytics.track('coc_select', { coc_id: 'NY-600', coc_state: 'NY', selection_method: 'list',
    email: 'private@example.com', search_term: 'my address', link_url: 'https://example.org/private' }), true);
  assert.deepEqual(Array.from(browser.dataLayer.at(-1)), ['event', 'coc_select', {
    page_type: 'coc_detail', page_path: '/coc/FL-601', coc_id: 'NY-600', coc_state: 'NY',
    selection_method: 'list', send_to: 'G-TEST12345', transport_type: 'beacon',
  }]);
  const before = browser.dataLayer.length;
  assert.equal(analytics.track('unknown_event', { value: 'private' }), false);
  assert.equal(analytics.track('__proto__'), false);
  assert.equal(analytics.track('constructor'), false);
  assert.equal(browser.dataLayer.length, before);
  analytics.track('coc_search', { result_count: 0, state_filter: 'FL', search_term: 'my address' });
  assert.equal(browser.dataLayer.at(-1)[2].result_count, 0);
  assert.equal(browser.dataLayer.at(-1)[2].search_term, undefined);
  analytics.track('shelter_toggle', { enabled: false });
  assert.equal(browser.dataLayer.at(-1)[2].enabled, false);
  analytics.track('coc_select', { coc_id: 'private@example.com', coc_state: 'New York', selection_method: 'private' });
  assert.equal(browser.dataLayer.at(-1)[2].coc_id, 'FL-601');
  assert.equal(browser.dataLayer.at(-1)[2].coc_state, undefined);
  assert.equal(browser.dataLayer.at(-1)[2].selection_method, undefined);
});

test('custom events obey exclusion, environment gates, and provider failures', () => {
  for (const options of [{ production: false }, { measurementId: '' }, { blockedStorage: true },
    { url: 'https://debughomelessness.com/?analytics=off' }, { url: 'http://localhost:3000/' }]) {
    const result = setup(options);
    assert.equal(result.analytics.track('discord_click'), false);
    assert.equal(result.browser.dataLayer, undefined);
  }
  const result = setup();
  result.storage.set(ANALYTICS_EXCLUSION_KEY, 'true');
  // Honor a saved exclusion even before its storage event is delivered.
  assert.equal(result.analytics.track('discord_click'), false);
  result.listeners.get('storage')({ key: ANALYTICS_EXCLUSION_KEY });
  assert.equal(result.analytics.track('discord_click'), false);
  const broken = setup();
  broken.browser.gtag = () => { throw new Error('Blocked provider'); };
  assert.equal(broken.analytics.track('discord_click'), false);
});

test('link classification separates intent, strips URL parameters, and ignores exclusion controls', () => {
  const base = 'https://debughomelessness.com/';
  for (const [href, name] of [
    ['https://discord.gg/7TZ6teXQH', 'discord_click'],
    ['https://github.com/sponsors/Nick-', 'donate_click'],
    ['https://github.com/Nick-/debughomelessness.com', 'repository_click'],
    ['https://www.hud.gov/FindShelter', 'shelter_resource_click'],
    ['https://files.hudexchange.info/reports/published/public.pdf?private=value#page=2', 'source_click'],
    ['https://bphi.org/contact-us/', 'source_click'],
    ['https://huduser.gov/portal/datasets/ahar/', 'source_click'],
    ['https://adrcbroward.org/sites/default/files/public.pdf', 'source_click'],
    ['/coc/FL-601', 'navigation_click'],
  ]) {
    const action = analyticsLinkEvent(href, base, 'footer');
    assert.equal(action.name, name);
    assert.equal(action.parameters.link_placement, 'footer');
    assert.equal(action.parameters.link_url, undefined);
  }
  assert.equal(analyticsLinkEvent('/#coc-map', base).parameters.destination, 'coc_map');
  assert.equal(analyticsLinkEvent('/functional-zero', base).parameters.destination, 'functional_zero');
  for (const href of ['?analytics=off', '?analytics=on', 'mailto:private@example.com',
    'https://discord.gg.example.org/', '/private@example.com', 'https://unrecognized.example.org/']) {
    assert.equal(analyticsLinkEvent(href, base), null);
  }
  assert.deepEqual(analyticsPageContext(`${base}private@example.com?secret=yes`), { page_type: 'other', page_path: '/other' });
});

test('delegated links work for late-mounted content and middle clicks without duplicate listeners', () => {
  const { analytics, browser, documentListeners } = setup();
  analytics.initialize();
  assert.equal(documentListeners.size, 2);
  const link = { href: 'https://discord.gg/7TZ6teXQH', closest: selector => selector === 'footer' };
  const event = { target: { closest: () => link }, type: 'click', button: 0 };
  documentListeners.get('click')(event);
  assert.equal(browser.dataLayer.at(-1)[1], 'discord_click');
  assert.equal(browser.dataLayer.at(-1)[2].link_placement, 'footer');
  const before = browser.dataLayer.length;
  documentListeners.get('auxclick')({ ...event, type: 'auxclick', button: 2 });
  assert.equal(browser.dataLayer.length, before);
  documentListeners.get('auxclick')({ ...event, type: 'auxclick', button: 1 });
  assert.equal(browser.dataLayer.length, before + 1);
});
