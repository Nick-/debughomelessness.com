const SESSION_KEY = 'debughomelessness:traffic-session'
const SESSION_TIMEOUT = 30 * 60 * 1000
const sources = new Set(['newsletter', 'discord', 'linkedin', 'reddit', 'github', 'facebook', 'x', 'bluesky', 'google', 'bing', 'chatgpt', 'perplexity', 'email'])
const mediums = new Set(['email', 'social', 'referral', 'organic', 'cpc', 'qr', 'link'])

export function trafficPage(href) {
  const path = new URL(href).pathname
  if (path === '/' || path === '/functional-zero') return path
  return /^\/coc\/[A-Z]{2}-\d{3}[A-Z]?\/?$/.test(path) ? path.replace(/\/$/, '') : '/other'
}

export function trafficReferrer(referrer, origin) {
  try {
    const url = new URL(referrer)
    if (!['http:', 'https:'].includes(url.protocol) || url.origin === origin) return ''
    return url.hostname.toLowerCase()
  } catch { return '' }
}

const campaign = (value, allowed) => !value ? '' : allowed.has(value.toLowerCase()) ? value.toLowerCase() : 'other_tagged'

// A temporary ID groups activity within one tab, never across browsers or devices.
export function createTrafficDiagnostics({ browser, document, isAllowed, now = Date.now }) {
  let initialized = false
  let currentPage = null
  let visibleSince = null
  let visibleMs = 0
  let timer = null
  let engaged = false
  let sessionId = null
  let sent = 0

  function session() {
    const timestamp = now()
    const raw = browser.sessionStorage.getItem(SESSION_KEY)
    let saved = null
    try { saved = JSON.parse(raw || 'null') } catch { /* Reset malformed session data. */ }
    if (!saved || !/^[a-f0-9-]{36}$/.test(saved.id) || !Number.isFinite(saved.lastSeen) ||
        timestamp - saved.lastSeen >= SESSION_TIMEOUT || timestamp < saved.lastSeen) {
      const url = new URL(browser.location.href)
      saved = { id: browser.crypto.randomUUID(), lastSeen: timestamp,
        landing_page: trafficPage(url.href), referrer_host: trafficReferrer(document.referrer, url.origin),
        utm_source: campaign(url.searchParams.get('utm_source'), sources),
        utm_medium: campaign(url.searchParams.get('utm_medium'), mediums) }
    }
    saved.lastSeen = timestamp
    browser.sessionStorage.setItem(SESSION_KEY, JSON.stringify(saved))
    if (sessionId !== saved.id) {
      sessionId = saved.id
      engaged = false
      visibleMs = 0
      sent = 0
      visibleSince = document.visibilityState === 'visible' ? timestamp : null
    }
    return saved
  }

  function send(event) {
    try {
      if (!initialized || !isAllowed()) return false
      const visit = session()
      if (sent >= 100) return false
      sent++
      const body = JSON.stringify({ id: visit.id, landing_page: visit.landing_page,
        referrer_host: visit.referrer_host, utm_source: visit.utm_source, utm_medium: visit.utm_medium,
        event, automation: browser.navigator?.webdriver === true })
      // Same-origin, no cookies, no retries; failures never interrupt the dashboard.
      Promise.resolve(browser.fetch('/api/traffic', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body,
        credentials: 'omit', keepalive: true,
      })).catch(() => {})
      return true
    } catch { return false }
  }

  function visibility() {
    if (timer !== null) browser.clearTimeout(timer)
    timer = null
    if (!isAllowed()) return
    try { session() } catch { return }
    if (visibleSince !== null) visibleMs += Math.max(0, now() - visibleSince)
    visibleSince = document.visibilityState === 'visible' ? now() : null
    if (!engaged && visibleSince !== null && isAllowed()) {
      timer = browser.setTimeout(() => {
        timer = null
        if (document.visibilityState === 'visible' && isAllowed()) {
          if (send('visible_10s')) engaged = true
        }
      }, Math.max(0, 10000 - visibleMs))
    }
  }

  function pageView() {
    if (!initialized || !isAllowed()) return
    const page = trafficPage(browser.location.href)
    if (page === currentPage) return // Includes React StrictMode's repeated effects.
    if (send('page_view')) currentPage = page
    visibility()
  }

  return {
    initialize() {
      if (initialized || typeof browser.fetch !== 'function' || !isAllowed()) return
      initialized = true
      pageView()
      document.addEventListener('visibilitychange', visibility)
      browser.addEventListener('pagehide', () => {
        if (timer !== null) browser.clearTimeout(timer)
        timer = null
        if (visibleSince !== null) visibleMs += Math.max(0, now() - visibleSince)
        visibleSince = null
      })
      browser.addEventListener('pageshow', event => { if (event.persisted) visibility() })
    },
    pageView,
    interaction() { if (send('interaction')) visibility() },
  }
}
