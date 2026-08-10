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
  marketplace:   (params)       => adminApi.get('/admin/analytics/marketplace', { params }),

  // Re-run the checks on one listing. Deterministic scores always work;
  // the AI scans short-circuit to an empty result unless AI_PROVIDER is set,
  // which is why their buttons are gated on `property.aiEnabled`.
  recalculateScores: (propertyId) => adminApi.post(`/admin/trust-scores/${propertyId}/recalculate`),
  fraudScan:         (propertyId) => adminApi.post(`/admin/ai/fraud-scan/${propertyId}`),
  reviewScan:        (reviewId)   => adminApi.post(`/admin/ai/review-scan/${reviewId}`),
  amenities:     ()             => adminApi.get('/admin/amenities'),
  addAmenity:    (name)         => adminApi.post('/admin/amenities', { name }),
  deleteAmenity: (id)           => adminApi.delete(`/admin/amenities/${id}`),
  reports:       (params)       => adminApi.get('/admin/reports', { params }),
  moderateReport: (id, data)    => adminApi.patch(`/admin/reports/${id}/moderate`, data),
  // The reporter↔moderator thread on a report. `awaiting` is how the queue
  // badges a reply, since the admin side has no notification stream.
  reportThread:  (id)           => adminApi.get(`/admin/reports/${id}/messages`),
  replyToReport: (id, body)     => adminApi.post(`/admin/reports/${id}/messages`, { body }),
  reportsAwaiting: ()           => adminApi.get('/admin/reports/awaiting'),
  verifications: (params)       => adminApi.get('/admin/verifications', { params }),
  reviewVerification: (id, data)=> adminApi.patch(`/admin/verifications/${id}`, data),
  reviews:       (params)       => adminApi.get('/admin/reviews', { params }),
  setReviewStatus: (id, status) => adminApi.patch(`/admin/reviews/${id}/status`, { status }),
  getMonitorStatus: ()          => adminApi.get('/admin/monitor'),
  getDataQuality: ()            => adminApi.get('/admin/data-quality'),
  // Not under /admin, but admin-authed all the same (graph.routes.js gates it
  // with adminAuthMiddleware), so it belongs on the adminApi instance and here
  // rather than in graph.service.js — which uses the USER instance for the two
  // renter-facing graph surfaces. GraphHealthCard called adminApi directly
  // until 2026-08-10.
  getGraphHealth:   ()          => adminApi.get('/graph/health'),
  getProfile:       ()          => adminApi.get('/admin/profile'),
  updateProfile:    (data)      => adminApi.patch('/admin/profile', data),
  changePassword:   (data)      => adminApi.patch('/admin/profile/password', data),
}
