import functionalZeroAchievements from './functional-zero-achievements.js';

const json = (body, status = 200) => Response.json(body, {
  status,
  headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' },
});

class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

function integer(value, name, fallback, min, max) {
  if (value === null) return fallback;
  if (!/^\d+$/.test(value) || Number(value) < min || Number(value) > max) {
    throw new HttpError(422, `${name} must be an integer between ${min} and ${max}`);
  }
  return Number(value);
}

const latestStatus = `SELECT s.* FROM functional_zero_status s
  WHERE s.status_id = (SELECT status_id FROM functional_zero_status
    WHERE coc_id = s.coc_id ORDER BY last_updated DESC, status_id DESC LIMIT 1)`;

async function api(request, env, path, url) {
  if (!['GET', 'HEAD'].includes(request.method)) {
    return new Response(null, { status: 405, headers: { Allow: 'GET, HEAD' } });
  }
  if (path === '/api/functional-zero/achievements') return json(functionalZeroAchievements);
  if (!env.DB) throw new HttpError(503, 'Database is not configured');
  const all = async (sql, ...args) => (await env.DB.prepare(sql).bind(...args).all()).results;
  const one = async (sql, ...args) => env.DB.prepare(sql).bind(...args).first();
  const requireCoc = async (id) => {
    const coc = await one('SELECT * FROM continuums_of_care WHERE coc_id = ?', id);
    if (!coc) throw new HttpError(404, 'CoC not found');
    if (coc.boundary_geojson) coc.boundary_geojson = JSON.parse(coc.boundary_geojson);
    return coc;
  };
  if (path === '/health') {
    await one('SELECT coc_id FROM continuums_of_care LIMIT 1');
    return json({ status: 'healthy', service: 'debughomelessness', database: 'connected' });
  }
  if (path === '/api/data-status') return json({ datasets: await all('SELECT * FROM data_updates ORDER BY dataset') });
  if (path === '/api/coc') return json(await all('SELECT * FROM continuums_of_care ORDER BY coc_id').then(rows => rows.map(c => ({ ...c, boundary_geojson: c.boundary_geojson ? JSON.parse(c.boundary_geojson) : null }))));
  let match;
  if ((match = path.match(/^\/api\/coc\/([^/]+)\/history$/))) {
    const id = match[1];
    await requireCoc(id);
    const years = integer(url.searchParams.get('years'), 'years', 5, 1, 100);
    return json({ coc_id: id, years, data: await all(`SELECT year, metric_type, value, unit, source FROM metrics
      WHERE coc_id = ? AND year > (SELECT MAX(year) FROM metrics WHERE coc_id = ?) - ?
      ORDER BY year, metric_type`, id, id, years) });
  }
  if ((match = path.match(/^\/api\/coc\/([^/]+)$/))) return json(await requireCoc(match[1]));
  if (path === '/api/metrics/pit/latest') return json(await all(`SELECT * FROM metrics
    WHERE year = (SELECT MAX(year) FROM metrics WHERE metric_type = 'pit_count')
      AND metric_type IN ('pit_count', 'pit_sheltered', 'pit_unsheltered')
    ORDER BY coc_id, metric_type`));
  if (path === '/api/metrics') {
    const limit = integer(url.searchParams.get('limit'), 'limit', 1000, 1, 5000);
    const offset = integer(url.searchParams.get('offset'), 'offset', 0, 0, 1000000000);
    return json(await all('SELECT * FROM metrics ORDER BY year DESC, coc_id, metric_type LIMIT ? OFFSET ?', limit, offset));
  }
  if ((match = path.match(/^\/api\/metrics\/coc\/([^/]+)$/))) {
    const id = match[1];
    await requireCoc(id);
    const year = integer(url.searchParams.get('year'), 'year', null, 1900, 2200);
    const rows = year === null
      ? await all('SELECT * FROM metrics WHERE coc_id = ? ORDER BY year DESC, metric_type', id)
      : await all('SELECT * FROM metrics WHERE coc_id = ? AND year = ? ORDER BY metric_type', id, year);
    return json({ coc_id: id, year, metrics: rows });
  }
  if ((match = path.match(/^\/api\/metrics\/type\/([^/]+)$/))) return json({
    metric_type: match[1], metrics: await all('SELECT * FROM metrics WHERE metric_type = ? ORDER BY year DESC, coc_id', match[1]),
  });
  if ((match = path.match(/^\/api\/metrics\/([^/]+)$/))) {
    const id = integer(match[1], 'metric_id', null, 1, Number.MAX_SAFE_INTEGER);
    const metric = await one('SELECT * FROM metrics WHERE metric_id = ?', id);
    if (!metric) throw new HttpError(404, 'Metric not found');
    return json(metric);
  }
  if (path === '/api/functional-zero') return json(await all(`${latestStatus} ORDER BY s.coc_id`));
  if ((match = path.match(/^\/api\/functional-zero\/benchmark\/([^/]+)$/))) {
    if (!['functional_zero', 'approaching', 'not_achieved'].includes(match[1])) throw new HttpError(422, 'Unknown benchmark type');
    return json({ benchmark_type: match[1], cocs: await all(`${latestStatus} AND s.status = ? ORDER BY s.coc_id`, match[1]) });
  }
  if ((match = path.match(/^\/api\/functional-zero\/([^/]+)\/timeline$/))) {
    await requireCoc(match[1]);
    return json({ coc_id: match[1], timeline: await all('SELECT * FROM functional_zero_status WHERE coc_id = ? ORDER BY last_updated, status_id', match[1]) });
  }
  if ((match = path.match(/^\/api\/functional-zero\/([^/]+)$/))) {
    await requireCoc(match[1]);
    const status = await one(`${latestStatus} AND s.coc_id = ?`, match[1]);
    if (!status) throw new HttpError(404, 'Functional Zero status is not available');
    return json(status);
  }
  throw new HttpError(404, 'API endpoint not found');
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    let path;
    try { path = decodeURIComponent(url.pathname).replace(/\/+$/, '') || '/'; }
    catch { return json({ detail: 'Malformed URL' }, 400); }
    if (path !== '/health' && path !== '/api' && !path.startsWith('/api/')) return env.ASSETS.fetch(request);
    let response;
    try { response = await api(request, env, path, url); }
    catch (error) {
      if (!(error instanceof HttpError)) console.error('API request failed', error.message);
      response = json({ detail: error instanceof HttpError ? error.message : 'Database request failed' }, error.status || 503);
    }
    return request.method === 'HEAD' ? new Response(null, { status: response.status, headers: response.headers }) : response;
  },
};
