import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import worker from '../src/index.js';
import { browserDetails, collectTraffic, pruneTraffic } from '../src/traffic.js';

const id = '550e8400-e29b-41d4-a716-446655440000';
const payload = { id, event: 'page_view', landing_page: '/', referrer_host: 'github.com',
  utm_source: '', utm_medium: '', automation: false };
function fixture(t) {
  const db = new DatabaseSync(':memory:');
  db.exec(readFileSync(new URL('../../database/d1/migrations/0003_traffic_sessions.sql', import.meta.url), 'utf8'));
  t.after(() => db.close());
  const keys = [];
  const env = { DB: { prepare(sql) { return { bind(...args) { return { async run() { return db.prepare(sql).run(...args); } }; } }; } },
    TRAFFIC_RATE_LIMITER: { async limit({ key }) { keys.push(key); return { success: true }; } } };
  function request(body = payload, headers = {}, cf = { country: 'US', asn: 14618, asOrganization: 'Amazon.com, Inc.' }) {
    const req = new Request('https://debughomelessness.com/api/traffic', { method: 'POST',
      headers: { Origin: 'https://debughomelessness.com', 'Content-Type': 'application/json',
        'CF-Connecting-IP': '192.0.2.1', 'User-Agent': 'Mozilla/5.0 HeadlessChrome/153.0.0.0', ...headers },
      body: JSON.stringify(body) });
    Object.defineProperty(req, 'cf', { value: cf });
    return req;
  }
  return { db, env, keys, request };
}

test('traffic retains arrival and edge network metadata while counting activity atomically', async t => {
  const f = fixture(t);
  assert.equal((await collectTraffic(f.request({ ...payload, extra: 'private@example.com' }), f.env, 10000)).status, 204);
  assert.equal((await collectTraffic(f.request({ ...payload, event: 'visible_10s' }), f.env, 10010)).status, 204);
  assert.equal((await collectTraffic(f.request({ ...payload, event: 'interaction' }), f.env, 10020)).status, 204);
  assert.equal((await collectTraffic(f.request({ ...payload, landing_page: '/functional-zero', referrer_host: 'different.example' }), f.env, 10030)).status, 204);
  const rows = f.db.prepare('SELECT * FROM traffic_sessions').all();
  assert.equal(rows.length, 1);
  assert.deepEqual({ ...rows[0] }, { session_id: id, first_seen: 10000, last_seen: 10030,
    landing_page: '/', referrer_host: 'github.com', utm_source: '', utm_medium: '', country: 'US', asn: 14618,
    network_owner: 'Amazon.com, Inc.', browser_family: 'Chrome', browser_version: '153',
    automation_signal: 'headless_browser', bot_score: null, page_views: 2, visible_10s: 1, interactions: 1 });
  assert.equal(JSON.stringify(rows).includes('192.0.2.1'), false);
  assert.equal(JSON.stringify(rows).includes('private@example.com'), false);
  assert.equal(JSON.stringify(rows).includes('Mozilla'), false);
  assert.deepEqual(f.keys, Array(4).fill('192.0.2.1'));
});

test('cross-origin, malformed, oversized and rate-limited telemetry never writes rows', async t => {
  const f = fixture(t);
  for (const body of [null, [], { ...payload, id: 'bad' }, { ...payload, landing_page: '/private@example.com' },
    { ...payload, referrer_host: 'github.com/private?email=secret' }, { ...payload, utm_source: 'private@example.com' },
    { ...payload, event: 'purchase' }, { ...payload, padding: 'x'.repeat(3000) }]) {
    assert.equal((await collectTraffic(f.request(body), f.env)).status, 400);
  }
  assert.equal((await collectTraffic(f.request(payload, { Origin: 'https://evil.example' }), f.env)).status, 403);
  assert.equal((await collectTraffic(f.request(payload, { 'Sec-Fetch-Site': 'cross-site' }), f.env)).status, 403);
  assert.equal((await collectTraffic(f.request(payload, { 'Content-Type': 'text/plain' }), f.env)).status, 415);
  f.env.TRAFFIC_RATE_LIMITER.limit = async () => ({ success: false });
  assert.equal((await collectTraffic(f.request(), f.env)).status, 429);
  assert.equal(f.db.prepare('SELECT COUNT(*) AS n FROM traffic_sessions').get().n, 0);
});

test('traffic is write-only, tolerates absent bot scores and prunes only expired diagnostics', async t => {
  const f = fixture(t);
  assert.equal((await worker.fetch(new Request('https://debughomelessness.com/api/traffic'), f.env)).status, 405);
  await collectTraffic(f.request(payload, {}, {}), f.env, 10000);
  await collectTraffic(f.request({ ...payload, id: '660e8400-e29b-41d4-a716-446655440000' }), f.env, 3000000);
  await pruneTraffic(f.env, 3000000);
  assert.equal(f.db.prepare('SELECT COUNT(*) AS n FROM traffic_sessions').get().n, 1);
  await collectTraffic(f.request(), f.env, 3000001); // Old removed IDs cannot retain old identifying metadata.
  const row = f.db.prepare('SELECT * FROM traffic_sessions WHERE session_id = ?').get(id);
  assert.equal(row.first_seen, 3000001);
  assert.equal((await collectTraffic(f.request(), { ...f.env, DB: null })).status, 503);
});

test('browser signals distinguish evidence from an unknown ordinary browser', () => {
  assert.deepEqual(browserDetails('Mozilla Chrome/150.0.0.0 Edg/150.0.0.0'), { family: 'Edge', version: '150', signal: 'no_signal', score: null });
  assert.equal(browserDetails('Mozilla Version/26.0 Safari/604.1').family, 'Safari');
  assert.equal(browserDetails('Mozilla Chrome/150.0.0.0', {}, true).signal, 'automation_reported');
  assert.equal(browserDetails('Mozilla l9scan/2.0').signal, 'scanner_agent');
  assert.equal(browserDetails('Mozilla HeadlessChrome/150.0.0.0', { botManagement: { verifiedBot: true, score: 1 } }).signal, 'verified_bot');
  assert.equal(browserDetails('', { botManagement: { score: 0 } }).score, null);
});
