import React, { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import './CoCDetail.css'

const CoCDetail = () => {
  const { cocId } = useParams()
  const [cocData, setCocData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // TODO: Fetch actual data from API
    setTimeout(() => {
      setCocData({
        coc_id: cocId,
        name: `Continuum of Care ${cocId}`,
        state: 'CA',
        population: 500000,
        functional_zero: false,
        current_homeless: 150,
        benchmark: 150,
        historical_data: [
          { year: 2019, homeless: 200 },
          { year: 2020, homeless: 250 },
          { year: 2021, homeless: 180 },
          { year: 2022, homeless: 160 },
          { year: 2023, homeless: 150 },
        ]
      })
      setLoading(false)
    }, 1000)
  }, [cocId])

  if (loading) {
    return <div className="loading">Loading CoC details...</div>
  }

  return (
    <div className="coc-detail">
      <h1 className="coc-title">{cocData.name}</h1>
      
      <div className="coc-info">
        <div className="info-card">
          <h3>State</h3>
          <p>{cocData.state}</p>
        </div>
        <div className="info-card">
          <h3>Population</h3>
          <p>{cocData.population.toLocaleString()}</p>
        </div>
        <div className="info-card">
          <h3>Current Homeless</h3>
          <p>{cocData.current_homeless}</p>
        </div>
        <div className="info-card">
          <h3>Functional Zero Benchmark</h3>
          <p>{cocData.benchmark}</p>
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
        <p className={`status ${cocData.functional_zero ? 'achieved' : 'not-achieved'}`}>
          {cocData.functional_zero ? 'Achieved' : 'Not Achieved'}
        </p>
      </div>
    </div>
  )
}

export default CoCDetail