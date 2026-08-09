import { adminApi } from '@lib/api'

export const adminService = {
  // Login: no token needed yet, but must stay on adminApi — the user-facing
  // `api` instance carries the tenant/owner JWT and admins are a separate
  // auth system entirely (see .claude/architecture.md)
  login:         (data)         => adminApi.post('/admin/login', data),

  // All other calls use the admin JWT
  analytics:     ()             => adminApi.get('/admin/analytics'),
  // Behaviour, not row counts — how many of the people who saw the map ever
  // booked, and how long a listing takes to publish.
  funnel:        (days)         => adminApi.get('/admin/analytics/funnel', { params: { days } }),
  demand:        (days)         => adminApi.get('/admin/analytics/demand', { params: { days } }),
  users:         (params)       => adminApi.get('/admin/users', { params }),
  waitlist:      (params)       => adminApi.get('/admin/waitlist', { params }),
  userDetail:    (id)           => adminApi.get(`/admin/users/${id}`),
  blockUser:     (id, data)     => adminApi.patch(`/admin/users/${id}/block`, data),
  properties:    (params)       => adminApi.get('/admin/properties', { params }),
  propertyById:  (id)           => adminApi.get(`/admin/properties/${id}`),
  pins:          (params)       => adminApi.get('/admin/properties/pins', { params }),
  setPropertyStatus: (id, data) => adminApi.patch(`/admin/properties/${id}/status`, data),
  logs:          (params)       => adminApi.get('/admin/logs', { params }),
  // Supply, owner responsiveness and the conversation-to-tenancy chain. One
  // call because they are one screen — see features/analytics/marketplace.service.js.
  marketplace:   ()             => adminApi.get('/admin/analytics/marketplace'),
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
  getDataQuality: ()            => adminApi.get('/admin/data-quality'),
  getProfile:       ()          => adminApi.get('/admin/profile'),
  updateProfile:    (data)      => adminApi.patch('/admin/profile', data),
  changePassword:   (data)      => adminApi.patch('/admin/profile/password', data),
}
