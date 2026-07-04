import { api } from '@lib/api'

// Live, per-coordinate neighborhood intelligence (transit/essentials/IT/
// traffic) — see backend/src/features/places/areaIntelligence.service.js.
// Distinct from areas.service.js, which serves the hand-authored, named-
// neighborhood profiles (avg rent, flood risk, summary, "best for" tags).
export const placesService = {
  getAreaIntelligence: (lat, lng) => api.get('/places/area-intelligence', { params: { lat, lng } }),
  getCommute: (lat, lng, destination) => api.get('/places/commute', { params: { lat, lng, destination } }),
}
