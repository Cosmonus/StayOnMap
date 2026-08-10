import { api } from '@lib/api'

/**
 * Support cases, from the user's side. Mirrors web's services/support.service.js.
 *
 * `hat` decides which support centre you are looking at — TENANT shows what you
 * opened as a renter, OWNER adds the cases about listings you own. Safe for the
 * client to say, because the hat only ever NARROWS what comes back: claiming
 * OWNER when you own nothing returns nothing, not somebody else's cases.
 */
export const supportService = {
  listCases:  (hat) => api.get('/support/cases', { params: { hat } }),
  getCase:    (id)  => api.get(`/support/cases/${id}`),
  createCase: (payload) => api.post('/support/cases', payload),
  reply:      (id, body) => api.post(`/support/cases/${id}/messages`, { body }),
  close:      (id) => api.post(`/support/cases/${id}/close`),

  // Both hats always, so the mode you are NOT in can still say something is
  // waiting over there — the same shape as chat's and notifications' counts.
  unread:     () => api.get('/support/cases/unread'),

  // The UPLOAD lives in upload.service.js (`uploadSupportFile`), where the
  // on-device downscale already is — a second FormData builder here would be a
  // photo that leaves the phone at full camera size on Indian mobile data.
  // This only records the result: the case stores a URL our own uploader
  // returned, and the server enforces that rather than trusting the order.
  attach:     (id, payload) => api.post(`/support/cases/${id}/attachments`, payload),

  articles:   (params) => api.get('/support/articles', { params }),
}
