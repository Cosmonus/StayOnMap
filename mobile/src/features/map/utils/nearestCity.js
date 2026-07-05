import { CITIES } from '@config/cities'

// Cheap squared-distance ranking to pick the nearest of our 9 supported
// cities to a map viewport center — real haversine precision isn't needed
// just to rank candidates at this scale.
export function nearestCity(lat, lng) {
  let best = null
  let bestDist = Infinity
  for (const city of CITIES) {
    const d = (city.lat - lat) ** 2 + (city.lng - lng) ** 2
    if (d < bestDist) {
      bestDist = d
      best = city
    }
  }
  return best?.name ?? null
}
