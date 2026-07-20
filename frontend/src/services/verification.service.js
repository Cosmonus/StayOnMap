import { api } from '@lib/api'

export const verificationService = {
  getStatus:      (propertyId)       => api.get(`/properties/${propertyId}/verification`),
  submit:         (propertyId, body)  => api.post(`/properties/${propertyId}/verification`, body),
  addDocument:    (propertyId, data) => api.post(`/properties/${propertyId}/verification/documents`, data),
}
