// Real metro/light-rail network data (lines + stations) sourced from
// OpenStreetMap via the Overpass API — see backend/src/data/metro-lines/*.json
// for the raw files and docs/features/map.md for how they were built. Loaded
// once at startup, same pattern as areas.service.js's area-profiles.json.
import { readdirSync, readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import path from 'path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DATA_DIR = path.join(__dirname, '../../data/metro-lines')

// Reads whatever {slug}.json files actually exist in DATA_DIR — self-
// maintaining as cities are added/fetched, rather than a hardcoded city→file
// map that silently misses newly-added cities (as happened here once already:
// this list was originally hardcoded to only the first 4 cities fetched, and
// stayed stale after 5 more were added until this file was updated).
const NETWORKS = Object.fromEntries(
  readdirSync(DATA_DIR)
    .filter((f) => f.endsWith('.json'))
    .map((file) => {
      const data = JSON.parse(readFileSync(path.join(DATA_DIR, file), 'utf-8'))
      return [data.city, data]
    })
)

export function getMetroNetwork(city) {
  return NETWORKS[city] ?? null
}
