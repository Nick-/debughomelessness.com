import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { GeoJSON, MapContainer, TileLayer, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import './CoCMap.css'
import { ShelterDetails, ShelterMarkers, ShelterViewport, useShelterData } from './ShelterExplorer'
import { sheltersForCoC } from '../services/shelter-data'
import { analytics } from '../services/analytics'
import { useSearchAnalytics } from '../services/use-search-analytics'

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
  const [showShelters, setShowShelters] = useState(true)
  const [shelterMetric, setShelterMetric] = useState('capacity')
  const [selectedShelterId, setSelectedShelterId] = useState(null)
  const [shelterFocus, setShelterFocus] = useState(0)
  const shelterInventory = useShelterData()
  const layerRef = useRef(null)
  const canvasRef = useRef(null)
  const byId = useMemo(() => new Map(cocs.map(coc => [coc.coc_id, coc])), [cocs])
  const selected = byId.get(selectedId)
  const shelters = useMemo(() => sheltersForCoC(shelterInventory.data, selected?.coc_id), [shelterInventory.data, selected?.coc_id])
  const selectedShelter = shelters.find(shelter => shelter.id === selectedShelterId)

  function selectCoC(id, method = 'map') {
    setSelectedId(id)
    setSelectedShelterId(null)
    if (id) analytics.track('coc_select', { coc_id: id,
      coc_state: byId.get(id)?.state.replaceAll(' ', ''), selection_method: method })
  }
  function selectShelter(id, method = 'map') {
    setShowShelters(true)
    setSelectedShelterId(id)
    setShelterFocus(value => value + 1)
    analytics.track('shelter_select', { coc_id: selected?.coc_id, shelter_id: id, selection_method: method })
  }
  function toggleShelters(enabled) {
    setShowShelters(enabled)
    analytics.track('shelter_toggle', { enabled })
  }

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
      .catch(err => { if (err.name !== 'AbortError') {
        setError(true)
        analytics.track('data_load_error', { data_section: 'boundaries' })
      } })
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
  const reportSearch = useSearchAnalytics('coc_search', query, results.length, state || 'all')
  const visible = useMemo(() => ({ type: 'FeatureCollection',
    features: results.map(coc => features.get(coc.coc_id)).filter(Boolean) }), [results, features])
  const layerKey = visible.features.map(feature => feature.properties.coc_id).join(',')
  const mappedCount = cocs.filter(coc => features.has(coc.coc_id)).length
  const selectedFeature = features.get(selectedId)

  function style(feature) {
    const coc = byId.get(feature.properties.coc_id)
    const active = coc?.coc_id === selectedId
    return { color: active ? '#f59e0b' : '#47677c', weight: active ? 3 : 1,
      fillColor: color(coc?.homeless), fillOpacity: active ? (showShelters ? 0.12 : 0.65) : 0.45 }
  }

  useEffect(() => {
    layerRef.current?.eachLayer(layer => {
      layer.setStyle(style(layer.feature))
      const path = layer.getElement()
      path?.setAttribute('aria-pressed', String(layer.feature.properties.coc_id === selectedId))
      if (layer.feature.properties.coc_id === selectedId) layer.bringToFront()
    })
  }, [selectedId, layerKey, byId, showShelters])

  function bindFeature(feature, layer) {
    const id = feature.properties.coc_id
    const coc = byId.get(id)
    const label = document.createElement('span')
    label.textContent = `${coc.name} (${id}) · ${year} PIT: ${count(coc.homeless)}`
    layer.bindTooltip(label, { sticky: true })
    layer.on('click', () => selectCoC(id))
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
          selectCoC(id)
        }
      })
    })
  }

  return (
    <section className="coc-map-section" id="coc-map" aria-labelledby="coc-map-title">
      <div className="coc-map-heading">
        <div>
          <h2 id="coc-map-title">Explore Continuums of Care</h2>
          <p>Choose a CoC to explore its counts and public shelter locations. Numbered shelter pins show capacity or occupancy where published.</p>
        </div>
        <span className="coc-map-year">January {year} PIT counts</span>
      </div>
      <div className="coc-map-layout">
        <div className="coc-map-main">
          <div className="coc-map-toolbar">
            <label>Map view
              <select value={region} onChange={event => {
                setRegion(event.target.value); selectCoC(null)
                analytics.track('map_region_change', { map_region: event.target.value })
              }}>
                {Object.keys(views).map(view => <option key={view}>{view}</option>)}
              </select>
            </label>
            <label className="coc-map-shelter-toggle"><input type="checkbox" checked={showShelters}
              onChange={event => toggleShelters(event.target.checked)} />Show shelters</label>
            <label>Shelter numbers
              <select value={shelterMetric} onChange={event => {
                setShelterMetric(event.target.value)
                analytics.track('shelter_metric_change', { shelter_metric: event.target.value })
              }}>
                <option value="capacity">Bed capacity</option><option value="occupancy">Occupancy</option>
              </select>
            </label>
            {showShelters && shelters.length > 0 && <button type="button" onClick={() => {
              setSelectedShelterId(null); setShelterFocus(value => value + 1)
            }}>Fit shelters</button>}
            <button type="button" onClick={() => { selectCoC(null); setReset(value => value + 1) }}>Reset view</button>
          </div>
          <div ref={canvasRef} className="coc-map-canvas" aria-label="Interactive map of Continuum of Care boundaries and public shelters">
            {!boundaries ? (
              <div className="coc-map-message" role={error ? 'alert' : 'status'}>
                {error ? <><p>Unable to load the map. You can still choose a CoC from the list.</p><button type="button" onClick={() => setRetry(value => value + 1)}>Retry map</button></> : 'Loading CoC boundaries…'}
              </div>
            ) : (
              <MapContainer center={[38, -96]} zoom={4} zoomSnap={0.25} minZoom={2} maxZoom={18} scrollWheelZoom={true}>
                <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                  url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" />
                <GeoJSON key={layerKey} ref={layerRef} data={visible} style={style} onEachFeature={bindFeature} />
                <MapView selectedFeature={selectedFeature} region={region} reset={reset} />
                {showShelters && <>
                  <ShelterMarkers shelters={shelters} metric={shelterMetric} selectedId={selectedShelterId} onSelect={selectShelter} focus={shelterFocus} />
                  <ShelterViewport shelters={shelters} selectedShelter={selectedShelter} focus={shelterFocus} />
                </>}
              </MapContainer>
            )}
          </div>
          <div className="coc-map-legend" aria-label="Map legend: PIT count">
            <strong>PIT count</strong>
            {bands.map(band => <span key={band.label}><i style={{ background: band.color }} />{band.label}</span>)}
            {showShelters && <span><b className="shelter-legend-pin">#</b>Shelter · {shelterMetric === 'capacity' ? 'beds' : 'people'} · — = not reported</span>}
          </div>
        </div>
        <aside className="coc-map-sidebar" aria-label="Find a CoC and view information">
          <div className="coc-map-filters">
            <label htmlFor="coc-map-search">Find a CoC</label>
            <input id="coc-map-search" type="search" value={query} placeholder="Name, state abbreviation, or CoC ID"
              onBlur={reportSearch} onKeyDown={event => { if (event.key === 'Enter') reportSearch() }}
              onChange={event => { setQuery(event.target.value); selectCoC(null) }} />
            <label htmlFor="coc-map-state">State or territory</label>
            <select id="coc-map-state" value={state} onChange={event => {
              setState(event.target.value); selectCoC(null)
              analytics.track('coc_state_filter', { state_filter: event.target.value || 'all' })
            }}>
              <option value="">All states and territories</option>
              {states.map(item => <option key={item}>{item}</option>)}
            </select>
          </div>
          <div className="coc-map-selection" aria-live="polite">
            {selected ? <>
              <div className="coc-map-selection-header"><span>{selected.coc_id} · {selected.state}</span>
                <button type="button" aria-label="Close selected CoC" onClick={() => selectCoC(null)}>×</button></div>
              <h3>{selected.name}</h3>
              <dl>
                <div><dt>{year} PIT count</dt><dd>{count(selected.homeless)}</dd></div>
                <div><dt>Sheltered</dt><dd>{count(selected.sheltered)}</dd></div>
                <div><dt>Unsheltered</dt><dd>{count(selected.unsheltered)}</dd></div>
                <div><dt>Population</dt><dd>{count(selected.population)}</dd></div>
                <div><dt>Functional Zero assessment</dt><dd>{selected.status?.replaceAll('_', ' ') ?? 'No current assessment imported'}</dd></div>
              </dl>
              {shelterInventory.data && <p className="coc-map-shelter-coverage">{shelters.length ?
                `${shelters.length} shelter sites mapped below. ${shelterInventory.data.coverage.find(entry => entry.coc_id === selected.coc_id)?.status === 'complete' ? 'Complete published inventory.' : 'Partial inventory.'} ${shelters.every(shelter => shelter.occupancy.value === null) ? 'Occupancy not reported in the imported source.' : 'See dated occupancy values below.'}` :
                'Shelter-level data not yet imported for this CoC.'}</p>}
              <p><Link to="/functional-zero">View historical Functional Zero achievements</Link></p>
              {boundaries && !selectedFeature && <p className="coc-map-missing">A boundary for this CoC is unavailable in HUD’s FY{boundaries.metadata.boundary_year} map.</p>}
              <Link className="coc-map-detail-link" to={`/coc/${encodeURIComponent(selected.coc_id)}`}>View full details & trends →</Link>
            </> : <p>Select a region on the map or a CoC below to view its PIT counts and details.</p>}
          </div>
          <p className="coc-map-result-count" role="status">{results.length} CoC{results.length === 1 ? '' : 's'} found</p>
          <ul className="coc-map-results">
            {results.map(coc => <li key={coc.coc_id}><button type="button" aria-pressed={selectedId === coc.coc_id}
              onClick={() => selectCoC(coc.coc_id, 'list')}>
              <span>{coc.name}</span><small>{coc.coc_id} · PIT {count(coc.homeless)}</small>
            </button></li>)}
            {!results.length && <li className="coc-map-no-results">No CoCs match. Try another name or clear the filters.</li>}
          </ul>
        </aside>
      </div>
      {shelterInventory.error ? <div className="shelter-details" role="alert"><p>Unable to load shelter data. CoC counts are still available.</p>
        <button type="button" onClick={shelterInventory.retry}>Retry shelter data</button></div> :
        !shelterInventory.data ? <p className="coc-map-source" role="status">Loading shelter data…</p> :
        <ShelterDetails selected={selected} inventory={shelterInventory.data} shelters={shelters}
          selectedId={selectedShelterId} onSelect={id => {
            selectShelter(id, 'list')
            canvasRef.current?.scrollIntoView({ block: 'start', behavior: 'smooth' })
          }} shown={showShelters} onShow={() => toggleShelters(true)} />}
      <p className="coc-map-source">
        {boundaries && <>Boundaries: <a href={boundaries.metadata.source} target="_blank" rel="noreferrer">HUD FY{boundaries.metadata.boundary_year}</a>, simplified for display. {mappedCount} of {cocs.length} reporting CoCs mapped. </>}
        Counts are January {year} estimates, not a live census. All reporting CoCs are accessible in the list.
      </p>
    </section>
  )
}
