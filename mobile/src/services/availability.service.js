import { api } from '@lib/api'

export const availabilityService = {
  get: (propertyId) => api.get(`/properties/${propertyId}/availability`),
  set: (propertyId, dates) => api.put(`/properties/${propertyId}/availability`, { dates }),
}
