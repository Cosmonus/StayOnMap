import { api } from '@lib/api'

// The spatial intelligence layer's POI endpoint — the named places behind the
// module counts ("which banks", not just "20 banks"). Distinct from
// placeIntelligence.service.js (the older Google-proxied per-coordinate path).
//
// The panel itself needs NO service call: the property payload already carries
// `property.spatialContext`, joined server-side by getPropertyById. Only the
// browseable lists fetch — once per category, searched locally after that.
export const spatialService = {
  getPoisNear: (lat, lng, category, radius) =>
    api.get('/spatial/pois', { params: { lat, lng, category, radius } }),
}
