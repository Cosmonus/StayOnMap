import { api } from '@lib/api'

export const authService = {
  syncProfile: (data) => api.post('/auth/sync', data),
  getMe: () => api.get('/auth/me'),
  upgradeRole: () => api.patch('/auth/role', { role: 'OWNER' }),
}
