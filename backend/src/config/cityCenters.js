// City centres + metro-area radii, derived from config/cities.js's CITY_TABLE
// — one table for every city StayOnMap is open in (45 as of 2026-08-24; count
// the table, not this comment).
//
// Two consumers, which is why this moved out of intelligence.service.js:
//   - coordinate-vs-city sanity checks on a listing (is this address plausibly
//     in the city it claims?)
//   - resolving a bare lat/lng to a city, so the spatial layer can look up
//     that city's metro network and employment centres, and so the seeders
//     know which bbox to fetch
//
// These are centroids for a sanity check, not precise boundaries. A city
// missing from this table degrades gracefully to "unknown city" everywhere —
// never to a wrong answer. Where two radii overlap (Hosur inside Bengaluru's
// 45 km, Tiruppur beside Coimbatore) resolveCity() picks the NEARER centre.
import { CITY_TABLE } from './cities.js'

export const CITY_CENTERS = Object.fromEntries(
  CITY_TABLE.map(({ name, lat, lng, radiusKm }) => [name, { lat, lng, radiusKm }])
)

export function haversineKm(lat1, lng1, lat2, lng2) {
  const toRad = (d) => (d * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

// How far a map pin may sit from its claimed city's centre before we call it a
// contradiction rather than a suburb.
//
// Deliberately far beyond every radiusKm above (the largest is Delhi's 60), and
// it is not a tighter number for a reason: this threshold REJECTS an owner's
// listing, so it may only ever fire on a mismatch no honest exurban address can
// explain. At 100km the nearest pair of supported cities — Mumbai and Pune,
// ~120km apart — is still caught (closer pairs added 2026-08-24, Coimbatore–Tiruppur at ~50km, are resolved by nearest centre, not by this check), while a genuine outer-NCR or Navi-Mumbai
// address is nowhere near it.
//
// The radii above stay what they are: a softer "is this plausibly in the city"
// signal for the intelligence layer, which advises rather than blocks.
export const MAX_CITY_DISTANCE_KM = 100

/**
 * Does this map pin contradict the city the listing claims?
 *
 * Returns null for "no, or we cannot tell" — an unknown city, a missing or
 * non-numeric coordinate, and a pin within tolerance are all the same answer to
 * the caller: nothing to report. Only a contradiction produces an object, so a
 * truthy result always means "this is genuinely wrong".
 *
 * @returns {{ distanceKm: number, looksLike: string | null } | null}
 */
export function cityMismatch(city, lat, lng) {
  const centre = CITY_CENTERS[city]
  if (!centre) return null
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null

  const distanceKm = haversineKm(lat, lng, centre.lat, centre.lng)
  if (distanceKm <= MAX_CITY_DISTANCE_KM) return null

  // Naming the city the pin actually sits in turns "this is wrong" into "this
  // is wrong AND here is what you probably meant". Null when the pin is outside
  // every supported city — we know the claim is false without knowing the truth.
  return { distanceKm: Math.round(distanceKm), looksLike: resolveCity(lat, lng)?.city ?? null }
}

/**
 * Which supported city does this coordinate fall in?
 *
 * Returns null when the point is outside every city's radius rather than
 * picking the least-bad match — "somewhere we don't cover" is a real answer,
 * and a listing 200km from Pune is not a Pune listing.
 *
 * @returns {{ city: string, distanceKm: number } | null}
 */
export function resolveCity(lat, lng) {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null

  let best = null
  for (const [city, c] of Object.entries(CITY_CENTERS)) {
    const distanceKm = haversineKm(lat, lng, c.lat, c.lng)
    if (distanceKm > c.radiusKm) continue
    if (!best || distanceKm < best.distanceKm) best = { city, distanceKm }
  }
  return best
}
