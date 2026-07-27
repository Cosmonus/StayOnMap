import { api } from '@lib/api'

// `audience` is 'TENANT' | 'OWNER' — the hat whose notifications you want (see
// Notification.audience on the backend). Omitting it returns both, which is
// what the old signature did, so nothing that hasn't been taught about hats
// changes behaviour.
const scope = (audience, extra = {}) => ({ params: { ...extra, ...(audience ? { audience } : {}) } })

export const notificationService = {
  list:           (audience) => api.get('/notifications', scope(audience)),
  // { asTenant, asOwner } — what each hat has unread, so the mode you're in can
  // point at the one you're not.
  unread:         () => api.get('/notifications/unread'),
  markOne:        (id) => api.patch(`/notifications/${id}/read`),
  // Scoped for the same reason the list is: clearing the host inbox must not
  // silently mark the renter's unread ones read.
  // Body is {} not null: axios serializes null to the literal string "null",
  // which Express's strict JSON parser rejects with a 400 — that bug shipped
  // with the audience param (the 3rd axios arg forced a body arg) and made
  // "Mark all as read" a silent no-op.
  markAll:        (audience) => api.patch('/notifications/read-all', {}, scope(audience)),
  markAllByType:  (type, audience) => api.patch('/notifications/read-all', {}, scope(audience, { type })),
}
