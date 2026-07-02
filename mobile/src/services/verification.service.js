import { api } from '@lib/api'

export const verificationService = {
  getStatus:   (propertyId)       => api.get(`/properties/${propertyId}/verification`),
  submit:      (propertyId)       => api.post(`/properties/${propertyId}/verification`),
  addDocument: (propertyId, data) => api.post(`/properties/${propertyId}/verification/documents`, data),
}
