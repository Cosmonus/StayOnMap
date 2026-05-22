import { api } from '@lib/api'

export const notificationService = {
  list:           () => api.get('/notifications'),
  markOne:        (id) => api.patch(`/notifications/${id}/read`),
  markAll:        () => api.patch('/notifications/read-all'),
  markAllByType:  (type) => api.patch(`/notifications/read-all?type=${type}`),
}
