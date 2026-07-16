// Image upload to Supabase Storage via backend
import { api } from '@lib/api'

export const uploadService = {
  uploadPropertyImage: async (file) => {
    const form = new FormData()
    form.append('image', file)
    // Let axios set Content-Type automatically — it adds the boundary param
    // that multer needs to parse the multipart body. Manual override breaks it.
    return api.post('/uploads/property-image', form, {
      headers: { 'Content-Type': undefined },
      timeout: 30000,
    })
  },
  uploadChatImage: async (file) => {
    const form = new FormData()
    form.append('image', file)
    return api.post('/uploads/chat-image', form, {
      headers: { 'Content-Type': undefined },
      timeout: 30000,
    })
  },
}
