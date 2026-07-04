// Hand-authored IT corridor polygons (Chennai/Bengaluru/Hyderabad/Delhi only)
// — canonical source is this file; frontend/src/data/layers/it-corridors.json
// is a plain copy of it (same GeoJSON shape, no transform needed unlike
// metro-lines' custom schema). Loaded once at startup, same pattern as
// metro.service.js / areas.service.js.
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import path from 'path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DATA_FILE = path.join(__dirname, '../../data/it-corridors.json')

const GEOJSON = JSON.parse(readFileSync(DATA_FILE, 'utf-8'))

export function getItCorridors(city) {
  if (!city) return GEOJSON
  return {
    ...GEOJSON,
    features: GEOJSON.features.filter((f) => f.properties.city === city),
  }
}
