import { api } from '@lib/api'

// asset: an expo-image-picker result asset { uri, mimeType, fileName }
export const uploadService = {
  uploadPropertyImage: (asset) => {
    const form = new FormData()
    form.append('image', {
      uri: asset.uri,
      name: asset.fileName ?? `photo-${Date.now()}.jpg`,
      type: asset.mimeType ?? 'image/jpeg',
    })
    return api.post('/uploads/property-image', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 30000,
    })
  },
  uploadChatImage: (asset) => {
    const form = new FormData()
    form.append('image', {
      uri: asset.uri,
      name: asset.fileName ?? `photo-${Date.now()}.jpg`,
      type: asset.mimeType ?? 'image/jpeg',
    })
    return api.post('/uploads/chat-image', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 30000,
    })
  },
}
