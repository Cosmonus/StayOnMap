// Distance from a point to a shape, in metres, without PostGIS.
//
// Extracted from waterLookup.js when roads needed the same maths. Boundary asks
// "which polygon contains this point" (containment — an exact bbox question);
// water and roads ask "which is CLOSEST", which a bbox cannot answer on its own
// because the nearest shape by edge distance is not necessarily the one with
// the nearest bounding box. So callers use a bbox scan as a candidate generator
// over a search radius and settle it here.
//
// See docs/spatial-intelligence.md §3 for the three things that would justify
// adding PostGIS instead. Row counts at this scale are not among them.
const DEG_LAT_M = 111_320

/**
 * Metres from a point to a line segment, on a locally-flat approximation.
 *
 * Equirectangular rather than great-circle: over the few-kilometre spans this
 * is used for, the error is far below a metre, and the alternative is
 * projecting every vertex of every candidate on every call.
 */
export function pointToSegmentM(pt, a, b) {
  const mPerLng = DEG_LAT_M * Math.cos((pt.lat * Math.PI) / 180)
  const px = (pt.lng - a[0]) * mPerLng
  const py = (pt.lat - a[1]) * DEG_LAT_M
  const bx = (b[0] - a[0]) * mPerLng
  const by = (b[1] - a[1]) * DEG_LAT_M

  const lenSq = bx * bx + by * by
  // Degenerate segment — a duplicated vertex, which is common in OSM geometry
  // (127 of them were found and removed from the metro data alone). Fall back
  // to the endpoint distance rather than dividing by zero.
  if (lenSq === 0) return Math.hypot(px, py)

  const t = Math.max(0, Math.min(1, (px * bx + py * by) / lenSq))
  return Math.hypot(px - t * bx, py - t * by)
}

/** Ray casting on a GeoJSON ring, which is [lng, lat] order. */
export function pointInRing(pt, ring) {
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i]
    const [xj, yj] = ring[j]
    const straddles = yi > pt.lat !== yj > pt.lat
    if (straddles && pt.lng < ((xj - xi) * (pt.lat - yi)) / (yj - yi) + xi) inside = !inside
  }
  return inside
}

/** Every ring of a Polygon or MultiPolygon, outer and inner alike. */
function ringsOf(geometry) {
  if (!geometry) return []
  if (geometry.type === 'Polygon') return geometry.coordinates ?? []
  if (geometry.type === 'MultiPolygon') return (geometry.coordinates ?? []).flat()
  return []
}

/** Every coordinate run of a LineString or MultiLineString. */
function linesOf(geometry) {
  if (!geometry) return []
  if (geometry.type === 'LineString') return [geometry.coordinates ?? []]
  if (geometry.type === 'MultiLineString') return geometry.coordinates ?? []
  return []
}

/** The closest point on a set of coordinate runs, and how far away it is. */
function nearestOnRuns(lat, lng, runs) {
  const pt = { lat, lng }
  let best = Infinity
  let at = null
  for (const run of runs) {
    for (let i = 0; i < run.length - 1; i++) {
      const d = pointToSegmentM(pt, run[i], run[i + 1])
      if (d < best) {
        best = d
        at = { lat: run[i][1], lng: run[i][0] }
      }
    }
  }
  return at === null ? null : { distanceM: Math.round(best), at }
}

/**
 * Distance from a point to a POLYGON, and the closest point on its edge.
 *
 * Zero when the point is inside — a property on a lake's edge and one in the
 * lake are both "at the water", and a negative distance would imply a depth we
 * have no data for.
 *
 * `at` is what lets reanchor.js and walkEnrich.js treat the resulting fact like
 * every other distance fact rather than a special case.
 */
export function distanceToGeometry(lat, lng, geometry) {
  const rings = ringsOf(geometry)
  if (!rings.length) return null

  // Inner rings are holes, so containment is an ODD number of crossings across
  // all rings — which is exactly what toggling gives.
  let inside = false
  for (const ring of rings) if (pointInRing({ lat, lng }, ring)) inside = !inside

  const nearest = nearestOnRuns(lat, lng, rings)
  if (!nearest) return null

  return { distanceM: inside ? 0 : nearest.distanceM, at: nearest.at, inside }
}

/**
 * Distance from a point to a LINE, and the closest point on it.
 *
 * A road has no inside, so there is no containment case here — this is the
 * whole difference from the polygon function above.
 */
export function distanceToLine(lat, lng, geometry) {
  const runs = linesOf(geometry)
  if (!runs.length) return null
  return nearestOnRuns(lat, lng, runs)
}

/** Degrees of latitude/longitude covering a metre radius at this latitude. */
export function degreeBox(lat, radiusM) {
  return {
    dLat: radiusM / DEG_LAT_M,
    dLng: radiusM / (DEG_LAT_M * Math.cos((lat * Math.PI) / 180)),
  }
}
