import React, { useState, useEffect } from 'react'
import './FunctionalZero.css'
import { getFunctionalZeroAchievements, getFunctionalZeroStatus } from '../services/api'

const FunctionalZero = () => {
  const [data, setData] = useState(null)
  const [statuses, setStatuses] = useState(null)
  const [error, setError] = useState(null)
  const [query, setQuery] = useState('')
  const [population, setPopulation] = useState('all')

  useEffect(() => {
    let active = true
    getFunctionalZeroAchievements().then(result => { if (active) setData(result) })
      .catch(() => { if (active) setError('Unable to load achievements. Please try again later.') })
    getFunctionalZeroStatus().then(result => { if (active) setStatuses(result) }).catch(() => { if (active) setStatuses(false) })
    return () => { active = false }
  }, [])

  if (error) return <div className="loading" role="alert">{error}</div>
  if (!data) return <div className="loading">Loading Functional Zero achievements...</div>

  const communities = data.communities.filter(community =>
    `${community.name} ${community.state}`.toLowerCase().includes(query.trim().toLowerCase()) &&
    (population === 'all' || community.populations.includes(population)))
  const counts = [
    { label: 'Communities with achievements', value: data.communities.length },
    { label: 'Veteran homelessness milestones', value: data.communities.filter(c => c.populations.includes('veteran')).length },
    { label: 'Chronic homelessness milestones', value: data.communities.filter(c => c.populations.includes('chronic')).length },
  ]

  return <div className="functional-zero">
    <h1 className="page-title">Functional Zero Achievements</h1>
    <div className="benchmark-info">
      <h2>Documented historical milestones</h2>
      <p>{data.note}</p>
      <p><a href={data.source_url} target="_blank" rel="noreferrer">View the {data.source_name} source list</a>
        {' '}· Source reviewed <time dateTime={data.reviewed_on}>{data.reviewed_on}</time>. This date is our source review date, not an achievement date.</p>
    </div>

    <div className="achievement-stats">
      {counts.map(item => <div className="stat-item" key={item.label}>
        <h3>{item.label}</h3><p className="stat-value achieved">{item.value}</p>
      </div>)}
    </div>
    <p>Communities may have achieved milestones for both populations, so population counts overlap.</p>

    <section className="benchmark-info" aria-labelledby="achievement-list-title">
      <h2 id="achievement-list-title">Communities and populations</h2>
      <div className="achievement-filters">
        <label>Search community or state
          <input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Community name or state abbreviation" />
        </label>
        <label>Population
          <select value={population} onChange={event => setPopulation(event.target.value)}>
            <option value="all">All populations</option>
            <option value="veteran">Veteran homelessness</option>
            <option value="chronic">Chronic homelessness</option>
          </select>
        </label>
      </div>
      <p role="status">{communities.length} of {data.communities.length} documented communities shown</p>
      <div className="achievement-table-wrapper">
        <table className="achievement-table">
          <caption>Historical Functional Zero milestones in the reviewed source list</caption>
          <thead><tr><th scope="col">Community</th><th scope="col">State</th><th scope="col">Population covered</th></tr></thead>
          <tbody>{communities.map(community => <tr key={`${community.state}:${community.name}`}>
            <th scope="row">{community.name}</th><td>{community.state}</td>
            <td>{community.populations.map(p => p === 'veteran' ? 'Veteran homelessness' : 'Chronic homelessness').join('; ')}</td>
          </tr>)}</tbody>
        </table>
      </div>
      {!communities.length && <p>No communities match these filters.</p>}
      <p>The source's community boundaries may differ from HUD CoC boundaries. Absence from this list means no milestone is documented here.</p>
    </section>

    <section className="benchmark-info achievement-methodology">
      <h2>How to interpret these achievements</h2>
      <p>Functional Zero described a community's ability to make homelessness rare and brief for a specific population, using regularly updated, person-level data and housing capacity.</p>
      <p>Annual HUD PIT counts and a general-population rate cannot establish Functional Zero. A historical milestone does not establish a community's current status or an end to homelessness for everyone.</p>
      <h3>Current assessments in this dashboard</h3>
      <p>{statuses === null ? 'Loading current assessment data...' : statuses === false ? 'Current assessment data could not be loaded.' : statuses.length
        ? `${statuses.length} CoCs have stored project assessments. These are separate from the source's historical milestones.`
        : 'No current CoC assessments have been imported. The list above provides sourced historical achievements.'}</p>
    </section>
  </div>
}

export default FunctionalZero
