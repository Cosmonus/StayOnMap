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
