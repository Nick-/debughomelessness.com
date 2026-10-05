import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import './Dashboard.css'
import { getCocs, getMetrics, getFunctionalZeroStatus } from '../services/api'

const Dashboard = () => {
  const [cocData, setCocData] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let active = true
    Promise.all([getCocs(), getMetrics(), getFunctionalZeroStatus()])
      .then(([cocs, metrics, statuses]) => {
        if (!active) return
        setCocData(cocs.map(coc => {
          const pit = metrics.filter(m => m.coc_id === coc.coc_id && m.metric_type === 'pit_count')
            .sort((a, b) => b.year - a.year)[0]
          const status = statuses.find(s => s.coc_id === coc.coc_id)
          return { ...coc, name: coc.name || coc.coc_id, homeless: pit?.value ?? null,
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
          <h3>Total CoCs</h3>
          <p className="stat-value">{cocData.length}</p>
        </div>
        <div className="stat-card">
          <h3>Functional Zero</h3>
          <p className="stat-value">{cocData.filter(c => c.functionalZero).length}</p>
        </div>
        <div className="stat-card">
          <h3>Latest Available PIT Counts</h3>
          <p className="stat-value">{cocData.reduce((sum, c) => sum + c.homeless, 0)}</p>
        </div>
      </div>

      <div className="dashboard-chart">
        <h2>Homelessness by CoC</h2>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={cocData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Bar dataKey="homeless" fill="#3498db" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="dashboard-coc-list">
        <h2>Continuums of Care</h2>
        <div className="coc-grid">
          {cocData.map(coc => (
            <Link key={coc.coc_id} to={`/coc/${encodeURIComponent(coc.coc_id)}`} className="coc-card">
              <h3>{coc.name}</h3>
              <p>Homeless: {coc.homeless ?? 'Not available'}</p>
              <span className={`status ${coc.functionalZero ? 'functional-zero' : 'not-achieved'}`}>
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
