import { api } from '@lib/api'

export const userService = {
  getSettings: () => api.get('/users/settings'),
  // The account screen in one call — name, city, points, and a count for every
  // row that has something behind it.
  accountSummary: () => api.get('/users/account-summary'),
  updateProfile: (data) => api.put('/users/profile', data),
  // Sends a password-reset link to the logged-in user's email (no in-app old/new flow).
  changePassword: () => api.post('/users/change-password'),
  deleteAccount: () => api.delete('/users/account'),

  // User safety. Blocking is per PERSON and severs messaging in BOTH
  // directions — the server enforces it on every send, so these change what is
  // possible, not just what is shown.
  blockUser: (userId) => api.post(`/users/${userId}/block`),
  unblockUser: (userId) => api.delete(`/users/${userId}/block`),
  listBlocked: () => api.get('/users/blocked'),
  reportUser: (userId, data) => api.post(`/users/${userId}/report`, data),
  // asset: an expo-image-picker result asset { uri, mimeType, fileName }.
  // The backend stores the file and sets User.avatarUrl itself.
  uploadAvatar: (asset) => {
    const form = new FormData()
    form.append('image', {
      uri: asset.uri,
      name: asset.fileName ?? `avatar-${Date.now()}.jpg`,
      type: asset.mimeType ?? 'image/jpeg',
    })
    return api.post('/uploads/avatar', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 30000,
    })
  },
}
