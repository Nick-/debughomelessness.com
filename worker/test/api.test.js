import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import worker from '../src/index.js';

function fixture() {
  const db = new DatabaseSync(':memory:');
  db.exec(readFileSync(new URL('../../database/d1/migrations/0001_initial.sql', import.meta.url), 'utf8'));
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

test('client routes go to assets while unknown API routes remain JSON 404s', async t => {
  const f = fixture(); t.after(() => f.db.close());
  for (const path of ['/', '/functional-zero', '/coc/TEST-001']) {
    assert.match(await (await f.request(path)).text(), /id="root"/);
  }
  assert.equal((await f.request('/api/missing')).status, 404);
});
