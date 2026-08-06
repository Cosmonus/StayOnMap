import { api } from '@lib/api'

export const userService = {
  getSettings: () => api.get('/users/settings'),

  // User safety. Blocking is per PERSON and severs messaging both ways — the
  // server enforces it on every send, so these calls change what is possible,
  // not just what is shown.
  blockUser: (userId) => api.post(`/users/${userId}/block`),
  unblockUser: (userId) => api.delete(`/users/${userId}/block`),
  listBlocked: () => api.get('/users/blocked'),
  reportUser: (userId, data) => api.post(`/users/${userId}/report`, data),

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
