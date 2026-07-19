// Pure geometry for administrative boundaries — no I/O, no Prisma.
//
// Split out from the seeder for the reason seedMaintenance.js was: ring
// assembly is the part that silently produces a plausible-looking wrong
// answer, and it is testable here and untestable inside a script.
//
// Two jobs:
//   1. Turn an OSM relation's loose collection of way segments into closed
//      rings (OSM stores a boundary as unordered members, not as a polygon).
//   2. Answer "is this point inside", with no spatial extension involved.
//
// Coordinates are GeoJSON order — [lng, lat] — throughout. That ordering is a
// standing trap in this codebase, where everything else is {lat, lng}, so the
// conversion happens once at the edges of this file and nowhere else.

/** Two endpoints closer than this are the same node. ~1cm. */
const JOIN_EPSILON = 1e-7

function samePoint(a, b) {
  return Math.abs(a[0] - b[0]) < JOIN_EPSILON && Math.abs(a[1] - b[1]) < JOIN_EPSILON
}

/**
 * Chain unordered way segments into closed rings.
 *
 * OSM gives a boundary relation as members in arbitrary order and arbitrary
 * direction — the same problem the metro engine solves for line geometry
 * (.claude/roadmap.md Addendum 4), and solved the same way: walk from one
 * segment's end, find whichever segment starts or ends there, flip it if
 * needed, repeat.
 *
 * A ring that never closes is DROPPED rather than force-closed with a straight
 * line. A boundary with a missing member is incomplete data; joining its loose
 * ends invents a border that isn't there, and every point-in-polygon test
 * afterwards would silently answer against that invention.
 *
 * @param {Array<Array<[number, number]>>} segments  each an array of [lng, lat]
 * @returns {{ rings: Array<Array<[number, number]>>, dropped: number }}
 */
export function assembleRings(segments) {
  const pool = segments.filter((s) => Array.isArray(s) && s.length >= 2).map((s) => [...s])
  const rings = []
  let dropped = 0

  while (pool.length) {
    let ring = pool.shift()

    // Keep extending until the ring closes or nothing else connects.
    for (;;) {
      if (samePoint(ring[0], ring[ring.length - 1])) break

      const tail = ring[ring.length - 1]
      const idx = pool.findIndex((seg) =>
        samePoint(seg[0], tail) || samePoint(seg[seg.length - 1], tail))
      if (idx === -1) break

      const [next] = pool.splice(idx, 1)
      // Flip if it was stored running the other way.
      const oriented = samePoint(next[0], tail) ? next : [...next].reverse()
      // Skip the shared node so it isn't duplicated mid-ring.
      ring = ring.concat(oriented.slice(1))
    }

    if (ring.length >= 4 && samePoint(ring[0], ring[ring.length - 1])) {
      rings.push(ring)
    } else {
      dropped++
    }
  }

  return { rings, dropped }
}

/**
 * Signed area of a ring, in squared degrees. Sign gives winding direction;
 * magnitude is only ever used to compare rings against each other, so no
 * projection to metres is needed.
 */
function signedArea(ring) {
  let sum = 0
  for (let i = 0; i < ring.length - 1; i++) {
    sum += ring[i][0] * ring[i + 1][1] - ring[i + 1][0] * ring[i][1]
  }
  return sum / 2
}

/**
 * Build a GeoJSON geometry from assembled rings.
 *
 * Rings are classified by containment, not by OSM's outer/inner roles: the
 * roles are frequently missing or wrong in Indian boundary relations, whereas
 * "this ring sits inside that one" is checkable from the geometry itself.
 *
 * @returns {{ type: 'Polygon'|'MultiPolygon', coordinates: any }|null}
 */
export function ringsToGeometry(rings) {
  if (!rings.length) return null

  // Largest first, so a candidate parent is always already placed.
  const sorted = [...rings].sort((a, b) => Math.abs(signedArea(b)) - Math.abs(signedArea(a)))

  const polygons = [] // each: [outerRing, ...holes]
  for (const ring of sorted) {
    const probe = ring[0]
    const parent = polygons.find((poly) => pointInRing(probe, poly[0]))
    if (parent) parent.push(ring)
    else polygons.push([ring])
  }

  // A Polygon's coordinates are [outer, ...holes]; a MultiPolygon's are an
  // array of exactly that shape, which is what `polygons` already holds.
  if (polygons.length === 1) return { type: 'Polygon', coordinates: polygons[0] }
  return { type: 'MultiPolygon', coordinates: polygons }
}

/**
 * Even-odd ray casting against a single ring.
 * @param {[number, number]} point  [lng, lat]
 */
export function pointInRing(point, ring) {
  const [x, y] = point
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i]
    const [xj, yj] = ring[j]
    // Does the edge straddle the ray's latitude, and is the crossing to the right?
    const straddles = (yi > y) !== (yj > y)
    if (straddles && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside
  }
  return inside
}

/**
 * Is a point inside a GeoJSON Polygon or MultiPolygon?
 *
 * Inside an outer ring and outside every hole in that same polygon — a point
 * in the courtyard of a ring-shaped ward is not in the ward.
 *
 * @param {{lat: number, lng: number}} point
 */
export function pointInGeometry(point, geometry) {
  if (!geometry?.coordinates) return false
  const p = [point.lng, point.lat]

  const polygons = geometry.type === 'MultiPolygon'
    ? geometry.coordinates
    : [geometry.coordinates]

  return polygons.some(([outer, ...holes]) =>
    Array.isArray(outer) &&
    pointInRing(p, outer) &&
    !holes.some((hole) => pointInRing(p, hole)))
}

/**
 * Bounding box of a geometry, as the columns the DB prefilter uses.
 * @returns {{minLat, maxLat, minLng, maxLng}|null}
 */
export function bboxOf(geometry) {
  if (!geometry?.coordinates) return null

  let minLat = Infinity, maxLat = -Infinity, minLng = Infinity, maxLng = -Infinity
  const walk = (node) => {
    if (typeof node[0] === 'number') {
      const [lng, lat] = node
      if (lat < minLat) minLat = lat
      if (lat > maxLat) maxLat = lat
      if (lng < minLng) minLng = lng
      if (lng > maxLng) maxLng = lng
      return
    }
    for (const child of node) walk(child)
  }
  walk(geometry.coordinates)

  return Number.isFinite(minLat) ? { minLat, maxLat, minLng, maxLng } : null
}
