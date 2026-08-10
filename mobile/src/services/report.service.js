import { api } from '@lib/api'

export const reportService = {
  submit:       (propertyId, data)           => api.post(`/properties/${propertyId}/reports`, data),
  ownerList:    (propertyId)                 => api.get(`/properties/${propertyId}/reports/mine`),
  ownerRespond: (propertyId, reportId, data) => api.patch(`/properties/${propertyId}/reports/${reportId}/respond`, data),

  // The reporter's own thread with a moderator. Addressed by REPORT id, not
  // nested under a property, because that is what the notification carries —
  // and scoped to the caller's own reports server-side, so a report id from
  // anywhere else answers 404 rather than 403.
  //
  // The OWNER has no path in here and must not get one: a report can be
  // anonymous, and the owner already cannot see who filed it.
  myThread: (reportId)       => api.get(`/reports/${reportId}/messages`),
  myReply:  (reportId, body) => api.post(`/reports/${reportId}/messages`, { body }),
}
