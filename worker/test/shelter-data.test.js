import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { validateShelterData, sheltersForCoC, shelterMetricLabel } from '../../frontend/src/services/shelter-data.js'

const snapshot = () => JSON.parse(readFileSync(new URL('../../frontend/public/data/shelter-locations.json', import.meta.url), 'utf8'))

test('published shelter snapshot reconciles beds and preserves partial coverage and missing occupancy', () => {
  const data = validateShelterData(snapshot())
  const shelters = sheltersForCoC(data, 'FL-601')
  assert.equal(shelters.length, 5)
  assert.equal(data.coverage[0].status, 'partial')
  assert.deepEqual(shelters.map(s => s.capacity.value), [170, 268, 110, 4, 28])
  assert.ok(shelters.every(s => s.capacity.period === 'January 2025' && s.occupancy.value === null))
  for (const shelter of shelters) {
    assert.ok(shelter.location.lat > 26 && shelter.location.lat < 26.3)
    assert.ok(shelter.location.lng > -80.2 && shelter.location.lng < -80.1)
    assert.equal(shelterMetricLabel(shelter, 'occupancy'), 'Occupancy not reported')
  }
  assert.deepEqual(sheltersForCoC(data, 'FL-600'), [])
})

test('capacity cannot substitute for occupancy and zero occupancy is preserved with provenance', () => {
  const data = snapshot()
  const shelter = data.shelters[0]
  assert.equal(shelterMetricLabel(shelter, 'capacity'), '170 beds')
  assert.equal(shelterMetricLabel(shelter, 'occupancy'), 'Occupancy not reported')
  shelter.occupancy.value = 0
  assert.throws(() => validateShelterData(data), /dated source/)
  shelter.occupancy.as_of = '2026-10-05T09:00:00-04:00'
  shelter.occupancy.source = 'https://example.org/published-occupancy'
  assert.equal(validateShelterData(data).shelters[0].occupancy.value, 0)
  assert.equal(shelterMetricLabel(shelter, 'occupancy'), '0 people')
})

test('rejects duplicate pins, unverified locations, negative counts and inconsistent inventory', () => {
  for (const [edit, message] of [
    [d => { d.shelters[1].number = 1 }, /identity/],
    [d => { d.shelters[0].location.lat = NaN }, /location/],
    [d => { d.shelters[0].location.source = null }, /location/],
    [d => { d.shelters[0].capacity.value = -1 }, /capacity/],
    [d => { d.shelters[0].capacity.value += 1 }, /reconcile/],
    [d => { d.shelters[0].coc_id = 'FL-600' }, /identity/],
  ]) {
    const data = snapshot()
    edit(data)
    assert.throws(() => validateShelterData(data), message)
  }
})
