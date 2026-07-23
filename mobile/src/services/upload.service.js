import { api } from '@lib/api'
import * as ImageManipulator from 'expo-image-manipulator'

const MAX_UPLOAD_WIDTH = 1920

// Downscale on-device before upload so a 12MP camera photo (~4000px, 2-4MB)
// leaves the phone as a ~1920px JPEG (a few hundred KB). This cuts the tenant's
// upload time and data cost and what the server has to re-encode. Best-effort:
// an already-small image or a manipulation failure just uses the original —
// uploading must never hard-fail here (the server still resizes regardless).
async function prepareForUpload(asset) {
  if (asset.width && asset.width <= MAX_UPLOAD_WIDTH) return asset
  try {
    const context = ImageManipulator.manipulate(asset.uri)
    context.resize({ width: MAX_UPLOAD_WIDTH })
    const rendered = await context.renderAsync()
    const out = await rendered.saveAsync({ format: ImageManipulator.SaveFormat.JPEG, compress: 0.7 })
    const stem = (asset.fileName ?? `photo-${Date.now()}`).replace(/\.\w+$/, '')
    return { ...asset, uri: out.uri, mimeType: 'image/jpeg', fileName: `${stem}.jpg` }
  } catch {
    return asset
  }
}

function toFormData(asset) {
  const form = new FormData()
  form.append('image', {
    uri: asset.uri,
    name: asset.fileName ?? `photo-${Date.now()}.jpg`,
    type: asset.mimeType ?? 'image/jpeg',
  })
  return form
}

// asset: an expo-image-picker result asset { uri, width, height, mimeType, fileName }
export const uploadService = {
  uploadPropertyImage: async (asset) => {
    const prepared = await prepareForUpload(asset)
    return api.post('/uploads/property-image', toFormData(prepared), {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 30000,
    })
  },
  uploadChatImage: async (asset) => {
    const prepared = await prepareForUpload(asset)
    return api.post('/uploads/chat-image', toFormData(prepared), {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 30000,
    })
  },
}
