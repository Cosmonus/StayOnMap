// One-off conversion: backend/src/data/metro-lines/{city}.json (real OSM data,
// [lat,lng] pairs) → frontend/src/data/layers/metro-lines.json (GeoJSON
// FeatureCollection, [lng,lat] per spec) — the schema frontend/src/features/
// map/hooks/useMapLayers.js already expects. Not wired into any build step;
// run manually if the source data is refetched/updated.
//
// Also syncs backend/src/data/it-corridors.json → frontend/src/data/layers/
// it-corridors.json — that file is already GeoJSON, so this is a plain copy,
// not a transform. Same reason as metro: backend/src/data/it-corridors.json
// is the one canonical source (served live to mobile via
// GET /api/v1/it-corridors), so the frontend copy shouldn't be hand-edited
// independently or the two will drift.
import { readdirSync, readFileSync, writeFileSync, copyFileSync } from 'fs'
import { fileURLToPath } from 'url'
import path from 'path'
import { splitPathIntoComponents, PATH_GAP_METERS } from '../src/lib/metro-validation/index.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const SRC_DIR = path.join(__dirname, '../src/data/metro-lines')
const OUT_FILE = path.join(__dirname, '../../frontend/src/data/layers/metro-lines.json')
const IT_SRC_FILE = path.join(__dirname, '../src/data/it-corridors.json')
const IT_OUT_FILE = path.join(__dirname, '../../frontend/src/data/layers/it-corridors.json')

// Reads whatever {slug}.json files actually exist in SRC_DIR — self-maintaining
// as cities are added/fetched, instead of a hardcoded list that goes stale.
const files = readdirSync(SRC_DIR).filter((f) => f.endsWith('.json'))

const features = []

for (const file of files) {
  const data = JSON.parse(readFileSync(path.join(SRC_DIR, file), 'utf-8'))

  data.lines.forEach((line, i) => {
    // A handful of lines have a genuine gap in the source OSM data (no
    // fetchable track geometry for that stretch — see .claude/roadmap.md's
    // Addendum 4/10) — rendering the full path as one LineString draws a
    // straight "fake bridge" across the gap, implying a direct route that
    // doesn't exist. Split into one feature per contiguous component
    // instead, so the map honestly shows the break rather than papering
    // over it.
    const components = splitPathIntoComponents(line.path, PATH_GAP_METERS)
    components.forEach((component, componentIndex) => {
      if (component.length < 2) return
      features.push({
        type: 'Feature',
        properties: {
          city: data.city,
          name: components.length > 1 ? `${line.name} (part ${componentIndex + 1}/${components.length})` : line.name,
          line: i + 1,
          color: line.color ?? null,
        },
        geometry: { type: 'LineString', coordinates: component.map(([lat, lng]) => [lng, lat]) },
      })
    })
  })

  data.stations.forEach((station) => {
    // `lines` (indices into data.lines) is precomputed by proximity match —
    // see .claude/roadmap.md Addendum 6. A station within 2km of 2+ lines'
    // paths is an interchange; 0 matches means it's not yet reconcilable
    // with any line currently in this file (falls back to the default color).
    const matchedLines = (station.lines ?? []).map((i) => data.lines[i]).filter(Boolean)
    features.push({
      type: 'Feature',
      properties: {
        city: data.city,
        name: station.name,
        type: matchedLines.length > 1 ? 'interchange' : 'station',
        color: matchedLines[0]?.color ?? null,
      },
      geometry: { type: 'Point', coordinates: [station.lng, station.lat] },
    })
  })
}

writeFileSync(OUT_FILE, JSON.stringify({ type: 'FeatureCollection', features }, null, 2))
console.log(`Wrote ${features.length} features to ${OUT_FILE}`)

copyFileSync(IT_SRC_FILE, IT_OUT_FILE)
console.log(`Copied ${IT_SRC_FILE} -> ${IT_OUT_FILE}`)
