import { api } from '@lib/api'

// Live, per-coordinate neighborhood intelligence (transit/essentials/IT/
// traffic) — see backend/src/features/places/areaIntelligence.service.js.
// Distinct from areas.service.js, which serves the hand-authored, named-
// neighborhood profiles (avg rent, flood risk, summary, "best for" tags).
export const placesService = {
  getAreaIntelligence: (lat, lng) => api.get('/places/area-intelligence', { params: { lat, lng } }),
  getCommute: (lat, lng, destination) => api.get('/places/commute', { params: { lat, lng, destination } }),
  // India Post ground truth for a pincode, with a server-computed city verdict
  // (matchesCity: true|false|null) so the client never carries its own copy of
  // the city-to-state map.
  getPincode: (code, city) => api.get('/places/pincode/' + code, { params: { city } }),
}
