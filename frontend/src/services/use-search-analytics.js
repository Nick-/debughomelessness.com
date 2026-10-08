import { useCallback, useEffect, useRef } from 'react'
import { analytics } from './analytics'

// Report settled searches, not every keystroke. Never collect the query itself.
export function useSearchAnalytics(name, query, resultCount, stateFilter) {
  const lastSearch = useRef(null)
  const reportSearch = useCallback(() => {
    const term = query.trim()
    if (!term) return
    const signature = JSON.stringify([term, resultCount, stateFilter])
    if (signature === lastSearch.current) return
    lastSearch.current = signature
    analytics.track(name, { result_count: resultCount, state_filter: stateFilter })
  }, [name, query, resultCount, stateFilter])

  useEffect(() => {
    if (!query.trim()) { lastSearch.current = null; return }
    const timer = setTimeout(reportSearch, 800)
    return () => clearTimeout(timer)
  }, [query, reportSearch])
  // Blur/Enter flush a quick search before the visitor opens a result.
  return reportSearch
}
