import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync, readdirSync } from 'node:fs';
import worker from '../src/index.js';

function fixture() {
  const db = new DatabaseSync(':memory:');
  const migrations = new URL('../../database/d1/migrations/', import.meta.url);
  for (const file of readdirSync(migrations).filter(file => file.endsWith('.sql')).sort()) {
    db.exec(readFileSync(new URL(file, migrations), 'utf8'));
  }
  db.exec(`INSERT INTO continuums_of_care(coc_id, name, state, population, boundary_geojson)
    VALUES ('TEST-001', 'Test CoC', 'CA', 100000, '{"type":"FeatureCollection","features":[]}');
    INSERT INTO metrics(coc_id, metric_type, year, value) VALUES
    ('TEST-001', 'pit_count', 2020, 40), ('TEST-001', 'pit_count', 2024, 20),
    ('TEST-001', 'spm_length', 2024, 30);
    INSERT INTO functional_zero_status(coc_id, status, current_population, benchmark_population, last_updated)
    VALUES ('TEST-001', 'not_achieved', 40, 30, '2020-01-01'),
    ('TEST-001', 'functional_zero', 20, 30, '2024-01-01');`);
  const env = {
    DB: { prepare(sql) { return { bind(...args) {
      return { async all() { return { results: db.prepare(sql).all(...args) }; },
        async first() { return db.prepare(sql).get(...args) ?? null; } };
    } }; } },
    ASSETS: { fetch() { return new Response('<div id="root"></div>', { headers: { 'content-type': 'text/html' } }); } },
  };
  return { db, env, request: (path, method = 'GET') => worker.fetch(new Request(`https://example.test${path}`, { method }), env) };
}

test('D1 schema and API return data, filter years, and choose the latest assessment', async t => {
  const f = fixture(); t.after(() => f.db.close());
  assert.equal((await (await f.request('/health')).json()).database, 'connected');
  const cocs = await (await f.request('/api/coc/')).json();
  assert.equal(cocs[0].boundary_geojson.type, 'FeatureCollection');
  assert.equal((await (await f.request('/api/coc/TEST-001')).json()).name, 'Test CoC');
  const history = await (await f.request('/api/coc/TEST-001/history?years=2')).json();
  assert.deepEqual(history.data.map(m => m.year), [2024, 2024]);
  assert.equal((await (await f.request('/api/metrics/coc/TEST-001?year=2020')).json()).metrics.length, 1);
  assert.equal((await (await f.request('/api/metrics/type/pit_count')).json()).metrics.length, 2);
  assert.equal((await (await f.request('/api/metrics/1')).json()).value, 40);
  assert.equal((await (await f.request('/api/functional-zero')).json()).length, 1);
  assert.equal((await (await f.request('/api/functional-zero/TEST-001')).json()).status, 'functional_zero');
  assert.equal((await (await f.request('/api/functional-zero/TEST-001/timeline')).json()).timeline.length, 2);
  assert.equal((await (await f.request('/api/functional-zero/benchmark/not_achieved')).json()).cocs.length, 0);
});

test('validation, missing data, and read-only methods produce JSON errors', async t => {
  const f = fixture(); t.after(() => f.db.close());
  for (const path of ['/api/coc/TEST-001/history?years=-1', '/api/metrics/coc/TEST-001?year=oops', '/api/metrics/invalid', '/api/functional-zero/benchmark/invalid']) {
    assert.equal((await f.request(path)).status, 422, path);
  }
  for (const path of ['/api', '/api/unknown', '/api/coc/missing', '/api/metrics/999', '/api/functional-zero/missing']) {
    const response = await f.request(path);
    assert.equal(response.status, 404, path);
    assert.match(response.headers.get('content-type'), /application\/json/);
  }
  assert.equal((await f.request('/api/coc', 'POST')).status, 405);
  assert.equal((await f.request('/api/coc/%ZZ')).status, 400);
  const head = await f.request('/health', 'HEAD');
  assert.equal(head.status, 200);
  assert.equal(await head.text(), '');
  const response = await f.request('/api/coc/%27%20OR%201=1--');
  assert.equal(response.status, 404);
});

test('missing assessments stay missing; database failures never look healthy', async t => {
  const f = fixture(); t.after(() => f.db.close());
  f.db.exec('DELETE FROM functional_zero_status');
  assert.equal((await f.request('/api/functional-zero/TEST-001')).status, 404);
  assert.deepEqual(await (await f.request('/api/functional-zero')).json(), []);
  assert.equal((await worker.fetch(new Request('https://example.test/health'), {})).status, 503);
});

test('sourced historical milestones remain available without inventing current CoC assessments', async t => {
  const f = fixture(); t.after(() => f.db.close());
  f.db.exec('DELETE FROM functional_zero_status');
  const response = await f.request('/api/functional-zero/achievements/');
  assert.equal(response.status, 200);
  const data = await response.json();
  assert.equal(data.designation, 'historical');
  assert.equal(data.source_url, 'https://community.solutions/built-for-zero/functional-zero/');
  assert.equal(data.reviewed_on, '2026-10-04');
  assert.equal(data.communities.length, 14);
  assert.equal(new Set(data.communities.map(c => `${c.state}:${c.name}`)).size, 14);
  assert.equal(data.communities.filter(c => c.populations.includes('veteran')).length, 12);
  assert.equal(data.communities.filter(c => c.populations.includes('chronic')).length, 5);
  assert.equal(data.communities.filter(c => c.populations.length === 2).length, 3);
  assert.ok(data.communities.every(c => !('coc_id' in c) && !('current_population' in c) && !('achieved_date' in c)));
  assert.deepEqual(await (await f.request('/api/functional-zero')).json(), []);
  assert.equal((await f.request('/api/functional-zero/TEST-001')).status, 404);
  assert.equal((await f.request('/api/functional-zero/achievements', 'POST')).status, 405);
  assert.equal(await (await f.request('/api/functional-zero/achievements', 'HEAD')).text(), '');
  const withoutDb = await worker.fetch(new Request('https://example.test/api/functional-zero/achievements'), {});
  assert.equal(withoutDb.status, 200);
  assert.deepEqual(await withoutDb.json(), data);
});

test('client routes go to assets while unknown API routes remain JSON 404s', async t => {
  const f = fixture(); t.after(() => f.db.close());
  for (const path of ['/', '/functional-zero', '/coc/TEST-001']) {
    assert.match(await (await f.request(path)).text(), /id="root"/);
  }
  assert.equal((await f.request('/api/missing')).status, 404);
});

test('data update metadata distinguishes an empty import and an unannounced release', async t => {
  const f = fixture(); t.after(() => f.db.close());
  assert.deepEqual(await (await f.request('/api/data-status')).json(), { datasets: [] });
  f.db.prepare(`INSERT INTO data_updates VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
    'hud_pit', 2022, 2025, 'https://www.huduser.gov/source', 'May 2026', 'checksum',
    '2026-10-05T02:00:00Z', 2026, null, 'Date not announced', 'January point-in-time estimates');
  const response = await f.request('/api/data-status/');
  assert.equal(response.status, 200);
  const { datasets } = await response.json();
  assert.equal(datasets[0].latest_year, 2025);
  assert.equal(datasets[0].imported_at, '2026-10-05T02:00:00Z');
  assert.equal(datasets[0].next_expected_year, 2026);
  assert.equal(datasets[0].next_release_date, null);
  assert.equal((await f.request('/api/data-status', 'POST')).status, 405);
  assert.equal(await (await f.request('/api/data-status', 'HEAD')).text(), '');
});
