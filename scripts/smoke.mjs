import assert from 'node:assert/strict';

const base = process.argv[2] || 'https://debughomelessness.com';
for (const path of ['/health', '/api/data-status', '/api/coc/', '/api/metrics/', '/api/functional-zero/', '/api/not-a-route', '/', '/functional-zero', '/coc/unknown']) {
  const response = await fetch(new URL(path, base), { signal: AbortSignal.timeout(15000) });
  assert.equal(response.status, path === '/api/not-a-route' ? 404 : 200, path);
  if (path.startsWith('/api/') || path === '/health') {
    assert.match(response.headers.get('content-type'), /application\/json/, path);
    const body = await response.json();
    if (path === '/health') assert.equal(body.status, 'healthy');
    else if (path === '/api/data-status') assert.ok(Array.isArray(body.datasets));
    else if (path !== '/api/not-a-route') assert.ok(Array.isArray(body), path);
  } else {
    assert.match(response.headers.get('content-type'), /text\/html/, path);
    assert.match(await response.text(), /id="root"/, path);
  }
  console.log(`PASS ${path}`);
}
