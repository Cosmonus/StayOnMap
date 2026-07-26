import { api } from '@lib/api'

export const savedService = {
  getMySaved: () => api.get('/saved'),

  // The counts above the list plus "new since you last looked". Separate from
  // getMySaved because that endpoint must keep returning a bare array —
  // released app builds read it. Fetching this is also what records the visit.
  summary: () => api.get('/saved/summary'),
  save: (propertyId) => api.post(`/saved/${propertyId}`),
  unsave: (propertyId) => api.delete(`/saved/${propertyId}`),
}
