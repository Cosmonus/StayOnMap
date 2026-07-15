import { api } from '@lib/api'

export const userService = {
  getSettings: () => api.get('/users/settings'),
  updateProfile: (data) => api.put('/users/profile', data),
  // Sends a password-reset link to the logged-in user's email (no in-app old/new flow).
  changePassword: () => api.post('/users/change-password'),
  deleteAccount: () => api.delete('/users/account'),
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
