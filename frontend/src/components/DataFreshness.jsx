import React, { useEffect, useState } from 'react'
import { getDataStatus } from '../services/api'
import './DataFreshness.css'

export default function DataFreshness() {
  const [data, setData] = useState(null)
  const [spm, setSpm] = useState(null)
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    let active = true
    getDataStatus().then(result => {
      if (active) {
        setData(result.datasets.find(dataset => dataset.dataset === 'hud_pit') || null)
        setSpm(result.datasets.find(dataset => dataset.dataset === 'hud_spm') || null)
      }
    }).catch(() => { if (active) setFailed(true) })
    return () => { active = false }
  }, [])
  if (failed) return <aside className="data-freshness" role="status">Data update information is temporarily unavailable.</aside>
  if (!data && !spm) return null
  const imported = timestamp => new Date(timestamp).toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit',
    timeZone: 'America/New_York', timeZoneName: 'short',
  })
  return <aside className="data-freshness" aria-label="Data source and update schedule">
    {data && <><p><strong>HUD PIT data: {data.first_year}–{data.latest_year}.</strong> Latest count: January {data.latest_year}.
      {' '}Published by HUD: {data.source_published}. Last imported: <time dateTime={data.imported_at}>{imported(data.imported_at)}</time>.</p>
    <p><strong>Next expected dataset: January {data.next_expected_year} counts.</strong>{' '}
      {data.next_release_date ? `Expected release: ${data.next_release_date}.` : 'HUD has not announced a publication date.'}
      {' '}<a href={data.source_url} target="_blank" rel="noreferrer">View HUD source and releases</a></p>
    <details><summary>What PIT data cover</summary><p>{data.methodology_note}</p></details></>}
    {spm && <><p><strong>HUD system performance: FY{spm.first_year}–FY{spm.latest_year}.</strong>{' '}
      Last imported: <time dateTime={spm.imported_at}>{imported(spm.imported_at)}</time>.{' '}
      <a href={spm.source_url} target="_blank" rel="noreferrer">View HUD workbook</a></p>
      <details><summary>What system performance data cover</summary><p>{spm.methodology_note}</p></details></>}
  </aside>
}
