const bedFields = ['family_beds', 'adult_beds', 'child_beds', 'seasonal_beds', 'overflow_beds']
const isCount = value => Number.isSafeInteger(value) && value >= 0
const isSource = value => typeof value === 'string' && /^https:\/\//.test(value)

// Reject an incomplete or malformed snapshot rather than silently inventing values.
export function validateShelterData(data) {
  if (!data || !Array.isArray(data.shelters) || !Array.isArray(data.coverage) ||
      !/^\d{4}-\d{2}-\d{2}$/.test(data.reviewed_at || '')) throw new Error('Invalid shelter inventory')
  const ids = new Set()
  const numbers = new Set()
  const covered = new Set()
  for (const entry of data.coverage) {
    if (!/^[A-Z]{2}-\d{3}$/.test(entry.coc_id) || covered.has(entry.coc_id) ||
        !['partial', 'complete'].includes(entry.status) || !entry.note) throw new Error('Invalid shelter coverage')
    covered.add(entry.coc_id)
  }
  for (const shelter of data.shelters) {
    const { capacity, occupancy, location } = shelter
    const numberKey = `${shelter.coc_id}:${shelter.number}`
    if (!shelter.id || ids.has(shelter.id) || numbers.has(numberKey) || !isCount(shelter.number) || shelter.number < 1 ||
        !covered.has(shelter.coc_id) || !shelter.name || !shelter.provider || !shelter.address ||
        !isSource(shelter.address_source)) throw new Error('Invalid shelter identity')
    ids.add(shelter.id)
    numbers.add(numberKey)
    if (!location || !Number.isFinite(location.lat) || Math.abs(location.lat) > 90 ||
        !Number.isFinite(location.lng) || Math.abs(location.lng) > 180 || !isSource(location.source) ||
        !location.matched_address || !location.method) throw new Error('Invalid shelter location')
    if (!capacity || !occupancy) throw new Error('Missing shelter metrics')
    if (capacity.value !== null && (!isCount(capacity.value) || !capacity.period || !isSource(capacity.source))) {
      throw new Error('Invalid shelter capacity')
    }
    if (capacity.value !== null && bedFields.every(field => isCount(capacity[field])) &&
        bedFields.reduce((total, field) => total + capacity[field], 0) !== capacity.value) {
      throw new Error('Shelter beds do not reconcile')
    }
    if (occupancy.value !== null && (!isCount(occupancy.value) || !occupancy.as_of || !isSource(occupancy.source))) {
      throw new Error('Occupancy requires a dated source')
    }
  }
  return data
}

export function sheltersForCoC(data, cocId) {
  return (data?.shelters || []).filter(shelter => shelter.coc_id === cocId).sort((a, b) => a.number - b.number)
}

export function shelterMetricLabel(shelter, metric) {
  const value = shelter[metric].value
  return value === null ? `${metric === 'capacity' ? 'Capacity' : 'Occupancy'} not reported` :
    `${value.toLocaleString()} ${metric === 'capacity' ? 'beds' : 'people'}`
}
