import { api } from '@lib/api'

// `adminList` and `moderate` lived here until 2026-08-10 with zero callers, and
// they could never have worked: they hit /admin/* on the USER axios instance,
// which attaches user_token — a wrong instance is a real bug, not a style
// point, because the two are separate token pipelines by design
// (.claude/auth.md). `adminService` has the correct versions on `adminApi`.
//
// This is the SECOND time this exact pair has been deleted from this file
// (the first was 2026-07-16, alongside the same dead duplicates in
// review.service.js). Reach for adminService for anything under /admin.
export const reportService = {
  submit:       (propertyId, data)            => api.post(`/properties/${propertyId}/reports`, data),
  ownerList:    (propertyId)                  => api.get(`/properties/${propertyId}/reports/mine`),
  ownerRespond: (propertyId, reportId, data)  => api.patch(`/properties/${propertyId}/reports/${reportId}/respond`, data),
}
