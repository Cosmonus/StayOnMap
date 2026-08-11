// The tenancy record — who lived where, and the double-blind reviews over it.
// Mirrors web's tenancy.service.js.
import { api } from '@lib/api'

export const tenancyService = {
  mine: (hat) => api.get('/tenancies/mine', { params: { hat } }),
  confirm: (id) => api.post(`/tenancies/${id}/confirm`),
  decline: (id) => api.post(`/tenancies/${id}/decline`),
  addReview: (id, { rating, content }) => api.post(`/tenancies/${id}/reviews`, { rating, content }),
  resume: (userId) => api.get(`/tenancies/resume/${userId}`),
  ownerReviews: (propertyId) => api.get(`/properties/${propertyId}/owner-reviews`),
}
