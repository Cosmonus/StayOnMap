import { api, adminApi } from '@lib/api'

export const adminService = {
  // Login: no token needed
  login:         (data)         => api.post('/admin/login', data),

  // All other calls use the admin JWT
  analytics:     ()             => adminApi.get('/admin/analytics'),
  users:         (params)       => adminApi.get('/admin/users', { params }),
  userDetail:    (id)           => adminApi.get(`/admin/users/${id}`),
  blockUser:     (id, data)     => adminApi.patch(`/admin/users/${id}/block`, data),
  properties:    (params)       => adminApi.get('/admin/properties', { params }),
  propertyById:  (id)           => adminApi.get(`/admin/properties/${id}`),
  pins:          (params)       => adminApi.get('/admin/properties/pins', { params }),
  setPropertyStatus: (id, data) => adminApi.patch(`/admin/properties/${id}/status`, data),
  moderationQueue:  ()          => adminApi.get('/admin/moderation/queue'),
  logs:          (params)       => adminApi.get('/admin/logs', { params }),
  amenities:     ()             => adminApi.get('/admin/amenities'),
  addAmenity:    (name)         => adminApi.post('/admin/amenities', { name }),
  deleteAmenity: (id)           => adminApi.delete(`/admin/amenities/${id}`),
  reports:       (params)       => adminApi.get('/admin/reports', { params }),
  moderateReport: (id, data)    => adminApi.patch(`/admin/reports/${id}/moderate`, data),
  verifications: (params)       => adminApi.get('/admin/verifications', { params }),
  reviewVerification: (id, data)=> adminApi.patch(`/admin/verifications/${id}`, data),
  reviews:       (params)       => adminApi.get('/admin/reviews', { params }),
  setReviewStatus: (id, status) => adminApi.patch(`/admin/reviews/${id}/status`, { status }),
  getMonitorStatus: ()          => adminApi.get('/admin/monitor'),
  getProfile:       ()          => adminApi.get('/admin/profile'),
  updateProfile:    (data)      => adminApi.patch('/admin/profile', data),
  changePassword:   (data)      => adminApi.patch('/admin/profile/password', data),
}
