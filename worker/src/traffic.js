const response = status => new Response(null, { status, headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });
const sources = new Set(['', 'newsletter', 'discord', 'linkedin', 'reddit', 'github', 'facebook', 'x', 'bluesky', 'google', 'bing', 'chatgpt', 'perplexity', 'email', 'other_tagged']);
const mediums = new Set(['', 'email', 'social', 'referral', 'organic', 'cpc', 'qr', 'link', 'other_tagged']);
const hosts = new Set(['debughomelessness.com', 'www.debughomelessness.com']);

export function browserDetails(userAgent = '', cf = {}, automation = false) {
  const match = userAgent.match(/(HeadlessChrome|Edg|CriOS|Chrome|Firefox|Version)\/(\d{1,3})(?:\.|\s|$)/);
  const family = match ? ({ HeadlessChrome: 'Chrome', Edg: 'Edge', CriOS: 'Chrome', Chrome: 'Chrome', Firefox: 'Firefox', Version: 'Safari' })[match[1]] : 'Other';
  // Edge and iOS Chrome include other browser tokens; prefer their specific token.
  const specific = userAgent.match(/(Edg|CriOS)\/(\d{1,3})(?:\.|\s|$)/);
  const scanner = /l9scan|InternetMeasurement|curl\/|python-(?:requests|httpx)|GPTBot|Googlebot|bingbot/i.test(userAgent);
  return {
    family: specific ? (specific[1] === 'Edg' ? 'Edge' : 'Chrome') : family,
    version: specific?.[2] || match?.[2] || '',
    signal: cf.botManagement?.verifiedBot === true ? 'verified_bot'
      : /HeadlessChrome/i.test(userAgent) ? 'headless_browser'
      : scanner ? 'scanner_agent' : automation ? 'automation_reported' : 'no_signal',
    score: Number.isInteger(cf.botManagement?.score) && cf.botManagement.score >= 1 && cf.botManagement.score <= 99 ? cf.botManagement.score : null,
  };
}

async function boundedBody(request) {
  if (!request.body || Number(request.headers.get('Content-Length')) > 2048) return null;
  const reader = request.body.getReader();
  const chunks = [];
  let length = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > 2048) { await reader.cancel(); return null; }
      chunks.push(value);
    }
    const bytes = new Uint8Array(length);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch { return null; }
  finally { reader.releaseLock(); }
}

export async function collectTraffic(request, env, now = Math.floor(Date.now() / 1000)) {
  if (request.method !== 'POST') return response(405);
  const url = new URL(request.url);
  if (!hosts.has(url.hostname) && !['localhost', '127.0.0.1'].includes(url.hostname)) return response(403);
  if (request.headers.get('Origin') !== url.origin ||
      !['same-origin', null].includes(request.headers.get('Sec-Fetch-Site'))) return response(403);
  if (request.headers.get('Content-Type')?.split(';')[0] !== 'application/json') return response(415);
  if (!env.DB || !env.TRAFFIC_RATE_LIMITER) return response(503);
  // IP is used only transiently by Cloudflare's limiter, never written to D1.
  const ip = request.headers.get('CF-Connecting-IP');
  try {
    if (!(await env.TRAFFIC_RATE_LIMITER.limit({ key: ip || 'local' })).success) return response(429);
  } catch { return response(503); }
  const body = await boundedBody(request);
  if (!body || typeof body !== 'object' || Array.isArray(body) ||
      !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(body.id) ||
      !['page_view', 'visible_10s', 'interaction'].includes(body.event) ||
      typeof body.landing_page !== 'string' ||
      !/^(?:\/|\/other|\/functional-zero|\/coc\/[A-Z]{2}-\d{3}[A-Z]?)$/.test(body.landing_page) ||
      typeof body.referrer_host !== 'string' || body.referrer_host.length > 253 ||
      !/^(?:[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?)?$/.test(body.referrer_host) ||
      !sources.has(body.utm_source) || !mediums.has(body.utm_medium) || typeof body.automation !== 'boolean') return response(400);
  const cf = request.cf || {};
  const browser = browserDetails(request.headers.get('User-Agent') || '', cf, body.automation);
  const country = /^[A-Z]{2}$/.test(cf.country) ? cf.country : '';
  const asn = Number.isSafeInteger(cf.asn) && cf.asn > 0 ? cf.asn : null;
  const owner = typeof cf.asOrganization === 'string' ? cf.asOrganization.replace(/[\x00-\x1f\x7f]/g, '').slice(0, 120) : '';
  try {
    await env.DB.prepare(`INSERT INTO traffic_sessions
      (session_id, first_seen, last_seen, landing_page, referrer_host, utm_source, utm_medium,
       country, asn, network_owner, browser_family, browser_version, automation_signal, bot_score,
       page_views, visible_10s, interactions)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(session_id) DO UPDATE SET
        last_seen = excluded.last_seen,
        page_views = MIN(100, traffic_sessions.page_views + excluded.page_views),
        visible_10s = MAX(traffic_sessions.visible_10s, excluded.visible_10s),
        interactions = MIN(100, traffic_sessions.interactions + excluded.interactions)
      WHERE traffic_sessions.last_seen >= ?`)
      .bind(body.id, now, now, body.landing_page, hosts.has(body.referrer_host) ? '' : body.referrer_host,
        body.utm_source, body.utm_medium, country, asn, owner, browser.family, browser.version, browser.signal, browser.score,
        Number(body.event === 'page_view'), Number(body.event === 'visible_10s'), Number(body.event === 'interaction'), now - 1800).run();
    return response(204);
  } catch {
    console.error('Traffic diagnostics storage failed'); // Never log the payload or request headers.
    return response(503);
  }
}

export async function pruneTraffic(env, now = Math.floor(Date.now() / 1000)) {
  await env.DB.prepare('DELETE FROM traffic_sessions WHERE last_seen < ?').bind(now - 30 * 86400).run();
}
