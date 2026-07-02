import { api } from '@lib/api'

export const leaseService = {
  getMyLeases: ()                    => api.get('/leases'),
  getById:     (id)                  => api.get(`/leases/${id}`),
  createLease: (propertyId, data)    => api.post(`/leases/property/${propertyId}`, data),
  sign:        (id, data)            => api.patch(`/leases/${id}/sign`, data),
  reject:      (id, data)            => api.patch(`/leases/${id}/reject`, data),
  terminate:   (id, data)            => api.patch(`/leases/${id}/terminate`, data),
}
