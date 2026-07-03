import { api } from '@lib/api'

// Real metro/light-rail network (lines + stations), sourced from
// OpenStreetMap — see backend/src/features/metro and docs/features/map.md.
export const metroService = {
  get: (city) => api.get('/metro', { params: { city } }),
}
