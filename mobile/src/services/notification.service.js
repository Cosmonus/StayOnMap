import { api } from '@lib/api'

// `audience` is 'TENANT' | 'OWNER' — the hat whose notifications you want (see
// Notification.audience on the backend). Omitting it returns both, which is
// what released builds do, so their behaviour is unchanged.
const scope = (audience, extra = {}) => ({ params: { ...extra, ...(audience ? { audience } : {}) } })

export const notificationService = {
  list: (audience) => api.get('/notifications', scope(audience)),
  // { asTenant, asOwner } — what each hat has unread, so the mode you're in can
  // point at the one you're not.
  unread: () => api.get('/notifications/unread'),
  markOne: (id) => api.patch(`/notifications/${id}/read`),
  // Scoped for the same reason the list is: clearing the host inbox must not
  // silently mark the renter's unread ones read.
  markAll: (audience) => api.patch('/notifications/read-all', null, scope(audience)),
  markAllByType: (type, audience) => api.patch('/notifications/read-all', null, scope(audience, { type })),
}
