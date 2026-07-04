import { api } from '@lib/api'

// Hand-authored IT corridor polygons (Chennai/Bengaluru/Hyderabad/Delhi only)
// — see backend/src/features/itCorridors and .claude/maps.md.
export const itCorridorsService = {
  get: (city) => api.get('/it-corridors', { params: { city } }),
}
