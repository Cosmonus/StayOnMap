import { api } from '@lib/api'

export const propertyService = {
  getList: (params) => api.get('/properties', { params }),

  getById: (id) => api.get(`/properties/${id}`),

  // bounds: { swLat, swLng, neLat, neLng } — plain object (RN has no
  // LatLngBounds instance like web's Google Maps bounds).
  getPinsInBounds: (bounds, filters) =>
    api.get('/properties/pins', { params: { ...bounds, ...filters } }),

  // Live result count for the filter sheet — same query shape as /pins
  getCount: (bounds, filters) =>
    api.get('/properties/count', { params: { ...bounds, ...filters } }),

  create: (data) => api.post('/properties', data),
  update: (id, data) => api.put(`/properties/${id}`, data),
  remove: (id) => api.delete(`/properties/${id}`),
  getMyListings: () => api.get('/properties/mine'),
  getAmenities: () => api.get('/properties/amenities'),
  getStats: () => api.get('/properties/stats'),
  toggleStatus: (id) => api.patch(`/properties/${id}/status`),
  publish: (id) => api.patch(`/properties/${id}/publish`),
  markTenant: (id, tenantId) => api.post(`/properties/${id}/tenant`, { tenantId }),
  vacate: (id) => api.delete(`/properties/${id}/tenant`),
  getContacts: (id) => api.get(`/properties/${id}/contacts`),
}
