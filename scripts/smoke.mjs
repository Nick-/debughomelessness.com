import assert from 'node:assert/strict';
import { validateShelterData } from '../frontend/src/services/shelter-data.js';

const base = process.argv[2] || 'https://debughomelessness.com';
for (const path of ['/health', '/api/data-status', '/api/coc/', '/api/metrics/', '/api/metrics/pit/latest', '/api/functional-zero/', '/api/functional-zero/achievements', '/api/not-a-route', '/data/coc-boundaries.json', '/data/shelter-locations.json', '/', '/functional-zero', '/coc/unknown']) {
  const response = await fetch(new URL(path, base), { signal: AbortSignal.timeout(15000) });
  assert.equal(response.status, path === '/api/not-a-route' ? 404 : 200, path);
  if (path === '/data/shelter-locations.json') {
    assert.match(response.headers.get('content-type'), /application\/json/, path);
    const body = validateShelterData(await response.json());
    assert.ok(body.shelters.length > 0, 'Shelter snapshot is empty');
  } else if (path === '/data/coc-boundaries.json') {
    assert.match(response.headers.get('content-type'), /application\/json/, path);
    const body = await response.json();
    assert.equal(body.type, 'FeatureCollection');
    assert.ok(body.features.length >= 380, 'Boundary snapshot is incomplete');
    assert.equal(new Set(body.features.map(feature => feature.properties.coc_id)).size, body.features.length);
    assert.ok(body.features.every(feature => ['Polygon', 'MultiPolygon'].includes(feature.geometry?.type)));
    assert.equal(body.metadata.boundary_year, 2024);
  } else if (path.startsWith('/api/') || path === '/health') {
    assert.match(response.headers.get('content-type'), /application\/json/, path);
    const body = await response.json();
    if (path === '/health') assert.equal(body.status, 'healthy');
    else if (path === '/api/data-status') assert.ok(Array.isArray(body.datasets));
    else if (path === '/api/functional-zero/achievements') {
      assert.equal(body.designation, 'historical');
      assert.equal(body.communities.length, 14);
      assert.ok(body.source_url && body.reviewed_on);
    }
    else if (path !== '/api/not-a-route') assert.ok(Array.isArray(body), path);
  } else {
    assert.match(response.headers.get('content-type'), /text\/html/, path);
    assert.match(await response.text(), /id="root"/, path);
  }
  console.log(`PASS ${path}`);
}
