// Mirrors frontend/src/services/areas.service.js
import { api } from '@lib/api'

export const areasService = {
  list: (city) => api.get('/areas', { params: city ? { city } : {} }),
  get: (slug) => api.get(`/areas/${slug}`),
  // `match` removed 2026-07-19 — its only caller (PropertyAreaInsightCard) was
  // superseded by the spatial layer. The backend endpoint stays live for
  // released app versions; the map's AreaInsightCard uses list/get above.
}
