import { api } from '@lib/api'

export const savedService = {
  getMySaved: () => api.get('/saved'),
  save: (propertyId) => api.post(`/saved/${propertyId}`),
  unsave: (propertyId) => api.delete(`/saved/${propertyId}`),
}
