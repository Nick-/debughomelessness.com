import React, { useState, useEffect } from 'react'
import { Link, useParams } from 'react-router-dom'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import './CoCDetail.css'
import { getCoc, getCocMetrics, getCocFunctionalZeroStatus } from '../services/api'
import { pitHistory, spmHighlights, spmLabels, formatMetric } from '../services/metric-display'
import { analytics } from '../services/analytics'

const CoCDetail = () => {
  const { cocId } = useParams()
  const [cocData, setCocData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [spmYear, setSpmYear] = useState('')

  useEffect(() => {
    let active = true
    setLoading(true)
    setError(null)
    Promise.all([getCoc(cocId), getCocMetrics(cocId),
      getCocFunctionalZeroStatus(cocId).catch(err => {
        if (err.response?.status === 404) return null
        throw err
      })])
      .then(([coc, metrics, status]) => {
        if (!active) return
        const pit = metrics.metrics.filter(m => m.metric_type === 'pit_count').sort((a, b) => b.year - a.year)[0]
        const spm = metrics.metrics.filter(m => m.metric_type.startsWith('spm_'))
        const spmYears = [...new Set(spm.map(m => m.year))].sort((a, b) => b - a)
        setSpmYear(String(spmYears[0] ?? ''))
        setCocData({ ...coc, name: coc.name || coc.coc_id,
          status: status?.status, current_homeless: pit?.value ?? null, pit_year: pit?.year,
          benchmark: status?.benchmark_population ?? null,
          historical_data: pitHistory(metrics.metrics), spm, spmYears,
        })
        analytics.track('coc_detail_view', { coc_id: coc.coc_id, coc_state: coc.state?.replaceAll(' ', '') })
      })
      .catch(err => { if (active) {
        setError(err.response?.status === 404 ? 'Continuum of Care not found.' : 'Unable to load CoC details. Please try again later.')
        analytics.track('data_load_error', { data_section: 'coc_detail' })
      } })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [cocId])

  if (loading) {
    return <div className="loading">Loading CoC details...</div>
  }
  if (error) return <div className="loading" role="alert">{error}</div>

  return (
    <div className="coc-detail">
      <Link to="/#coc-map" className="coc-back-link">← Back to CoC map</Link>
      <h1 className="coc-title">{cocData.name}</h1>
      
      <div className="coc-info">
        <div className="info-card">
          <h3>State</h3>
          <p>{cocData.state}</p>
        </div>
        <div className="info-card">
          <h3>Population</h3>
          <p>{cocData.population?.toLocaleString() ?? 'Not available'}</p>
          {cocData.population == null && <small>Verified CoC population data is unavailable. Rates per resident cannot be calculated.</small>}
        </div>
        <div className="info-card">
          <h3>Latest PIT count {cocData.pit_year ? `(${cocData.pit_year})` : ''}</h3>
          <p>{cocData.current_homeless?.toLocaleString() ?? 'Not available'}</p>
        </div>
        <div className="info-card">
          <h3>Stored Assessment Benchmark</h3>
          <p>{cocData.benchmark ?? 'Not available'}</p>
        </div>
      </div>

      <div className="coc-chart">
        <h2>Historical PIT counts</h2>
        <p>January estimates. Gaps indicate missing totals; 2021 has sheltered counts only. CoC boundaries and reporting coverage can change.</p>
        {!cocData.historical_data.length ? <p>No PIT history is available for this reporting unit.</p> :
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={cocData.historical_data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="year" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Line type="linear" dataKey="homeless" name="PIT count" connectNulls={false} stroke="#3498db" strokeWidth={2} />
            <Line type="linear" dataKey="sheltered" name="Sheltered" connectNulls={false} stroke="#24824b" />
            <Line type="linear" dataKey="unsheltered" name="Unsheltered" connectNulls={false} stroke="#a54c21" />
          </LineChart>
        </ResponsiveContainer>}
      </div>

      <div className="coc-chart coc-spm">
        <h2>System performance measures</h2>
        <p>Federal fiscal year: October 1 of the previous year through September 30. These measures cover participating HMIS projects and depend on local data quality and coverage.</p>
        {cocData.spmYears.length ? <>
          <label htmlFor="spm-year">Fiscal year </label>
          <select id="spm-year" value={spmYear} onChange={event => {
            setSpmYear(event.target.value)
            analytics.track('spm_year_change', { coc_id: cocId, data_year: Number(event.target.value) })
          }}>
            {cocData.spmYears.map(year => <option key={year} value={year}>FY{year}</option>)}
          </select>
          <div className="spm-table-wrap"><table>
            <thead><tr><th scope="col">Measure</th><th scope="col">FY{spmYear}</th></tr></thead>
            <tbody>{spmHighlights.map(([key, label]) => <tr key={key}>
              <th scope="row">{label}</th><td>{formatMetric(cocData.spm.find(m => m.year === Number(spmYear) && m.metric_type === key))}</td>
            </tr>)}</tbody>
          </table></div>
          <details onToggle={event => {
            if (event.currentTarget.open) analytics.track('spm_expand', { coc_id: cocId })
          }}><summary>All imported measures for FY{spmYear}</summary>
            <div className="spm-table-wrap"><table><thead><tr><th scope="col">Measure</th><th scope="col">Value</th></tr></thead>
              <tbody>{Object.entries(spmLabels).map(([key, label]) => <tr key={key}>
                <th scope="row">{label}</th><td>{formatMetric(cocData.spm.find(m => m.year === Number(spmYear) && m.metric_type === key))}</td>
              </tr>)}</tbody>
            </table></div>
          </details>
          <p><a href={cocData.spm.find(m => m.year === Number(spmYear))?.source} target="_blank" rel="noreferrer">HUD SPM source workbook</a>. Missing and invalid source cells remain unavailable. Returns use the All-project cohort. SO = street outreach; ES = emergency shelter; SH = safe haven; TH = transitional housing; PH = permanent housing; RRH = rapid rehousing; DV = domestic violence.</p>
        </> : <p>No system performance measures are available for this CoC.</p>}
        {cocId === 'MO-604' && <p>HUD reports separate Kansas City units in some years: <Link to="/coc/MO-604K">Kansas reporting unit</Link> and <Link to="/coc/MO-604M">Missouri reporting unit</Link>. Their rates and durations are not combined here.</p>}
      </div>

      <div className="coc-status">
        <h2>Functional Zero Status</h2>
        <p className={`status ${!cocData.status ? 'unavailable' : cocData.status === 'functional_zero' ? 'achieved' : 'not-achieved'}`}>
          {cocData.status ? cocData.status.replaceAll('_', ' ') : 'Status not available'}
        </p>
        {!cocData.status && <p>No current assessment has been imported for this CoC. Annual PIT counts cannot establish this status.</p>}
        <p><Link to="/functional-zero">View documented historical achievements by community and population</Link></p>
      </div>
    </div>
  )
}

export default CoCDetail
