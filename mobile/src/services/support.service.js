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

  articles:   (params) => api.get('/support/articles', { params }),
}
