import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import './Dashboard.css'

const Dashboard = () => {
  const [cocData, setCocData] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // TODO: Fetch actual data from API
    // Mock data for now
    setTimeout(() => {
      setCocData([
        { name: 'CoC-001', homeless: 150, functionalZero: false },
        { name: 'CoC-002', homeless: 75, functionalZero: true },
        { name: 'CoC-003', homeless: 200, functionalZero: false },
        { name: 'CoC-004', homeless: 50, functionalZero: true },
        { name: 'CoC-005', homeless: 300, functionalZero: false },
      ])
      setLoading(false)
    }, 1000)
  }, [])

  if (loading) {
    return <div className="loading">Loading dashboard...</div>
  }

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
          <h3>Total Homeless</h3>
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
            <Link key={coc.name} to={`/coc/${coc.name}`} className="coc-card">
              <h3>{coc.name}</h3>
              <p>Homeless: {coc.homeless}</p>
              <span className={`status ${coc.functionalZero ? 'functional-zero' : 'not-achieved'}`}>
                {coc.functionalZero ? 'Functional Zero' : 'Not Achieved'}
              </span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}

export default Dashboard