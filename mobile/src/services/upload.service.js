import { api } from '@lib/api'
// Named imports, NOT `import * as ImageManipulator`. The module exports a
// member that is itself called `ImageManipulator` (`export { ExpoImageManipulator
// as ImageManipulator }`), so the namespace object has no `manipulate` on it —
// `ImageManipulator.manipulate` was `undefined`, and calling it threw straight
// into the catch below. See the note on prepareForUpload.
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator'

const MAX_UPLOAD_WIDTH = 1920

// Downscale on-device before upload so a 12MP camera photo (~4000px, 2-4MB)
// leaves the phone as a ~1920px JPEG (a few hundred KB). This cuts the tenant's
// upload time and data cost and what the server has to re-encode. Best-effort:
// an already-small image or a manipulation failure just uses the original —
// uploading must never hard-fail here (the server still resizes regardless).
//
// ⚠ That best-effort catch is also how this silently did NOTHING until
// 2026-08-06. The call was `ImageManipulator.manipulate(...)` against the
// module NAMESPACE, which has no such member, so every invocation threw a
// TypeError, was swallowed here, and returned the original asset. Every photo
// left the phone at full camera size — a few MB instead of a few hundred KB,
// on Indian mobile data. Nothing surfaced it: uploads still worked, just
// slowly, and the only visible trace was an eslint `import/namespace` warning.
//
// The lesson is about the catch, not the import: a fallback that silently
// substitutes a WORSE result hides its own failure. Anything degraded here
// should be observable.
async function prepareForUpload(asset) {
  if (asset.width && asset.width <= MAX_UPLOAD_WIDTH) return asset
  try {
    const context = ImageManipulator.manipulate(asset.uri)
    context.resize({ width: MAX_UPLOAD_WIDTH })
    const rendered = await context.renderAsync()
    const out = await rendered.saveAsync({ format: SaveFormat.JPEG, compress: 0.7 })
    const stem = (asset.fileName ?? `photo-${Date.now()}`).replace(/\.\w+$/, '')
    return { ...asset, uri: out.uri, mimeType: 'image/jpeg', fileName: `${stem}.jpg` }
  } catch {
    return asset
  }
}

// `field` because the support endpoint takes `file` and the rest take `image`.
// `type` must be set or Android sends application/octet-stream and multer
// rejects on the declared type before the bytes are ever sniffed.
function toFormData(asset, field = 'image') {
  const form = new FormData()
  form.append(field, {
    uri: asset.uri,
    // `name` before `fileName`: expo-document-picker answers `name`, the image
    // picker answers `fileName`, and this helper now takes both. The fallback
    // is a photo name because every other caller here IS a photo.
    name: asset.name ?? asset.fileName ?? `photo-${Date.now()}.jpg`,
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

  /**
   * Support evidence — ANY file type.
   *
   * `prepareForUpload` only downscales when the asset reports a width, so a
   * document falls through it untouched: there is nothing to resize in a PDF,
   * and re-encoding somebody's evidence would be worse than pointless. A photo
   * still gets the 1920px pass, which is the difference between a few hundred
   * KB and a few MB on Indian mobile data.
   *
   * Longer timeout than the others: 25MB over a phone connection is not 30
   * seconds.
   */
  uploadSupportFile: async (asset) => {
    const prepared = await prepareForUpload(asset)
    return api.post('/uploads/support-file', toFormData(prepared, 'file'), {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 120000,
    })
  },
}
