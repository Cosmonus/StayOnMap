import { api } from '@lib/api'

export const userService = {
  getSettings: () => api.get('/users/settings'),
  updateProfile: (data) => api.put('/users/profile', data),
}
