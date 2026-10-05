import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Marker, Popup, Tooltip, useMap } from 'react-leaflet'
import L from 'leaflet'
import { shelterMetricLabel, validateShelterData } from '../services/shelter-data'

export function useShelterData() {
  const [data, setData] = useState(null)
  const [error, setError] = useState(false)
  const [retry, setRetry] = useState(0)
  useEffect(() => {
    const controller = new AbortController()
    setError(false)
    fetch('/data/shelter-locations.json', { signal: controller.signal })
      .then(response => {
        if (!response.ok) throw new Error('Shelter download failed')
        return response.json()
      })
      .then(value => setData(validateShelterData(value)))
      .catch(err => { if (err.name !== 'AbortError') setError(true) })
    return () => controller.abort()
  }, [retry])
  return { data, error, retry: () => setRetry(value => value + 1) }
}

function CapacitySource({ capacity }) {
  return capacity.source && <a href={`${capacity.source}${capacity.source_page ? `#page=${capacity.source_page}` : ''}`}
    target="_blank" rel="noreferrer">Bed inventory source</a>
}

function ShelterNumbers({ shelter }) {
  return <dl className="shelter-numbers">
    <div><dt>Bed capacity</dt><dd>{shelter.capacity.value === null ? 'Not reported' : shelterMetricLabel(shelter, 'capacity')}
      {shelter.capacity.period && <small>{shelter.capacity.period}</small>}</dd></div>
    <div><dt>Occupancy</dt><dd>{shelter.occupancy.value === null ? 'Not reported' : shelterMetricLabel(shelter, 'occupancy')}
      {shelter.occupancy.as_of && <small>As of {shelter.occupancy.as_of}</small>}</dd></div>
  </dl>
}

function ShelterMarker({ shelter, metric, active, onSelect, focus }) {
  const ref = useRef(null)
  const value = shelter[metric].value
  // Only validated integers and fixed strings enter the Leaflet icon HTML.
  const icon = useMemo(() => L.divIcon({ className: 'shelter-marker', iconSize: [32, 32], iconAnchor: [16, 16], popupAnchor: [0, -18],
    html: `<span class="shelter-location-dot"></span><span class="shelter-pin-value${shelter.label_side === 'left' ? ' shelter-pin-value-left' : ''}"><span class="shelter-pin${active ? ' is-active' : ''}">${shelter.number}</span>${value === null ? '—' : value.toLocaleString()} ${metric === 'capacity' ? 'beds' : 'people'}</span>` }), [active, value, metric, shelter.number, shelter.label_side])
  useEffect(() => {
    const element = ref.current?.getElement()
    element?.setAttribute('aria-label', `Shelter ${shelter.number}: ${shelter.name}. ${shelterMetricLabel(shelter, metric)}`)
    element?.setAttribute('aria-pressed', String(active))
    if (active) ref.current?.openPopup()
    else ref.current?.closePopup()
  }, [active, metric, shelter, focus])
  return <Marker ref={ref} position={[shelter.location.lat, shelter.location.lng]} icon={icon}
    title={`Shelter ${shelter.number}: ${shelter.name}. ${shelterMetricLabel(shelter, metric)}`}
    alt={`Shelter ${shelter.number}: ${shelter.name}`} riseOnHover
    eventHandlers={{ click: () => onSelect(shelter.id) }}>
    <Tooltip>{shelter.name} · {shelterMetricLabel(shelter, metric)}</Tooltip>
    <Popup minWidth={240} maxWidth={300}>
      <div className="shelter-popup">
        <strong>#{shelter.number} {shelter.name}</strong>
        <p>{shelter.address}</p>
        <ShelterNumbers shelter={shelter} />
        <p>{shelter.note}</p>
        <p>Occupancy counts people staying at this site on a stated date. Missing occupancy does not mean zero.</p>
        <CapacitySource capacity={shelter.capacity} />
        {shelter.occupancy.source && <p><a href={shelter.occupancy.source} target="_blank" rel="noreferrer">Occupancy source</a></p>}
        <p className="shelter-geocode-note">Approximate street location from the U.S. Census geocoder.</p>
      </div>
    </Popup>
  </Marker>
}

export function ShelterMarkers({ shelters, metric, selectedId, onSelect, focus }) {
  return shelters.map(shelter => <ShelterMarker key={shelter.id} shelter={shelter} metric={metric}
    active={shelter.id === selectedId} onSelect={onSelect} focus={focus} />)
}

export function ShelterViewport({ shelters, selectedShelter, focus }) {
  const map = useMap()
  useEffect(() => {
    if (shelters.length) map.fitBounds(shelters.map(shelter => [shelter.location.lat, shelter.location.lng]),
      { padding: [60, 60], maxZoom: 13, animate: false })
  }, [map, shelters, focus])
  useEffect(() => {
    if (selectedShelter) map.setView([selectedShelter.location.lat, selectedShelter.location.lng], 15, { animate: false })
  }, [map, selectedShelter, focus])
  useEffect(() => {
    const observer = new ResizeObserver(() => {
      if (!selectedShelter && shelters.length) {
        map.fitBounds(shelters.map(shelter => [shelter.location.lat, shelter.location.lng]),
          { padding: [60, 60], maxZoom: 13, animate: false })
      }
    })
    observer.observe(map.getContainer())
    return () => observer.disconnect()
  }, [map, shelters, selectedShelter])
  return null
}

export function ShelterDetails({ selected, inventory, shelters, selectedId, onSelect, onShow, shown }) {
  if (!selected) return <div className="shelter-details"><p>Select a CoC to explore its shelter locations, capacity and occupancy.</p></div>
  const coverage = inventory?.coverage.find(entry => entry.coc_id === selected.coc_id)
  if (!shelters.length) return <div className="shelter-details" role="status">
    <h3>Shelters in {selected.name}</h3>
    <p>Shelter-level data have not been imported for this CoC. This does not mean there are no shelters.</p>
    <a href="https://www.hud.gov/FindShelter" target="_blank" rel="noreferrer">Find public shelter resources with HUD →</a>
  </div>
  return <section className="shelter-details" aria-labelledby="shelter-details-title">
    <div className="shelter-details-heading">
      <div><h3 id="shelter-details-title">Shelters in {selected.name}</h3>
        <p>{shelters.length} mapped sites · {coverage?.status === 'complete' ? 'Complete published inventory' : 'Partial published inventory'} · Reviewed {inventory.reviewed_at}</p></div>
      {!shown && <button type="button" onClick={onShow}>Show shelters on map</button>}
    </div>
    <p>{coverage?.note}</p>
    <p>Capacity is a dated bed inventory. Occupancy counts people staying at a shelter on a stated date. Neither indicates beds available right now.</p>
    <ol className="shelter-cards">
      {shelters.map(shelter => <li key={shelter.id} className={selectedId === shelter.id ? 'is-active' : ''}>
        <button type="button" className="shelter-card-select" aria-pressed={selectedId === shelter.id}
          onClick={() => onSelect(shelter.id)}>
          <span className="shelter-card-number">{shelter.number}</span>
          <span><strong>{shelter.name}</strong><small>{shelter.provider} · {shelter.type}</small></span>
        </button>
        <p>{shelter.address}</p>
        <ShelterNumbers shelter={shelter} />
        <p className="shelter-card-note">{shelter.note}</p>
        <div className="shelter-card-sources"><CapacitySource capacity={shelter.capacity} />
          <a href={shelter.address_source} target="_blank" rel="noreferrer">Address source</a>
          {shelter.occupancy.source && <a href={shelter.occupancy.source} target="_blank" rel="noreferrer">Occupancy source</a>}
        </div>
      </li>)}
    </ol>
    <p className="shelter-geocode-note">Pins show approximate street locations from the U.S. Census address geocoder. Numbered pins match the shelter list.</p>
  </section>
}
