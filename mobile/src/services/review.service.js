import { api } from '@lib/api'

export const reviewService = {
  submit:  (propertyId, data) => api.post(`/properties/${propertyId}/reviews`, data),
  list:    (propertyId)       => api.get(`/properties/${propertyId}/reviews`),
  vote:    (propertyId, recommend) => api.post(`/properties/${propertyId}/reviews/vote`, { recommend }),
  respond: (propertyId, reviewId, response) => api.patch(`/properties/${propertyId}/reviews/${reviewId}/response`, { response }),
}
