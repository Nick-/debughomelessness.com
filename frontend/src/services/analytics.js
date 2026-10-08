export const ANALYTICS_EXCLUSION_KEY = 'debughomelessness:analytics-excluded'

// Custom parameters contain only public identifiers and fixed categories;
// never search text, arbitrary URLs, link text, or error messages.
const category = (...values) => value => values.includes(value)
const identifier = value => typeof value === 'string' && /^[A-Z]{2}-\d{3}[A-Z]?$/.test(value)
const stateCode = value => typeof value === 'string' && /^(?:[A-Z]{2})(?:,[A-Z]{2})*$/.test(value)
const count = value => Number.isInteger(value) && value >= 0
const eventParameters = {
  coc_search: { result_count: count, state_filter: value => value === 'all' || stateCode(value) },
  coc_select: { coc_id: identifier, coc_state: stateCode, selection_method: category('map', 'list') },
  coc_detail_view: { coc_id: identifier, coc_state: stateCode },
  coc_state_filter: { state_filter: value => value === 'all' || stateCode(value) },
  map_region_change: { map_region: category('Contiguous U.S.', 'Alaska', 'Hawaii', 'Puerto Rico & U.S. Virgin Islands', 'Guam') },
  shelter_select: { coc_id: identifier, shelter_id: value => typeof value === 'string' && /^[a-zA-Z0-9_-]{1,80}$/.test(value), selection_method: category('map', 'list') },
  shelter_toggle: { enabled: value => typeof value === 'boolean' },
  shelter_metric_change: { shelter_metric: category('capacity', 'occupancy') },
  spm_year_change: { coc_id: identifier, data_year: value => Number.isInteger(value) && value >= 2000 && value <= 2100 },
  spm_expand: { coc_id: identifier },
  achievement_search: { result_count: count },
  achievement_population_filter: { population_filter: category('all', 'veteran', 'chronic') },
  discord_click: {},
  donate_click: {},
  repository_click: {},
  shelter_resource_click: {},
  source_click: { source_host: value => ['huduser.gov', 'www.huduser.gov', 'hud.gov', 'www.hud.gov', 'files.hudexchange.info', 'hudgis-hud.opendata.arcgis.com', 'services.arcgis.com', 'community.solutions', 'census.gov', 'www.census.gov', 'bphi.org', 'caringplace.org', 'lsffamilyfocus.org', 'adrcbroward.org', 'www.adrcbroward.org'].includes(value) },
  navigation_click: { destination: category('dashboard', 'coc_map', 'coc_detail', 'functional_zero'), coc_id: identifier },
  data_load_error: { data_section: category('dashboard', 'coc_detail', 'achievements', 'assessments', 'boundaries', 'shelters') },
}

export function analyticsPageContext(href) {
  const path = new URL(href).pathname
  const match = path.match(/^\/coc\/([A-Z]{2}-\d{3}[A-Z]?)\/?$/)
  if (match) return { page_type: 'coc_detail', page_path: `/coc/${match[1]}`, coc_id: match[1] }
  if (path === '/') return { page_type: 'dashboard', page_path: '/' }
  if (path === '/functional-zero') return { page_type: 'functional_zero', page_path: path }
  return { page_type: 'other', page_path: '/other' }
}

export function analyticsLinkEvent(href, base, placement = 'content') {
  const url = new URL(href, base)
  if (!['http:', 'https:'].includes(url.protocol) || url.searchParams.has('analytics')) return null
  const parameters = { link_placement: placement }
  const current = new URL(base)
  if (url.origin === current.origin) {
    const context = analyticsPageContext(url.href)
    if (context.page_type === 'other') return null
    return { name: 'navigation_click', parameters: { ...parameters,
      destination: url.hash === '#coc-map' ? 'coc_map' : context.page_type, coc_id: context.coc_id } }
  }
  if (url.hostname === 'discord.gg') return { name: 'discord_click', parameters }
  if (url.hostname === 'github.com' && url.pathname.startsWith('/sponsors/')) return { name: 'donate_click', parameters }
  if (url.hostname === 'github.com') return { name: 'repository_click', parameters }
  if (url.hostname === 'www.hud.gov' && url.pathname === '/FindShelter') return { name: 'shelter_resource_click', parameters }
  if (eventParameters.source_click.source_host(url.hostname)) return { name: 'source_click', parameters: { ...parameters, source_host: url.hostname } }
  return null
}

// Read the exclusion before creating the Google tag, including on the first visit.
export function createAnalytics({ browser, document, measurementId = '', production = false }) {
  const id = measurementId.trim()
  let initialized = false
  let excluded = false
  let storageAvailable = true
  let enabled = false

  function track(name, parameters = {}) {
    const schema = Object.hasOwn(eventParameters, name) ? eventParameters[name] : null
    if (!enabled || !schema || excluded || browser[`ga-disable-${id}`] || readExclusion()) return false
    const safe = { ...analyticsPageContext(browser.location.href), send_to: id, transport_type: 'beacon' }
    for (const [key, valid] of Object.entries({ ...schema, link_placement: category('navigation', 'mission', 'footer', 'content') })) {
      if (valid(parameters[key])) safe[key] = parameters[key]
    }
    try {
      browser.gtag('event', name, safe)
      return true
    } catch {
      // A blocked or failing analytics provider must never interrupt the site.
      return false
    }
  }

  function readExclusion() {
    try {
      return browser.localStorage.getItem(ANALYTICS_EXCLUSION_KEY) === 'true'
    } catch {
      storageAvailable = false
      // If we cannot read the preference, do not risk tracking an excluded browser.
      return true
    }
  }

  function initialize() {
    if (initialized) return
    initialized = true
    excluded = readExclusion()

    const url = new URL(browser.location.href)
    const preference = url.searchParams.get('analytics')
    if (preference === 'off' || preference === 'on') {
      excluded = preference === 'off'
      try {
        if (excluded) browser.localStorage.setItem(ANALYTICS_EXCLUSION_KEY, 'true')
        else browser.localStorage.removeItem(ANALYTICS_EXCLUSION_KEY)
      } catch {
        storageAvailable = false
        excluded = true
      }
      // Keep the control parameter out of collected URLs and copied links.
      url.searchParams.delete('analytics')
      browser.history.replaceState(browser.history.state, '', `${url.pathname}${url.search}${url.hash}`)
    }

    if (!/^G-[A-Z0-9]+$/.test(id)) return
    const allowedHost = ['debughomelessness.com', 'www.debughomelessness.com'].includes(url.hostname)
    const allowed = production && allowedHost && url.protocol === 'https:'
    browser[`ga-disable-${id}`] = !allowed || excluded
    if (!allowed) return

    // Stop collection in already-open tabs when another tab saves an exclusion.
    browser.addEventListener('storage', event => {
      if (event.key === ANALYTICS_EXCLUSION_KEY || event.key === null) {
        excluded = readExclusion()
        browser[`ga-disable-${id}`] = excluded
      }
    })
    if (excluded) return

    browser.dataLayer = browser.dataLayer || []
    browser.gtag = function () { browser.dataLayer.push(arguments) }
    browser.gtag('js', new Date())
    // Enhanced measurement handles React Router's History API transitions.
    // Keep a single config call so the initial page view is not duplicated.
    browser.gtag('config', id, {
      allow_google_signals: false,
      allow_ad_personalization_signals: false,
    })
    enabled = true

    function trackLink(event) {
      if (event.type === 'auxclick' && event.button !== 1) return
      const link = event.target?.closest?.('a[href]')
      if (!link) return
      const placement = link.closest('nav') ? 'navigation' : link.closest('footer') ? 'footer'
        : link.closest('.site-mission') ? 'mission' : 'content'
      const action = analyticsLinkEvent(link.href, browser.location.href, placement)
      if (action) track(action.name, action.parameters)
    }
    // Delegation includes Leaflet popup links and links mounted after API loads.
    // Capture preserves the originating page before React Router changes it.
    document.addEventListener('click', trackLink, true)
    document.addEventListener('auxclick', trackLink, true)

    const script = document.createElement('script')
    script.async = true
    script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(id)}`
    document.head.appendChild(script)
  }

  return {
    initialize,
    track,
    get excluded() { return excluded },
    get storageAvailable() { return storageAvailable },
  }
}

export const analytics = typeof window === 'undefined' ? null : createAnalytics({
  browser: window,
  document: window.document,
  measurementId: import.meta.env?.VITE_GA_MEASUREMENT_ID || '',
  production: import.meta.env?.PROD === true,
})
