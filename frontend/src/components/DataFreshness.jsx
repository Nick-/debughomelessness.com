import React, { useEffect, useState } from 'react'
import { getDataStatus } from '../services/api'
import './DataFreshness.css'

export default function DataFreshness() {
  const [data, setData] = useState(null)
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    let active = true
    getDataStatus().then(result => {
      if (active) setData(result.datasets.find(dataset => dataset.dataset === 'hud_pit') || null)
    }).catch(() => { if (active) setFailed(true) })
    return () => { active = false }
  }, [])
  if (failed) return <aside className="data-freshness" role="status">Data update information is temporarily unavailable.</aside>
  if (!data) return null
  const date = new Date(data.imported_at)
  const imported = date.toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit',
    timeZone: 'America/New_York', timeZoneName: 'short',
  })
  return <aside className="data-freshness" aria-label="Data source and update schedule">
    <p><strong>HUD PIT data: {data.first_year}–{data.latest_year}.</strong> Latest count: January {data.latest_year}.
      {' '}Published by HUD: {data.source_published}. Last imported: <time dateTime={data.imported_at}>{imported}</time>.</p>
    <p><strong>Next expected dataset: January {data.next_expected_year} counts.</strong>{' '}
      {data.next_release_date ? `Expected release: ${data.next_release_date}.` : 'HUD has not announced a publication date.'}
      {' '}<a href={data.source_url} target="_blank" rel="noreferrer">View HUD source and releases</a></p>
    <details><summary>What these data cover</summary><p>{data.methodology_note}</p></details>
  </aside>
}
