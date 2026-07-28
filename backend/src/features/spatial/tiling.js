// Splitting a city into Overpass-sized query tiles.
//
// A single query over Delhi's full ~120km box returns enough restaurants to hit
// Overpass's memory ceiling and time out. Tiling keeps every request small and,
// more importantly, makes a failure cost ONE TILE rather than a whole city —
// which is what lets the seeder report partial coverage honestly
// (DataQualityReport.complete) instead of failing all-or-nothing.
//
// Extracted from scripts/fetch-osm-pois.mjs so the geometry can be tested: a
// gap between tiles is invisible at seed time and shows up much later as an
// area that reports "nothing nearby" while being perfectly well mapped.

// Metres per degree of latitude. Constant enough at city scale; the same figure
// poiProvider.js uses for its bbox prefilter.
const KM_PER_DEG_LAT = 111.32

/**
 * A square-ish bounding box `radiusKm` around a point.
 *
 * Longitude is cos-corrected: a degree of longitude narrows towards the poles,
 * so an uncorrected box would be far too wide in Delhi (28°N) and noticeably
 * too wide even in Chennai (13°N).
 */
export function bboxFor({ lat, lng, radiusKm }) {
  const dLat = radiusKm / KM_PER_DEG_LAT
  const dLng = radiusKm / (KM_PER_DEG_LAT * Math.cos((lat * Math.PI) / 180))
  return { south: lat - dLat, west: lng - dLng, north: lat + dLat, east: lng + dLng }
}

/**
 * Split a bbox into an n × n grid, row-major.
 *
 * Tiles share edges exactly (each boundary is computed from the same step, not
 * accumulated), so the grid covers the parent box with no gap and no overlap.
 * A POI sitting precisely on a shared edge is fetched by both neighbours and
 * deduplicated downstream by `osmId` — harmless, and the safe direction to err.
 */
export function tiles(bbox, n) {
  const out = []
  const latStep = (bbox.north - bbox.south) / n
  const lngStep = (bbox.east - bbox.west) / n
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      out.push({
        south: bbox.south + i * latStep,
        north: bbox.south + (i + 1) * latStep,
        west: bbox.west + j * lngStep,
        east: bbox.west + (j + 1) * lngStep,
      })
    }
  }
  return out
}

/**
 * Fetch a tile, QUARTERING it on failure instead of retrying it unchanged.
 *
 * Added 2026-07-28 after the first production seeding attempt: Delhi's tile 1
 * of 9 came back `HTTP 504` from every mirror. 504 from Overpass means the
 * query was too big or too slow — it is a statement about the QUERY, not a
 * blip on the wire. Both seeders' original retry re-issued the identical box,
 * which is the one retry strategy guaranteed to reproduce the failure.
 *
 * Subdividing changes the thing that actually failed. A tile that times out at
 * 1/9th of a city usually succeeds at 1/36th, and the cost is paid only where
 * it is needed rather than by shrinking the grid for every city.
 *
 * Partial success inside a subdivision still counts as failure for the parent
 * tile: rows already gathered are kept (the callback mutates its own
 * collection), but the city is reported incomplete, so stale-row removal is
 * skipped and re-running converges. Silently accepting a hole is how a
 * lakeside address comes to look landlocked.
 *
 * @param {object} tile   {south,west,north,east}
 * @param {(t:object)=>Promise<number>} fetchFn  resolves to a match count
 * @param {object} [opts] {maxDepth=2, onSplit, delayMs}
 * @returns {Promise<number>} total matches across this tile and its children
 */
export async function fetchTileAdaptive(tile, fetchFn, opts = {}) {
  const { maxDepth = 2, depth = 0, onSplit = () => {}, delayMs = 0 } = opts
  try {
    return await fetchFn(tile)
  } catch (err) {
    // Out of subdivisions: this box is genuinely unservable, so let the caller
    // record it as failed rather than pretending it was empty.
    if (depth >= maxDepth) throw err
    onSplit(depth, err)

    // EVERY quarter is attempted, even after one of them fails. Bailing on the
    // first failure would throw away the three siblings that might have
    // succeeded — and since re-running converges on osmId, three quarters of a
    // tile now is strictly better than none. The parent still fails at the end,
    // so the city is reported incomplete and stale-row removal is skipped.
    let total = 0
    let lastError = null
    for (const quad of tiles(tile, 2)) {
      if (delayMs) await new Promise((r) => setTimeout(r, delayMs))
      try {
        total += await fetchTileAdaptive(quad, fetchFn, { ...opts, depth: depth + 1 })
      } catch (quadErr) {
        lastError = quadErr
      }
    }
    if (lastError) throw lastError
    return total
  }
}
