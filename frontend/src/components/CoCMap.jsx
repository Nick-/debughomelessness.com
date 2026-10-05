import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { GeoJSON, MapContainer, TileLayer, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import './CoCMap.css'

const views = {
  'Contiguous U.S.': [[24, -125], [50, -66]],
  Alaska: [[51, -180], [72, -129]],
  Hawaii: [[18.8, -160.5], [22.5, -154.5]],
  'Puerto Rico & U.S. Virgin Islands': [[17.5, -68], [18.7, -64.4]],
  Guam: [[13.1, 144.5], [13.7, 145.1]],
}
const bands = [
  { max: 500, color: '#d7eaf5', label: '0–499' },
  { max: 2000, color: '#8ec5e3', label: '500–1,999' },
  { max: 5000, color: '#4198c6', label: '2,000–4,999' },
  { max: 10000, color: '#186891', label: '5,000–9,999' },
  { max: Infinity, color: '#0d3c59', label: '10,000+' },
]
const count = value => value?.toLocaleString() ?? 'Not available'
const color = value => value == null ? '#e5e7eb' : bands.find(band => value < band.max).color

function MapView({ selectedFeature, region, reset }) {
  const map = useMap()
  useEffect(() => {
    map.fitBounds(views[region], { padding: [15, 15], animate: false })
  }, [map, region, reset])
  useEffect(() => {
    if (selectedFeature) map.fitBounds(L.geoJSON(selectedFeature).getBounds(), { padding: [30, 30], maxZoom: 10 })
  }, [map, selectedFeature])
  useEffect(() => {
    const observer = new ResizeObserver(() => map.invalidateSize())
    observer.observe(map.getContainer())
    return () => observer.disconnect()
  }, [map])
  return null
}

export default function CoCMap({ cocs, year }) {
  const [boundaries, setBoundaries] = useState(null)
  const [error, setError] = useState(false)
  const [retry, setRetry] = useState(0)
  const [query, setQuery] = useState('')
  const [state, setState] = useState('')
  const [selectedId, setSelectedId] = useState(null)
  const [region, setRegion] = useState('Contiguous U.S.')
  const [reset, setReset] = useState(0)
  const layerRef = useRef(null)
  const byId = useMemo(() => new Map(cocs.map(coc => [coc.coc_id, coc])), [cocs])
  const selected = byId.get(selectedId)

  useEffect(() => {
    const controller = new AbortController()
    setError(false)
    fetch('/data/coc-boundaries.json', { signal: controller.signal })
      .then(response => {
        if (!response.ok) throw new Error('Boundary download failed')
        return response.json()
      })
      .then(data => {
        if (data.type !== 'FeatureCollection' || !Array.isArray(data.features)) throw new Error('Invalid boundaries')
        setBoundaries(data)
      })
      .catch(err => { if (err.name !== 'AbortError') setError(true) })
    return () => controller.abort()
  }, [retry])

  const features = useMemo(() => new Map((boundaries?.features || []).map(feature => [feature.properties.coc_id, feature])), [boundaries])
  const states = useMemo(() => [...new Set(cocs.flatMap(coc => coc.state.split(',').map(part => part.trim())))].sort(), [cocs])
  const results = useMemo(() => {
    const term = query.trim().toLowerCase()
    return cocs.filter(coc => (!state || coc.state.split(',').map(part => part.trim()).includes(state)) &&
      (!term || `${coc.coc_id} ${coc.name} ${coc.state}`.toLowerCase().includes(term)))
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [cocs, query, state])
  const visible = useMemo(() => ({ type: 'FeatureCollection',
    features: results.map(coc => features.get(coc.coc_id)).filter(Boolean) }), [results, features])
  const layerKey = visible.features.map(feature => feature.properties.coc_id).join(',')
  const mappedCount = cocs.filter(coc => features.has(coc.coc_id)).length
  const selectedFeature = features.get(selectedId)

  function style(feature) {
    const coc = byId.get(feature.properties.coc_id)
    const active = coc?.coc_id === selectedId
    return { color: active ? '#f59e0b' : '#47677c', weight: active ? 3 : 1,
      fillColor: color(coc?.homeless), fillOpacity: active ? 0.9 : 0.65 }
  }

  useEffect(() => {
    layerRef.current?.eachLayer(layer => {
      layer.setStyle(style(layer.feature))
      const path = layer.getElement()
      path?.setAttribute('aria-pressed', String(layer.feature.properties.coc_id === selectedId))
      if (layer.feature.properties.coc_id === selectedId) layer.bringToFront()
    })
  }, [selectedId, layerKey, byId])

  function bindFeature(feature, layer) {
    const id = feature.properties.coc_id
    const coc = byId.get(id)
    const label = document.createElement('span')
    label.textContent = `${coc.name} (${id}) · ${year} PIT: ${count(coc.homeless)}`
    layer.bindTooltip(label, { sticky: true })
    layer.on('click', () => setSelectedId(id))
    layer.on('add', () => {
      const path = layer.getElement()
      if (!path) return
      path.setAttribute('tabindex', '0')
      path.setAttribute('role', 'button')
      path.setAttribute('aria-label', `View ${coc.name} (${id})`)
      path.setAttribute('aria-pressed', String(id === selectedId))
      path.addEventListener('keydown', event => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          event.stopPropagation()
          setSelectedId(id)
        }
      })
    })
  }

  return (
    <section className="coc-map-section" id="coc-map" aria-labelledby="coc-map-title">
      <div className="coc-map-heading">
        <div>
          <h2 id="coc-map-title">Explore Continuums of Care</h2>
          <p>Click a region or choose a CoC to see its information.</p>
        </div>
        <span className="coc-map-year">January {year} PIT counts</span>
      </div>
      <div className="coc-map-layout">
        <div className="coc-map-main">
          <div className="coc-map-toolbar">
            <label>Map view
              <select value={region} onChange={event => { setRegion(event.target.value); setSelectedId(null) }}>
                {Object.keys(views).map(view => <option key={view}>{view}</option>)}
              </select>
            </label>
            <button type="button" onClick={() => { setSelectedId(null); setReset(value => value + 1) }}>Reset view</button>
          </div>
          <div className="coc-map-canvas" aria-label="Interactive map of Continuum of Care boundaries">
            {!boundaries ? (
              <div className="coc-map-message" role={error ? 'alert' : 'status'}>
                {error ? <><p>Unable to load the map. You can still choose a CoC from the list.</p><button type="button" onClick={() => setRetry(value => value + 1)}>Retry map</button></> : 'Loading CoC boundaries…'}
              </div>
            ) : (
              <MapContainer center={[38, -96]} zoom={4} zoomSnap={0.25} minZoom={2} maxZoom={13} scrollWheelZoom={false}>
                <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                  url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" />
                <GeoJSON key={layerKey} ref={layerRef} data={visible} style={style} onEachFeature={bindFeature} />
                <MapView selectedFeature={selectedFeature} region={region} reset={reset} />
              </MapContainer>
            )}
          </div>
          <div className="coc-map-legend" aria-label="Map legend: PIT count">
            <strong>PIT count</strong>
            {bands.map(band => <span key={band.label}><i style={{ background: band.color }} />{band.label}</span>)}
          </div>
        </div>
        <aside className="coc-map-sidebar" aria-label="Find a CoC and view information">
          <div className="coc-map-filters">
            <label htmlFor="coc-map-search">Find a CoC</label>
            <input id="coc-map-search" type="search" value={query} placeholder="Name, state abbreviation, or CoC ID"
              onChange={event => setQuery(event.target.value)} />
            <label htmlFor="coc-map-state">State or territory</label>
            <select id="coc-map-state" value={state} onChange={event => setState(event.target.value)}>
              <option value="">All states and territories</option>
              {states.map(item => <option key={item}>{item}</option>)}
            </select>
          </div>
          <div className="coc-map-selection" aria-live="polite">
            {selected ? <>
              <div className="coc-map-selection-header"><span>{selected.coc_id} · {selected.state}</span>
                <button type="button" aria-label="Close selected CoC" onClick={() => setSelectedId(null)}>×</button></div>
              <h3>{selected.name}</h3>
              <dl>
                <div><dt>{year} PIT count</dt><dd>{count(selected.homeless)}</dd></div>
                <div><dt>Sheltered</dt><dd>{count(selected.sheltered)}</dd></div>
                <div><dt>Unsheltered</dt><dd>{count(selected.unsheltered)}</dd></div>
                <div><dt>Population</dt><dd>{count(selected.population)}</dd></div>
                <div><dt>Functional Zero</dt><dd>{selected.status?.replaceAll('_', ' ') ?? 'Not available'}</dd></div>
              </dl>
              {boundaries && !selectedFeature && <p className="coc-map-missing">A boundary for this CoC is unavailable in HUD’s FY{boundaries.metadata.boundary_year} map.</p>}
              <Link className="coc-map-detail-link" to={`/coc/${encodeURIComponent(selected.coc_id)}`}>View full details & trends →</Link>
            </> : <p>Select a region on the map or a CoC below to view its PIT counts and details.</p>}
          </div>
          <p className="coc-map-result-count" role="status">{results.length} CoC{results.length === 1 ? '' : 's'} found</p>
          <ul className="coc-map-results">
            {results.map(coc => <li key={coc.coc_id}><button type="button" aria-pressed={selectedId === coc.coc_id}
              onClick={() => setSelectedId(coc.coc_id)}>
              <span>{coc.name}</span><small>{coc.coc_id} · PIT {count(coc.homeless)}</small>
            </button></li>)}
            {!results.length && <li className="coc-map-no-results">No CoCs match. Try another name or clear the filters.</li>}
          </ul>
        </aside>
      </div>
      <p className="coc-map-source">
        {boundaries && <>Boundaries: <a href={boundaries.metadata.source} target="_blank" rel="noreferrer">HUD FY{boundaries.metadata.boundary_year}</a>, simplified for display. {mappedCount} of {cocs.length} reporting CoCs mapped. </>}
        Counts are January {year} estimates, not a live census. All reporting CoCs are accessible in the list.
      </p>
    </section>
  )
}
