import { api } from '@lib/api'

// Commute lookup via the Google Distance Matrix proxy. The old `get` method
// (/places/area-intelligence) was removed 2026-07-19 when the spatial layer
// (services/spatial.service.js + property.spatialContext) superseded it —
// the backend endpoint itself stays live for app versions already released.
export const placeIntelligenceService = {
  getCommute: (lat, lng, destination) => api.get('/places/commute', { params: { lat, lng, destination } }),
  // India Post ground truth for a pincode, with a server-computed city verdict
  // (matchesCity: true|false|null) — the client never carries the city-state map.
  getPincode: (code, city) => api.get('/places/pincode/' + code, { params: { city } }),
}
