// Geohash — the cell key for the spatial intelligence layer.
//
// Neighbourhood facts belong to a *place*, not to a listing: 400 flats in
// Koramangala share one set of metro stations and one air-quality reading.
// Computing them per-property is why areaIntelligence.service.js bills ~11
// Google requests per listing view. Keying by cell means the second listing in
// a cell is free.
//
// Precision 7 (~153m x 153m) is the deliberate grain:
//   - Fine enough that "6 min walk to the metro" and "18 min walk" land in
//     different cells. The 2-decimal rounding used elsewhere (~1.1km) puts them
//     in the same one, which is why that cache can't answer walking questions.
//   - Coarse enough that a building and its neighbour share a cell, so the
//     number of cells grows sublinearly with the number of listings.
//   - It's a string prefix, so a coarser query is `LIKE 'tdr1%'` on a plain
//     btree index — no PostGIS needed. See docs/spatial-intelligence.md §3.
//
// Zero dependencies: this is 60 lines of well-understood bit-twiddling and the
// npm alternatives are all heavier than the thing they implement.

const BASE32 = '0123456789bcdefghjkmnpqrstuvwxyz' // note: no a, i, l, o
const BASE32_INDEX = Object.fromEntries([...BASE32].map((c, i) => [c, i]))

export const DEFAULT_PRECISION = 7

/**
 * Encode a coordinate to a geohash string.
 * @param {number} lat
 * @param {number} lng
 * @param {number} precision  number of base32 characters (default 7, ~153m)
 * @returns {string}
 */
export function encode(lat, lng, precision = DEFAULT_PRECISION) {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    throw new TypeError('geohash.encode requires finite lat and lng')
  }

  let latMin = -90, latMax = 90
  let lngMin = -180, lngMax = 180
  let hash = ''
  let bit = 0
  let ch = 0
  let evenBit = true // alternates lng, lat, lng, lat...

  while (hash.length < precision) {
    if (evenBit) {
      const mid = (lngMin + lngMax) / 2
      if (lng >= mid) { ch = (ch << 1) + 1; lngMin = mid } else { ch = ch << 1; lngMax = mid }
    } else {
      const mid = (latMin + latMax) / 2
      if (lat >= mid) { ch = (ch << 1) + 1; latMin = mid } else { ch = ch << 1; latMax = mid }
    }
    evenBit = !evenBit

    if (++bit === 5) { // one base32 char per 5 bits
      hash += BASE32[ch]
      bit = 0
      ch = 0
    }
  }
  return hash
}

/**
 * Decode a geohash to its bounding box.
 * @param {string} hash
 * @returns {{ latMin: number, latMax: number, lngMin: number, lngMax: number }}
 */
export function bounds(hash) {
  if (typeof hash !== 'string' || hash.length === 0) {
    throw new TypeError('geohash.bounds requires a non-empty string')
  }

  let latMin = -90, latMax = 90
  let lngMin = -180, lngMax = 180
  let evenBit = true

  for (const char of hash.toLowerCase()) {
    const idx = BASE32_INDEX[char]
    if (idx === undefined) throw new TypeError(`invalid geohash character: ${char}`)

    for (let n = 4; n >= 0; n--) {
      const bitN = (idx >> n) & 1
      if (evenBit) {
        const mid = (lngMin + lngMax) / 2
        if (bitN === 1) lngMin = mid; else lngMax = mid
      } else {
        const mid = (latMin + latMax) / 2
        if (bitN === 1) latMin = mid; else latMax = mid
      }
      evenBit = !evenBit
    }
  }
  return { latMin, latMax, lngMin, lngMax }
}

/**
 * Decode a geohash to the centroid of its cell. This is the canonical point a
 * cell's facts are computed *from* — so two listings in the same cell produce
 * byte-identical results, which is the whole point.
 * @param {string} hash
 * @returns {{ lat: number, lng: number }}
 */
export function decode(hash) {
  const b = bounds(hash)
  // Round to the cell's own resolution: reporting 14 decimal places for a 153m
  // box is exactly the false precision this layer exists to avoid.
  return {
    lat: Number(((b.latMin + b.latMax) / 2).toFixed(7)),
    lng: Number(((b.lngMin + b.lngMax) / 2).toFixed(7)),
  }
}

/**
 * The 8 geohashes surrounding this one, plus the cell itself (9 total).
 *
 * Needed because cell boundaries are arbitrary: a metro station 30m from a
 * listing can sit in the adjacent cell, and a search that only looks at the
 * containing cell would miss it. Computed by nudging out from the cell bounds
 * rather than by base32 border tables — slower, but a fraction of the code and
 * impossible to get subtly wrong.
 *
 * @param {string} hash
 * @returns {string[]}  deduped; fewer than 9 near the poles/antimeridian
 */
export function neighbours(hash) {
  const b = bounds(hash)
  const { lat, lng } = decode(hash)
  const latStep = b.latMax - b.latMin
  const lngStep = b.lngMax - b.lngMin
  const precision = hash.length

  const out = new Set()
  for (const dLat of [-1, 0, 1]) {
    for (const dLng of [-1, 0, 1]) {
      const nLat = lat + dLat * latStep
      const nLng = lng + dLng * lngStep
      if (nLat > 90 || nLat < -90) continue
      // Wrap longitude rather than dropping it, so cells near the antimeridian
      // still get a full ring. Irrelevant for India, correct everywhere.
      const wrapped = ((nLng + 180) % 360 + 360) % 360 - 180
      out.add(encode(nLat, wrapped, precision))
    }
  }
  return [...out]
}

/**
 * Great-circle distance in metres. Shared by every spatial module so "how far
 * is that" has exactly one implementation.
 */
export function haversineMeters(lat1, lng1, lat2, lng2) {
  const R = 6371000
  const toRad = (d) => (d * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}
