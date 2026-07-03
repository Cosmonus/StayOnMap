// One-off conversion: backend/src/data/metro-lines/{city}.json (real OSM data,
// [lat,lng] pairs) → frontend/src/data/layers/metro-lines.json (GeoJSON
// FeatureCollection, [lng,lat] per spec) — the schema frontend/src/features/
// map/hooks/useMapLayers.js already expects. Not wired into any build step;
// run manually if the source data is refetched/updated.
import { readdirSync, readFileSync, writeFileSync } from 'fs'
import { fileURLToPath } from 'url'
import path from 'path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const SRC_DIR = path.join(__dirname, '../src/data/metro-lines')
const OUT_FILE = path.join(__dirname, '../../frontend/src/data/layers/metro-lines.json')

// Reads whatever {slug}.json files actually exist in SRC_DIR — self-maintaining
// as cities are added/fetched, instead of a hardcoded list that goes stale.
const files = readdirSync(SRC_DIR).filter((f) => f.endsWith('.json'))

const features = []

for (const file of files) {
  const data = JSON.parse(readFileSync(path.join(SRC_DIR, file), 'utf-8'))

  data.lines.forEach((line, i) => {
    features.push({
      type: 'Feature',
      properties: { city: data.city, name: line.name, line: i + 1, color: line.color ?? null },
      geometry: { type: 'LineString', coordinates: line.path.map(([lat, lng]) => [lng, lat]) },
    })
  })

  data.stations.forEach((station) => {
    features.push({
      type: 'Feature',
      properties: { city: data.city, name: station.name, type: 'station' },
      geometry: { type: 'Point', coordinates: [station.lng, station.lat] },
    })
  })
}

writeFileSync(OUT_FILE, JSON.stringify({ type: 'FeatureCollection', features }, null, 2))
console.log(`Wrote ${features.length} features to ${OUT_FILE}`)
