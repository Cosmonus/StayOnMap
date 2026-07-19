// Source metro files → the frontend's bundled GeoJSON.
//
// Logic lifted verbatim from scripts/build-metro-geojson.mjs (now a wrapper
// around this module) so the transform is callable from the engine CLI, the
// promote stage, and the drift test — the drift test is what turns "someone
// forgot to re-run the build script" from a silent stale map into a red CI.
import { copyFileSync, writeFileSync, mkdirSync } from 'fs'
import path from 'path'
import { splitPathIntoComponents, PATH_GAP_METERS } from '../../lib/metro-validation/index.js'
import { FRONTEND_GEOJSON_FILE, IT_CORRIDORS_SRC_FILE, IT_CORRIDORS_OUT_FILE } from '../paths.js'
import { loadShippedCities } from '../store.js'

// Pure: array of city networks → GeoJSON FeatureCollection ([lng,lat] per
// spec; source files are [lat,lng]).
export function buildMetroGeoJson(citiesData) {
  const features = []

  for (const data of citiesData) {
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
      // `lines` holds indices into data.lines; 2+ entries = interchange,
      // 0 = not yet reconcilable with any line in this file (default color).
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

  return { type: 'FeatureCollection', features }
}

// Full export: regenerate the frontend GeoJSON from shipped source files and
// sync the it-corridors copy (backend/src/data/it-corridors.json is the one
// canonical source, served live to mobile via GET /api/v1/it-corridors — the
// frontend copy must never be hand-edited independently).
export function runExport() {
  const collection = buildMetroGeoJson(loadShippedCities())
  mkdirSync(path.dirname(FRONTEND_GEOJSON_FILE), { recursive: true })
  writeFileSync(FRONTEND_GEOJSON_FILE, JSON.stringify(collection, null, 2))
  copyFileSync(IT_CORRIDORS_SRC_FILE, IT_CORRIDORS_OUT_FILE)
  return { featureCount: collection.features.length, outFile: FRONTEND_GEOJSON_FILE }
}
