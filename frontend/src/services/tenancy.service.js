// The tenancy record — who lived where, and the double-blind reviews over it.
import { api } from '@lib/api'

export const tenancyService = {
  mine: (hat) => api.get('/tenancies/mine', { params: { hat } }),
  confirm: (id) => api.post(`/tenancies/${id}/confirm`),
  decline: (id) => api.post(`/tenancies/${id}/decline`),
  addReview: (id, { rating, content }) => api.post(`/tenancies/${id}/reviews`, { rating, content }),
  // The rental résumé — 404s unless the caller has a conversation or visit
  // request with this person; the service surfaces that as "no history yet".
  resume: (userId) => api.get(`/tenancies/resume/${userId}`),
  // Public: revealed tenant-on-owner reviews for a listing's owner.
  ownerReviews: (propertyId) => api.get(`/properties/${propertyId}/owner-reviews`),
}
