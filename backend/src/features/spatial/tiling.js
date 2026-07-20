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
