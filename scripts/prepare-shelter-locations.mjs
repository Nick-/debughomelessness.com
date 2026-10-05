import assert from 'node:assert/strict'
import { readFile, writeFile } from 'node:fs/promises'
import { validateShelterData } from '../frontend/src/services/shelter-data.js'

// Counts are manually transcribed from the cited HIC table after visual review.
// This step geocodes verified public service-site addresses, never provider HQs
// substituted for an unknown service site or a confidential location.
const data = JSON.parse(await readFile(new URL('./shelter-sources.json', import.meta.url), 'utf8'))
for (const shelter of data.shelters) {
  const url = new URL('https://geocoding.geo.census.gov/geocoder/locations/onelineaddress')
  url.search = new URLSearchParams({ address: shelter.address, benchmark: 'Public_AR_Current', format: 'json' })
  const response = await fetch(url, { signal: AbortSignal.timeout(30000) })
  assert.ok(response.ok, `Geocoding failed for ${shelter.id}: ${response.status}`)
  const matches = (await response.json()).result?.addressMatches
  assert.equal(matches?.length, 1, `Expected one address match for ${shelter.id}`)
  const match = matches[0]
  assert.equal(match.addressComponents.state, shelter.coc_id.slice(0, 2))
  assert.ok(shelter.address.endsWith(match.addressComponents.zip), `ZIP mismatch: ${shelter.id}`)
  shelter.location = { lat: match.coordinates.y, lng: match.coordinates.x,
    source: url.href, matched_address: match.matchedAddress,
    method: 'U.S. Census address-range geocode; approximate street location',
    geocoded_at: new Date().toISOString() }
}
validateShelterData(data)
await writeFile(new URL('../frontend/public/data/shelter-locations.json', import.meta.url), JSON.stringify(data, null, 2) + '\n')
console.log(`Prepared ${data.shelters.length} public shelter sites; coverage is explicitly partial.`)
