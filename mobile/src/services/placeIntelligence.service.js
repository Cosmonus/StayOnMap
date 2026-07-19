import { api } from '@lib/api'

// Commute lookup via the Google Distance Matrix proxy. The old `get` method
// (/places/area-intelligence) was removed 2026-07-19 when the spatial layer
// (services/spatial.service.js + property.spatialContext) superseded it —
// the backend endpoint itself stays live for app versions already released.
export const placeIntelligenceService = {
  getCommute: (lat, lng, destination) => api.get('/places/commute', { params: { lat, lng, destination } }),
}
