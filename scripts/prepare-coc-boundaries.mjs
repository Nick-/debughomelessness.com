import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';

// HUD's published grantee-area layer describes FY2024, even though its last
// edit was in 2025. Keep boundary vintage separate from the PIT count year.
const source = 'https://services.arcgis.com/VTyQ9soqVukalItT/arcgis/rest/services/Continuum_of_Care_Grantee_Areas/FeatureServer/0';
const query = new URL(`${source}/query`);
query.search = new URLSearchParams({
  where: '1=1', outFields: 'COCNUM,COCNAME', returnGeometry: 'true',
  outSR: '4326', maxAllowableOffset: '0.005', geometryPrecision: '5', f: 'geojson',
});
const response = await fetch(query, { signal: AbortSignal.timeout(120000) });
assert.ok(response.ok, `HUD download failed: ${response.status}`);
const data = await response.json();
assert.equal(data.type, 'FeatureCollection');
assert.ok(!data.exceededTransferLimit, 'HUD response was truncated');
assert.ok(data.features.length >= 380, 'Unexpectedly incomplete boundary coverage');
const ids = new Set();
function validateCoordinates(coordinates) {
  if (typeof coordinates[0] === 'number') {
    assert.ok(Number.isFinite(coordinates[0]) && Math.abs(coordinates[0]) <= 180);
    assert.ok(Number.isFinite(coordinates[1]) && Math.abs(coordinates[1]) <= 90);
  } else {
    assert.ok(coordinates.length > 0, 'Empty geometry');
    coordinates.forEach(validateCoordinates);
  }
}
const features = data.features.map(feature => {
  const id = feature.properties.COCNUM;
  assert.match(id, /^[A-Z]{2}-\d{3}$/);
  assert.ok(!ids.has(id), `Duplicate CoC: ${id}`);
  ids.add(id);
  assert.ok(['Polygon', 'MultiPolygon'].includes(feature.geometry?.type));
  validateCoordinates(feature.geometry.coordinates);
  // Put Alaska's Aleutian islands in the same world copy as the mainland.
  function unwrap(coordinates) {
    if (typeof coordinates[0] === 'number') {
      return [id.startsWith('AK-') && coordinates[0] > 0 ? coordinates[0] - 360 : coordinates[0], coordinates[1]];
    }
    return coordinates.map(unwrap);
  }
  return { type: 'Feature', properties: { coc_id: id, name: feature.properties.COCNAME },
    geometry: { ...feature.geometry, coordinates: unwrap(feature.geometry.coordinates) } };
});
const output = new URL('../frontend/public/data/', import.meta.url);
await mkdir(output, { recursive: true });
await writeFile(new URL('coc-boundaries.json', output), JSON.stringify({
  type: 'FeatureCollection', metadata: { source, boundary_year: 2024,
    downloaded_at: new Date().toISOString(), simplification_degrees: 0.005,
    note: 'HUD FY2024 boundaries simplified for display. Alaska longitudes unwrapped across the antimeridian.' },
  features,
}) + '\n');
console.log(`Prepared ${features.length} verified HUD FY2024 CoC boundaries.`);
