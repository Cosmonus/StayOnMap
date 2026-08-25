// WhatsAppMediaService — a photo message becomes a PropertyImage-ready URL.
//
// Download from Meta → sniff the bytes → the SAME uploader the web wizard
// uses (uploadPropertyImageSet: WebP thumb + full, Supabase, perceptual hash
// for the reused-photo fraud signal). Nothing is stored anywhere new. The URL
// goes on the draft; at publish it becomes a PropertyImage row through
// createProperty(), in the order the photos arrived.
//
// Dedupe is by Meta media id AND by content hash: a retried webhook carries
// the same media id, a re-sent photo carries a new id and the same bytes.
import { downloadMedia } from './client.js'
import { sniffImageType, uploadPropertyImageSet } from '../uploads/uploads.service.js'

export const MAX_PHOTOS = 10

/**
 * @param {object} draft   the conversation draft (read for dedupe)
 * @param {{ id: string, sha256?: string, mime_type?: string }} media  Meta's image object
 * @param {string} userId  the owner (storage path + fingerprint attribution)
 * @returns {Promise<{ status: 'added', photo } | { status: 'duplicate' } | { status: 'full' } | { status: 'invalid', reason } | { status: 'failed', reason }>}
 */
export async function ingestPhoto(draft, media, userId) {
  const photos = Array.isArray(draft.photos) ? draft.photos : []
  if (photos.some((p) => p.waMediaId === media.id)) return { status: 'duplicate' }
  if (photos.length >= MAX_PHOTOS) return { status: 'full' }

  let file
  try {
    file = await downloadMedia(media.id)
  } catch (err) {
    return { status: 'failed', reason: err.message }
  }

  if (photos.some((p) => p.sha256 && p.sha256 === file.sha256)) return { status: 'duplicate' }
  if (!sniffImageType(file.buffer)) return { status: 'invalid', reason: 'not a JPEG, PNG or WebP image' }

  try {
    const url = await uploadPropertyImageSet({ buffer: file.buffer }, userId)
    return {
      status: 'added',
      photo: { url, waMediaId: media.id, sha256: file.sha256, order: photos.length, addedAt: new Date().toISOString() },
    }
  } catch (err) {
    return { status: 'failed', reason: err.message }
  }
}
