import * as service from './uploads.service.js'
import * as documents from './documents.service.js'
import { prisma } from '../../lib/prisma.js'
import { created } from '../../utils/response.js'

export async function uploadPropertyImage(req, res, next) {
  try {
    const url = await service.uploadPropertyImageSet(req.file, req.user.id)
    created(res, { url })
  } catch (err) { next(err) }
}

export async function uploadAvatar(req, res, next) {
  try {
    const url = await service.uploadSingle(req.file, req.user.id, 'avatars', 512, 80)
    await prisma.user.update({ where: { id: req.user.id }, data: { avatarUrl: url } })
    created(res, { url })
  } catch (err) { next(err) }
}

// Returns the display name and mime alongside the URL: a document attachment
// is unusable without a label, and the storage path is a UUID by design.
export async function uploadChatFile(req, res, next) {
  try {
    const file = await documents.uploadDocument(req.file, req.user.id, 'chat-files')
    created(res, file)
  } catch (err) { next(err) }
}

/**
 * Support evidence — an image or a PDF through one door.
 *
 * Always returns { url, fileName, mimeType } whichever branch ran, because the
 * caller is going to POST exactly that to /support/cases/:id/attachments and
 * should not have to reshape it per type. Note the image branch reports
 * `image/webp`, not what was uploaded: uploadSingle CONVERTS, and reporting the
 * original type would store a mime the URL does not serve.
 */
export async function uploadSupportFile(req, res, next) {
  try {
    if (req.file?.mimetype === 'application/pdf') {
      // uploadDocument answers { url, mime, name } — chat's own key names.
      // Renamed here rather than there: chat's shape is what released clients
      // parse, and changing it to suit a second caller is how one of them breaks.
      const doc = await documents.uploadDocument(req.file, req.user.id, 'support-files')
      return created(res, { url: doc.url, fileName: doc.name, mimeType: doc.mime })
    }
    const url = await service.uploadSingle(req.file, req.user.id, 'support', 1600, 80)
    created(res, { url, fileName: req.file?.originalname ?? null, mimeType: 'image/webp' })
  } catch (err) { next(err) }
}

export async function uploadChatImage(req, res, next) {
  try {
    const url = await service.uploadSingle(req.file, req.user.id, 'chat', 1280, 78)
    created(res, { url })
  } catch (err) { next(err) }
}
