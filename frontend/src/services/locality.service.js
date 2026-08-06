import { api } from '@lib/api'

// Locality landing pages (/rent/:city/:area). The same data the server used to
// build that page's <head>, so the two can never describe different inventory.
export const localityService = {
  get: (citySlug, localitySlug) => api.get(`/api/v1/localities/${citySlug}/${localitySlug}`),
}
