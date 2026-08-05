import React, { useState, useEffect } from 'react'
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts'
import './FunctionalZero.css'

const FunctionalZero = () => {
  const [functionalZeroData, setFunctionalZeroData] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // TODO: Fetch actual data from API
    setTimeout(() => {
      setFunctionalZeroData([
        { name: 'Functional Zero', value: 15, color: '#27ae60' },
        { name: 'Approaching', value: 8, color: '#f39c12' },
        { name: 'Not Achieved', value: 27, color: '#e74c3c' },
      ])
      setLoading(false)
    }, 1000)
  }, [])

  if (loading) {
    return <div className="loading">Loading Functional Zero data...</div>
  }

  const total = functionalZeroData.reduce((sum, item) => sum + item.value, 0)

  return (
    <div className="functional-zero">
      <h1 className="page-title">Functional Zero Progress</h1>
      
      <div className="functional-zero-content">
        <div className="chart-container">
          <h2>Overall Status Distribution</h2>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={functionalZeroData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {functionalZeroData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="stats-container">
          <div className="stat-item">
            <h3>Total CoCs</h3>
            <p className="stat-value">{total}</p>
          </div>
          <div className="stat-item">
            <h3>Functional Zero</h3>
            <p className="stat-value achieved">{functionalZeroData[0].value}</p>
            <p className="stat-percentage">
              {((functionalZeroData[0].value / total) * 100).toFixed(1)}%
            </p>
          </div>
          <div className="stat-item">
            <h3>Approaching</h3>
            <p className="stat-value approaching">{functionalZeroData[1].value}</p>
            <p className="stat-percentage">
              {((functionalZeroData[1].value / total) * 100).toFixed(1)}%
            </p>
          </div>
          <div className="stat-item">
            <h3>Not Achieved</h3>
            <p className="stat-value not-achieved">{functionalZeroData[2].value}</p>
            <p className="stat-percentage">
              {((functionalZeroData[2].value / total) * 100).toFixed(1)}%
            </p>
          </div>
        </div>
      </div>

      <div className="benchmark-info">
        <h2>What is Functional Zero?</h2>
        <p>
          Functional Zero is achieved when a community has fewer than 3 people experiencing 
          homelessness per 10,000 people in the general population. This benchmark, established 
          by the U.S. Department of Housing and Urban Development (HUD), represents a sustainable 
          end to homelessness.
        </p>
        <div className="benchmark-details">
          <div className="benchmark-item">
            <h3>Benchmark</h3>
            <p>&lt; 3 people per 10,000</p>
          </div>
          <div className="benchmark-item">
            <h3>Calculation</h3>
            <p>(Homeless Population / Total Population) × 10,000</p>
          </div>
          <div className="benchmark-item">
            <h3>Goal</h3>
            <p>Sustainable, measurable end to homelessness</p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default FunctionalZero