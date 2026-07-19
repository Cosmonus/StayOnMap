// Fetch stage: Overpass → raw-cache envelope on disk. Everything downstream
// (parse/repair/compare/promote) works offline from the cache, so a flaky
// Overpass day costs one refetch, not the ability to iterate on the parser.
import { readFileSync } from 'fs'
import { CITY_CENTERS } from '../../config/cityCenters.js'
import { overpass } from './overpass.js'
import { bboxFor, buildMetroQuery } from './query.js'
import { slugFor } from '../constants.js'
import { writeRaw } from '../store.js'

function envelope(city, bbox, query, { elements, endpoint, elapsedMs, osmDataTimestamp }) {
  return {
    city,
    slug: slugFor(city),
    fetchedAt: new Date().toISOString(),
    endpoint,
    elapsedMs,
    bbox,
    query,
    osmDataTimestamp,
    elements,
  }
}

// Live fetch for one city. `includeRelationIds` comes from the curation
// file's includeRelations (systems like RRTS whose OSM tagging falls outside
// the metro tag net).
export async function fetchCity(city, { endpoint = null, includeRelationIds = [] } = {}) {
  const bbox = bboxFor(CITY_CENTERS[city])
  const query = buildMetroQuery(bbox, includeRelationIds)
  const { json, endpoint: usedEndpoint, elapsedMs } = await overpass(query, { endpoint })
  const env = envelope(city, bbox, query, {
    elements: json.elements ?? [],
    endpoint: usedEndpoint,
    elapsedMs,
    osmDataTimestamp: json.osm3s?.timestamp_osm_base ?? null,
  })
  writeRaw(env)
  return env
}

// Escape hatch for when every Overpass endpoint is unreachable from this
// machine: run the same query by hand at overpass-turbo.eu (the exact query
// string is printed by `metro-engine.mjs fetch` in dry-run), download the
// JSON export, and ingest it here. The envelope records source: 'file' so
// provenance stays honest.
export function ingestFromFile(city, filePath) {
  const json = JSON.parse(readFileSync(filePath, 'utf-8'))
  if (!Array.isArray(json.elements)) {
    throw new Error(`${filePath} is not an Overpass JSON export (no elements array)`)
  }
  const bbox = bboxFor(CITY_CENTERS[city])
  const env = envelope(city, bbox, buildMetroQuery(bbox), {
    elements: json.elements,
    endpoint: `file:${filePath}`,
    elapsedMs: 0,
    osmDataTimestamp: json.osm3s?.timestamp_osm_base ?? null,
  })
  writeRaw(env)
  return env
}
