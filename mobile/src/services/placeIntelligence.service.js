import { api } from '@lib/api'

// Live, per-coordinate neighborhood intelligence (transit/essentials/IT/
// traffic) — see backend/src/features/places/areaIntelligence.service.js.
// Distinct from areas.service.js, which serves the hand-authored, named-
// neighborhood profiles (avg rent, flood risk, summary, "best for" tags).
export const placeIntelligenceService = {
  get: (lat, lng) => api.get('/places/area-intelligence', { params: { lat, lng } }),
}
