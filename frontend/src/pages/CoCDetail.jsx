import React, { useState, useEffect } from 'react'
import { Link, useParams } from 'react-router-dom'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import './CoCDetail.css'
import { getCoc, getCocHistory, getCocMetrics, getCocFunctionalZeroStatus } from '../services/api'

const CoCDetail = () => {
  const { cocId } = useParams()
  const [cocData, setCocData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let active = true
    setLoading(true)
    setError(null)
    Promise.all([getCoc(cocId), getCocHistory(cocId), getCocMetrics(cocId),
      getCocFunctionalZeroStatus(cocId).catch(err => {
        if (err.response?.status === 404) return null
        throw err
      })])
      .then(([coc, history, metrics, status]) => {
        if (!active) return
        const pit = metrics.metrics.filter(m => m.metric_type === 'pit_count').sort((a, b) => b.year - a.year)[0]
        setCocData({ ...coc, name: coc.name || coc.coc_id,
          status: status?.status, current_homeless: pit?.value ?? null, pit_year: pit?.year,
          benchmark: status?.benchmark_population ?? null,
          historical_data: history.data.filter(m => m.metric_type === 'pit_count')
            .map(m => ({ year: m.year, homeless: m.value }))
        })
      })
      .catch(err => { if (active) setError(err.response?.status === 404 ? 'Continuum of Care not found.' : 'Unable to load CoC details. Please try again later.') })
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
        </div>
        <div className="info-card">
          <h3>Latest PIT count {cocData.pit_year ? `(${cocData.pit_year})` : ''}</h3>
          <p>{cocData.current_homeless?.toLocaleString() ?? 'Not available'}</p>
        </div>
        <div className="info-card">
          <h3>Functional Zero Benchmark</h3>
          <p>{cocData.benchmark ?? 'Not available'}</p>
        </div>
      </div>

      <div className="coc-chart">
        <h2>Historical Trends</h2>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={cocData.historical_data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="year" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Line type="monotone" dataKey="homeless" stroke="#3498db" strokeWidth={2} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="coc-status">
        <h2>Functional Zero Status</h2>
        <p className={`status ${cocData.status === 'functional_zero' ? 'achieved' : 'not-achieved'}`}>
          {cocData.status ? cocData.status.replaceAll('_', ' ') : 'Status not available'}
        </p>
      </div>
    </div>
  )
}

export default CoCDetail
