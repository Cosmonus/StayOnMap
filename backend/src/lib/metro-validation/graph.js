// Pure geometry + graph-derivation helpers — no I/O, no knowledge of file
// paths or cities. Everything here operates on plain { lat, lng } / [lat,
// lng] shapes matching backend/src/data/metro-lines/*.json's own schema.
//
// The "graph" this module derives (ordered station sequence per line, with
// implicit prev/next from sort order) is computed fresh from path+station
// coordinates every time validation runs — it is NOT a stored artifact and
// does not change how metro.service.js/MetroLines.js/build-metro-geojson.mjs
// read or render the data. It exists purely so validation can reason about
// "is this line's geometry topologically sane" instead of only checking
// raw coordinates in isolation. See .claude/roadmap.md's metro-validation
// addendum for why a full stored-schema migration was rejected in favor of
// this validation-time-only approach.

const EARTH_RADIUS_M = 6371000

function toRad(deg) {
  return (deg * Math.PI) / 180
}

// Great-circle distance between two [lat, lng] points, in meters.
export function haversineMeters([lat1, lng1], [lat2, lng2]) {
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(a))
}

// Local flat-earth projection to meters, valid at the city scale this
// module operates at — avoids full spherical trig for every
// point-to-segment projection (called up to stations × path-points times).
function toLocalMeters([lat, lng], originLat) {
  const metersPerDegLat = 111320
  const metersPerDegLng = 111320 * Math.cos(toRad(originLat))
  return [lat * metersPerDegLat, lng * metersPerDegLng]
}

// Projects a point onto the nearest segment of a path. Returns
// `distanceMeters` (perpendicular distance to the path) and
// `ordinalPosition` = segmentIndex + fractionAlongSegment (0..1) — this
// ordinal position is the "how far along the line" value used to derive
// station ordering.
export function projectPointOntoPath(point, path) {
  if (path.length < 2) return { distanceMeters: Infinity, ordinalPosition: 0 }
  const originLat = point[0]
  const p = toLocalMeters(point, originLat)
  let best = { distanceMeters: Infinity, ordinalPosition: 0 }
  for (let i = 0; i < path.length - 1; i++) {
    const a = toLocalMeters(path[i], originLat)
    const b = toLocalMeters(path[i + 1], originLat)
    const abx = b[0] - a[0]
    const aby = b[1] - a[1]
    const lenSq = abx * abx + aby * aby
    let t = lenSq === 0 ? 0 : ((p[0] - a[0]) * abx + (p[1] - a[1]) * aby) / lenSq
    t = Math.max(0, Math.min(1, t))
    const projX = a[0] + t * abx
    const projY = a[1] + t * aby
    const dist = Math.hypot(p[0] - projX, p[1] - projY)
    if (dist < best.distanceMeters) best = { distanceMeters: dist, ordinalPosition: i + t }
  }
  return best
}

// Ordered station sequence for one line — the "graph" for that line.
// Implicit prev/next = adjacent entries in the returned (sorted) array.
export function deriveLineGraph(line, stationsOnLine) {
  const nodes = stationsOnLine.map((station) => {
    const { distanceMeters, ordinalPosition } = projectPointOntoPath([station.lat, station.lng], line.path)
    return { station, distanceMeters, ordinalPosition }
  })
  nodes.sort((a, b) => a.ordinalPosition - b.ordinalPosition)
  return nodes
}

// Runs deriveLineGraph for every line in a city, matching each line's
// stations via the existing `station.lines` index (Addendum 6's
// precomputed proximity match) rather than re-deriving membership here.
export function deriveNetworkGraph(cityData) {
  const { lines, stations } = cityData
  return lines.map((line, lineIndex) => {
    const stationsOnLine = stations.filter((s) => (s.lines ?? []).includes(lineIndex))
    return { line, lineIndex, nodes: deriveLineGraph(line, stationsOnLine) }
  })
}

// Largest gap between consecutive path points, in meters.
export function maxPathGapMeters(path) {
  let max = 0
  for (let i = 1; i < path.length; i++) {
    const d = haversineMeters(path[i - 1], path[i])
    if (d > max) max = d
  }
  return max
}

// Splits a path into contiguous sub-arrays wherever a consecutive-point gap
// exceeds `gapMeters` — each sub-array is a "component." A single connected
// line has exactly one component.
export function splitPathIntoComponents(path, gapMeters) {
  if (path.length === 0) return []
  const components = [[path[0]]]
  for (let i = 1; i < path.length; i++) {
    const d = haversineMeters(path[i - 1], path[i])
    if (d > gapMeters) components.push([])
    components[components.length - 1].push(path[i])
  }
  return components
}

function orientation(p, q, r) {
  const val = (q[1] - p[1]) * (r[0] - q[0]) - (q[0] - p[0]) * (r[1] - q[1])
  if (Math.abs(val) < 1e-12) return 0
  return val > 0 ? 1 : 2
}

function onSegment(p, q, r) {
  return (
    q[0] <= Math.max(p[0], r[0]) &&
    q[0] >= Math.min(p[0], r[0]) &&
    q[1] <= Math.max(p[1], r[1]) &&
    q[1] >= Math.min(p[1], r[1])
  )
}

// Standard orientation-based segment intersection test (2D, works directly
// on [lat, lng] pairs — only relative order matters here, not real distance).
export function segmentsIntersect(p1, p2, p3, p4) {
  const o1 = orientation(p1, p2, p3)
  const o2 = orientation(p1, p2, p4)
  const o3 = orientation(p3, p4, p1)
  const o4 = orientation(p3, p4, p2)
  if (o1 !== o2 && o3 !== o4) return true
  if (o1 === 0 && onSegment(p1, p3, p2)) return true
  if (o2 === 0 && onSegment(p1, p4, p2)) return true
  if (o3 === 0 && onSegment(p3, p1, p4)) return true
  if (o4 === 0 && onSegment(p3, p2, p4)) return true
  return false
}
