import { api } from '@lib/api'

export const userService = {
  getSettings: () => api.get('/users/settings'),

  updateProfile: (data) => api.put('/users/profile', data),

  changePassword: () => api.post('/users/change-password'),

  deleteAccount: () => api.delete('/users/account'),

  uploadAvatar: async (file) => {
    const form = new FormData()
    form.append('image', file)
    return api.post('/uploads/avatar', form, {
      headers: { 'Content-Type': undefined },
      timeout: 30000,
    })
  },
}
