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

  // The reporter's own thread with a moderator. Addressed by REPORT id, not
  // nested under a property, because that is what the notification carries —
  // and scoped to the caller's own reports server-side, so a report id from
  // somewhere else answers 404 rather than 403.
  //
  // The OWNER has no path in here and must not get one: a report can be
  // anonymous, and the owner already cannot see who filed it.
  myThread:     (reportId)                    => api.get(`/reports/${reportId}/messages`),
  myReply:      (reportId, body)              => api.post(`/reports/${reportId}/messages`, { body }),
}
