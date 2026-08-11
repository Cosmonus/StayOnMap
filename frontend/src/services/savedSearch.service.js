// Saved searches — a filter set the platform remembers so it can say "a new
// home matches" later. The stored `query` is the same shape toQueryParams()
// produces for /pins; the backend validates it against the filter registry.
import { api } from '@lib/api'

export const savedSearchService = {
  list: () => api.get('/saved-searches'),
  create: ({ name, query }) => api.post('/saved-searches', { name, query }),
  remove: (id) => api.delete(`/saved-searches/${id}`),
}
