import { api } from '@lib/api'

export const appointmentService = {
  request: (propertyId, data)     => api.post(`/properties/${propertyId}/appointments`, data),
  mine:    ()                      => api.get('/appointments/mine'),
  owner:   ()                      => api.get('/appointments/owner'),
  forProperty: (propertyId)       => api.get(`/properties/${propertyId}/appointments`),
  updateStatus: (id, data)        => api.patch(`/appointments/${id}/status`, data),
}
