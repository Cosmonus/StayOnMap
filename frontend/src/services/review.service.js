import { api } from '@lib/api'

export const reviewService = {
  submit:       (propertyId, data) => api.post(`/properties/${propertyId}/reviews`, data),
  list:         (propertyId)       => api.get(`/properties/${propertyId}/reviews`),
  vote:         (propertyId, data) => api.post(`/properties/${propertyId}/reviews/vote`, data),
  respond:      (propertyId, reviewId, response) => api.patch(`/properties/${propertyId}/reviews/${reviewId}/response`, { response }),
}
