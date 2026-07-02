import { api } from '@lib/api'

export const reportService = {
  submit:       (propertyId, data)           => api.post(`/properties/${propertyId}/reports`, data),
  ownerList:    (propertyId)                 => api.get(`/properties/${propertyId}/reports/mine`),
  ownerRespond: (propertyId, reportId, data) => api.patch(`/properties/${propertyId}/reports/${reportId}/respond`, data),
}
