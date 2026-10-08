import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createTrafficDiagnostics, trafficPage, trafficReferrer } from '../../frontend/src/services/traffic-diagnostics.js';

function fixture() {
  let time = 1000;
  let allowed = true;
  let next = 1;
  let uuid = 0;
  const requests = [];
  const storage = new Map();
  const timers = new Map();
  const listeners = new Map();
  const browser = { location: { href: 'https://debughomelessness.com/?utm_source=discord&utm_medium=social&private=secret#private' },
    sessionStorage: { getItem: key => storage.get(key), setItem: (key, value) => storage.set(key, value) },
    crypto: { randomUUID: () => `${String(++uuid).padStart(8, '0')}-e29b-41d4-a716-446655440000` },
    navigator: { webdriver: true },
    fetch: async (url, options) => { requests.push({ url, options, body: JSON.parse(options.body) }); },
    setTimeout(fn, delay) { const id = next++; timers.set(id, { fn, delay }); return id; },
    clearTimeout: id => timers.delete(id), addEventListener: (name, fn) => listeners.set(name, fn) };
  const document = { referrer: 'https://github.com/Nick-/repo?private=secret', visibilityState: 'visible',
    addEventListener: (name, fn) => listeners.set(name, fn) };
  const diagnostics = createTrafficDiagnostics({ browser, document, isAllowed: () => allowed, now: () => time });
  return { browser, document, diagnostics, requests, storage, timers, listeners,
    advance: ms => { time += ms; }, exclude: () => { allowed = false; } };
}

test('first-party telemetry strips URLs, deduplicates route effects and counts deliberate activity', () => {
  const f = fixture();
  f.diagnostics.initialize(); f.diagnostics.initialize(); f.diagnostics.pageView();
  assert.equal(f.requests.length, 1);
  assert.deepEqual(f.requests[0].body, { id: '00000001-e29b-41d4-a716-446655440000', landing_page: '/',
    referrer_host: 'github.com', utm_source: 'discord', utm_medium: 'social', event: 'page_view', automation: true });
  assert.equal(f.requests[0].options.credentials, 'omit');
  assert.equal(JSON.stringify(f.requests).includes('secret'), false);
  f.browser.location.href = 'https://debughomelessness.com/coc/FL-601?email=private@example.com';
  f.diagnostics.pageView();
  f.diagnostics.interaction();
  assert.deepEqual(f.requests.map(r => r.body.event), ['page_view', 'page_view', 'interaction']);
  assert.ok(f.requests.every(r => r.body.landing_page === '/'));
  f.exclude(); f.diagnostics.interaction(); f.diagnostics.pageView();
  assert.equal(f.requests.length, 3);
});

test('engagement requires ten visible seconds and pauses while hidden', () => {
  const f = fixture(); f.diagnostics.initialize();
  f.advance(5000); f.document.visibilityState = 'hidden'; f.listeners.get('visibilitychange')();
  assert.equal(f.timers.size, 0);
  f.advance(60000); f.document.visibilityState = 'visible'; f.listeners.get('visibilitychange')();
  const [timerId, timer] = [...f.timers.entries()][0];
  assert.equal(timer.delay, 5000);
  f.advance(5000); f.timers.delete(timerId); timer.fn();
  assert.equal(f.requests.at(-1).body.event, 'visible_10s');
  f.listeners.get('visibilitychange')();
  assert.equal(f.timers.size, 0);
});

test('idle sessions rotate, hidden idle time does not become engagement, and blocked storage sends nothing', () => {
  const f = fixture(); f.diagnostics.initialize();
  f.document.visibilityState = 'hidden'; f.listeners.get('visibilitychange')();
  f.advance(31 * 60000); f.document.visibilityState = 'visible'; f.listeners.get('visibilitychange')();
  assert.equal([...f.timers.values()][0].delay, 10000);
  f.diagnostics.interaction();
  assert.notEqual(f.requests.at(-1).body.id, f.requests[0].body.id);
  const blocked = fixture();
  blocked.browser.sessionStorage.getItem = () => { throw new Error('Blocked'); };
  blocked.diagnostics.initialize();
  assert.equal(blocked.requests.length, 0);
});

test('routes and referrers retain only useful public context', () => {
  assert.equal(trafficPage('https://debughomelessness.com/private@example.com?secret=yes'), '/other');
  assert.equal(trafficReferrer('https://debughomelessness.com/private', 'https://debughomelessness.com'), '');
  assert.equal(trafficReferrer('file:///private', 'https://debughomelessness.com'), '');
  assert.equal(trafficReferrer('https://reddit.com/r/example?private=secret', 'https://debughomelessness.com'), 'reddit.com');
});
