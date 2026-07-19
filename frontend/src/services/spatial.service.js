import { api } from '@lib/api'

// The spatial intelligence layer's own endpoints — geohash-cell context and
// the named POI lists behind the module counts. Distinct from
// places.service.js (Google-proxied live intel, still used by mobile) and
// areas.service.js (hand-authored profiles).
//
// The property page never calls /spatial/at — context arrives joined onto the
// property payload. getPoisNear backs the browseable "nearby places" lists:
// fetched once per category, searched locally, nothing metered server-side.
export const spatialService = {
  getPoisNear: (lat, lng, category, radius) =>
    api.get('/spatial/pois', { params: { lat, lng, category, radius } }),
}
