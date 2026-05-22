// Property API calls
import { api } from '@lib/api'

export const propertyService = {
  getList: (params) => api.get('/properties', { params }),

  getById: (id) => api.get(`/properties/${id}`),

  getPinsInBounds: (bounds, filters) => {
    const sw = bounds.getSouthWest()
    const ne = bounds.getNorthEast()
    return api.get('/properties/pins', {
      params: {
        swLat: sw.lat(),
        swLng: sw.lng(),
        neLat: ne.lat(),
        neLng: ne.lng(),
        ...filters,
      },
    })
  },

  create: (data) => api.post('/properties', data),

  update: (id, data) => api.put(`/properties/${id}`, data),

  remove: (id) => api.delete(`/properties/${id}`),

  getMyListings: () => api.get('/properties/mine'),

  getAmenities: () => api.get('/properties/amenities'),

  toggleStatus: (id) => api.patch(`/properties/${id}/status`),

  publish: (id) => api.patch(`/properties/${id}/publish`),

  markTenant: (id, tenantId) => api.post(`/properties/${id}/tenant`, { tenantId }),

  vacate: (id) => api.delete(`/properties/${id}/tenant`),

  getContacts: (id) => api.get(`/properties/${id}/contacts`),
}
