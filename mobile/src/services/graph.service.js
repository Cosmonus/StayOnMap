import { api } from '@lib/api'

// The graph layer's user-facing reads. Mirrors web's graph.service.js.
//
// "Similar homes" stays on `propertyService.getSimilar` — it is a property's own
// data, fetched on the property screen.
export const graphService = {
  // Personalised. The server reads the user from the TOKEN; there is no userId
  // parameter, so one person can never request another's recommendations.
  recommendations: (params) => api.get('/graph/recommendations', { params }),

}
