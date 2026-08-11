// Saved searches — a filter set the platform remembers so it can say "a new
// home matches" later. Mirrors web's savedSearch.service.js; the stored
// `query` is the same wire shape toQueryParams() produces for /pins.
import { api } from '@lib/api'

export const savedSearchService = {
  list: () => api.get('/saved-searches'),
  create: ({ name, query }) => api.post('/saved-searches', { name, query }),
  remove: (id) => api.delete(`/saved-searches/${id}`),
}
