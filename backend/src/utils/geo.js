// Geo helpers for bounding box queries

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
