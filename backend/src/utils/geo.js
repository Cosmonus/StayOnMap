// Geo helpers for bounding box queries

// Same box properties.validation.js pins listing coordinates to. Anything
// outside it can't be a real Indian address, so it's only ever a typo or an
// attempt to bust a coordinate-keyed cache.
export const INDIA_BOUNDS = { minLat: 6, maxLat: 38, minLng: 68, maxLng: 98 }

export function isWithinIndia(lat, lng) {
  return (
    Number.isFinite(lat) && Number.isFinite(lng) &&
    lat >= INDIA_BOUNDS.minLat && lat <= INDIA_BOUNDS.maxLat &&
    lng >= INDIA_BOUNDS.minLng && lng <= INDIA_BOUNDS.maxLng
  )
}

export function parseBounds(query) {
  const { swLat, swLng, neLat, neLng } = query
  return {
    swLat: parseFloat(swLat),
    swLng: parseFloat(swLng),
    neLat: parseFloat(neLat),
    neLng: parseFloat(neLng),
  }
}

export function boundsFilter(bounds) {
  return {
    lat: { gte: bounds.swLat, lte: bounds.neLat },
    lng: { gte: bounds.swLng, lte: bounds.neLng },
  }
}
