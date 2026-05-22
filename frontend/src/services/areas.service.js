import { api } from '@lib/api'

export const areasService = {
  list:  (city) => api.get('/areas', { params: city ? { city } : {} }),
  get:   (slug) => api.get(`/areas/${slug}`),
  match: (city, area) => api.get('/areas/match', { params: { city, area } }),
}
