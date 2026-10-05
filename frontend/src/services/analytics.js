export const ANALYTICS_EXCLUSION_KEY = 'debughomelessness:analytics-excluded'

// Read the exclusion before creating the Google tag, including on the first visit.
export function createAnalytics({ browser, document, measurementId = '', production = false }) {
  const id = measurementId.trim()
  let initialized = false
  let excluded = false
  let storageAvailable = true

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

    const script = document.createElement('script')
    script.async = true
    script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(id)}`
    document.head.appendChild(script)
  }

  return {
    initialize,
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
