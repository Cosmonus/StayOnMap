import { api } from '@lib/api'

/**
 * Support cases, from the user's side.
 *
 * `hat` decides which support centre you are looking at — TENANT shows what you
 * opened as a renter, OWNER adds the cases about listings you own. It is safe
 * for the client to say, because the hat only ever NARROWS what comes back:
 * claiming OWNER when you own nothing returns nothing, not somebody else's
 * cases. The check is `relatedProperty.ownerId` server-side.
 */
export const supportService = {
  listCases: (hat) => api.get('/support/cases', { params: { hat } }),
  getCase:   (id)  => api.get(`/support/cases/${id}`),
  createCase: (payload) => api.post('/support/cases', payload),
  reply:      (id, body) => api.post(`/support/cases/${id}/messages`, { body }),
  // The one transition a user may make, and only on a case support has already
  // resolved. Confirming a resolution is their business; deciding a case is
  // resolved is not.
  close:      (id) => api.post(`/support/cases/${id}/close`),

  // Both hats always, so the mode you are NOT in can still say something is
  // waiting over there — the same shape as chat's and notifications' counts.
  unread: () => api.get('/support/cases/unread'),

  // Two steps on purpose: /uploads owns the mime allowlist, the size cap and
  // the random path, and the case only ever records a URL our own uploader
  // returned. The server enforces that — this order is not the protection.
  uploadFile: (file) => {
    const form = new FormData()
    form.append('file', file)
    return api.post('/uploads/support-file', form)
  },
  attach: (id, payload) => api.post(`/support/cases/${id}/attachments`, payload),

  articles: (params) => api.get('/support/articles', { params }),
}
