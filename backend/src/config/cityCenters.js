// Approximate city centres + generous metro-area radii for the 9
// SUPPORTED_CITIES (config/cities.js).
//
// Two consumers, which is why this moved out of intelligence.service.js:
//   - coordinate-vs-city sanity checks on a listing (is this address plausibly
//     in the city it claims?)
//   - resolving a bare lat/lng to a city, so the spatial layer can look up
//     that city's metro network and employment centres
//
// These are centroids for a sanity check, not precise boundaries. A city
// missing from this table degrades gracefully to "unknown city" everywhere —
// never to a wrong answer.
export const CITY_CENTERS = {
  Delhi:     { lat: 28.6139, lng: 77.2090, radiusKm: 60 },
  Mumbai:    { lat: 19.0760, lng: 72.8777, radiusKm: 55 },
  Kolkata:   { lat: 22.5726, lng: 88.3639, radiusKm: 45 },
  Chennai:   { lat: 13.0827, lng: 80.2707, radiusKm: 45 },
  Bengaluru: { lat: 12.9716, lng: 77.5946, radiusKm: 45 },
  Hyderabad: { lat: 17.3850, lng: 78.4867, radiusKm: 45 },
  Ahmedabad: { lat: 23.0225, lng: 72.5714, radiusKm: 40 },
  Pune:      { lat: 18.5204, lng: 73.8567, radiusKm: 45 },
  Surat:     { lat: 21.1702, lng: 72.8311, radiusKm: 35 },
}

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
// ~120km apart — is still caught, while a genuine outer-NCR or Navi-Mumbai
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
