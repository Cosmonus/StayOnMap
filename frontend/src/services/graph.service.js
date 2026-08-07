import { api } from '@lib/api'

// The graph layer's user-facing reads.
//
// "Similar homes" deliberately lives on `propertyService.getSimilar` instead of
// here: it is a property's own data, fetched on the property page, and moving it
// would mean a component importing two services to render one card.
export const graphService = {
  // Personalised. The server reads the user from the TOKEN — there is no userId
  // parameter, so one person can never request another's recommendations.
  recommendations: (params) => api.get('/graph/recommendations', { params }),

}
