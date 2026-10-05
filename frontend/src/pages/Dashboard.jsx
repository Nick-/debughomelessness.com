import React, { useState, useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import './Dashboard.css'
import { getCocs, getMetrics, getFunctionalZeroStatus } from '../services/api'
import CoCMap from '../components/CoCMap'

const Dashboard = () => {
  const { hash } = useLocation()
  const [cocData, setCocData] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [latestYear, setLatestYear] = useState(null)
  const [assessmentCount, setAssessmentCount] = useState(0)

  useEffect(() => {
    if (!loading && hash === '#coc-map') document.getElementById('coc-map')?.scrollIntoView()
  }, [hash, loading])

  useEffect(() => {
    let active = true
    Promise.all([getCocs(), getMetrics(), getFunctionalZeroStatus()])
      .then(([cocs, metrics, statuses]) => {
        if (!active) return
        const pits = metrics.filter(m => m.metric_type === 'pit_count')
        const year = pits.length ? Math.max(...pits.map(m => m.year)) : null
        setLatestYear(year)
        const currentCounts = new Map(pits.filter(m => m.year === year).map(m => [m.coc_id, m]))
        const currentMetrics = new Map(metrics.filter(m => m.year === year).map(m => [`${m.coc_id}:${m.metric_type}`, m.value]))
        const currentCocs = cocs.filter(coc => currentCounts.has(coc.coc_id))
        setAssessmentCount(statuses.filter(s => currentCounts.has(s.coc_id)).length)
        setCocData(currentCocs.map(coc => {
          const pit = currentCounts.get(coc.coc_id)
          const status = statuses.find(s => s.coc_id === coc.coc_id)
          return { ...coc, name: coc.name || coc.coc_id, homeless: pit?.value ?? null,
            sheltered: currentMetrics.get(`${coc.coc_id}:pit_sheltered`) ?? null,
            unsheltered: currentMetrics.get(`${coc.coc_id}:pit_unsheltered`) ?? null,
            functionalZero: status?.status === 'functional_zero', status: status?.status }
        }))
      })
      .catch(() => { if (active) setError('Unable to load the dashboard. Please try again later.') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [])

  if (loading) {
    return <div className="loading">Loading dashboard...</div>
  }
  if (error) return <div className="loading" role="alert">{error}</div>
  if (!cocData.length) return <div className="dashboard"><h1 className="dashboard-title">Homelessness KPI Dashboard</h1><p>No verified data has been imported yet. Check back after the first data update.</p></div>

  return (
    <div className="dashboard">
      <h1 className="dashboard-title">Homelessness KPI Dashboard</h1>
      
      <div className="dashboard-stats">
        <div className="stat-card">
          <h3>CoCs reporting in {latestYear}</h3>
          <p className="stat-value">{cocData.length}</p>
        </div>
        <div className="stat-card">
          <h3>Functional Zero</h3>
          <p className="stat-value">{assessmentCount ? cocData.filter(c => c.functionalZero).length : 'Not available'}</p>
          <p>{assessmentCount} CoCs with status assessments</p>
        </div>
        <div className="stat-card">
          <h3>January {latestYear} PIT count</h3>
          <p className="stat-value">{cocData.reduce((sum, c) => sum + c.homeless, 0).toLocaleString()}</p>
        </div>
      </div>

      <CoCMap cocs={cocData} year={latestYear} />

      <div className="dashboard-chart">
        <h2>20 CoCs with the highest PIT counts ({latestYear})</h2>
        <ResponsiveContainer width="100%" height={360}>
          <BarChart data={[...cocData].sort((a, b) => b.homeless - a.homeless).slice(0, 20)} margin={{ bottom: 30 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="coc_id" angle={-45} textAnchor="end" height={65} interval={0} tick={{ fontSize: 11 }} />
            <YAxis />
            <Tooltip labelFormatter={id => cocData.find(c => c.coc_id === id)?.name || id} formatter={value => value.toLocaleString()} />
            <Legend />
            <Bar dataKey="homeless" name="PIT count" fill="#3498db" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="dashboard-coc-list">
        <h2>Continuums of Care</h2>
        <div className="coc-grid">
          {cocData.map(coc => (
            <Link key={coc.coc_id} to={`/coc/${encodeURIComponent(coc.coc_id)}`} className="coc-card">
              <h3>{coc.name}</h3>
              <p>{latestYear} PIT count: {coc.homeless?.toLocaleString() ?? 'Not available'}</p>
              <span className={`status ${!coc.status ? 'unavailable' : coc.functionalZero ? 'functional-zero' : 'not-achieved'}`}>
                {coc.status ? coc.status.replaceAll('_', ' ') : 'Status not available'}
              </span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}

export default Dashboard
