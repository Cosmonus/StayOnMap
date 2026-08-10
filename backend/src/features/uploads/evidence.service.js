import { randomUUID } from 'crypto'
import { supabase } from '../../lib/supabase.js'
import { safeFileName } from './documents.service.js'

/**
 * Support evidence — ANY file type, stored so that none of them can be
 * dangerous.
 *
 * Every other uploader here is an allowlist, and rightly: a property photo is a
 * photo and a chat attachment is a PDF. Evidence is the one place where
 * narrowing the types narrows what somebody can prove. A tenant showing a
 * fabricated agreement has a .docx, a threatening voice note is an .m4a, and a
 * WhatsApp export is a .txt inside a .zip. Refusing those is refusing the
 * complaint.
 *
 * ── The one real hazard, and how it is closed ──────────────────────────────
 *
 * It is not the bytes at rest. It is the browser RENDERING them. An .svg or an
 * .html served inline from our storage domain is a working script or a
 * convincing phishing page, sitting on a URL that looks like ours, that staff
 * have been told is evidence and will click.
 *
 * So the rule is not "which types may be uploaded" — every type may. The rule
 * is WHICH TYPES MAY RENDER, and it is decided by the BYTES, never by the
 * client's declared mimetype:
 *
 *   bytes prove a safe, renderable format  →  served as that type, renders
 *   anything else, including unknown       →  application/octet-stream, downloads
 *
 * A file claiming image/png whose bytes are HTML therefore downloads. That is
 * the whole defence, and it costs a determined reporter nothing: their evidence
 * still arrives, it just arrives as a download.
 *
 * `Content-Disposition` would be the belt to this braces, but Supabase's
 * storage API does not let us set it on upload, so the content type carries the
 * whole rule. If that ever becomes settable, set it too — do not replace this.
 */

// Formats whose magic bytes we can verify AND which are safe to render inline.
// SVG is deliberately ABSENT despite being an image: it is XML, it can carry
// script, and it is the single most common stored-XSS vector in an uploader.
// It still uploads — it just downloads instead of rendering.
const RENDERABLE = [
  { mime: 'image/jpeg', ext: 'jpg',  test: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  { mime: 'image/png',  ext: 'png',  test: (b) => b.toString('hex', 0, 8) === '89504e470d0a1a0a' },
  { mime: 'image/gif',  ext: 'gif',  test: (b) => b.toString('ascii', 0, 6) === 'GIF87a' || b.toString('ascii', 0, 6) === 'GIF89a' },
  { mime: 'image/webp', ext: 'webp', test: (b) => b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP' },
  { mime: 'application/pdf', ext: 'pdf', test: (b) => b.toString('ascii', 0, 5) === '%PDF-' },
  { mime: 'video/mp4',  ext: 'mp4',  test: (b) => b.toString('ascii', 4, 8) === 'ftyp' },
]

/** What the BYTES say, or null when we cannot prove it is safe to render. */
export function sniffRenderable(buffer) {
  if (!buffer || buffer.length < 12) return null
  return RENDERABLE.find((f) => {
    try { return f.test(buffer) } catch { return false }
  }) ?? null
}

// The sender's extension, sanitised, used ONLY for the stored path and the
// display label. It never decides the content type — that comes from the bytes
// above — so a .exe named .pdf still downloads as an opaque blob either way.
const EXT = /\.([A-Za-z0-9]{1,8})$/

function extensionOf(originalName, sniffed) {
  if (sniffed) return sniffed.ext
  const match = EXT.exec(String(originalName ?? ''))
  return match ? match[1].toLowerCase() : 'bin'
}

/**
 * Store a file of any type and answer the shape an attachment record needs.
 *
 * `ownerKey` is whatever identifies the uploader for pathing — a user id or an
 * admin id. It only ever produces a directory segment; the filename itself
 * stays a UUID, so nothing about who uploaded it is readable from the URL.
 */
export async function uploadEvidence(file, ownerKey, folder = 'support') {
  if (!file?.buffer?.length) {
    throw Object.assign(new Error('No file was uploaded'), { statusCode: 400 })
  }

  const sniffed = sniffRenderable(file.buffer)
  const ext = extensionOf(file.originalname, sniffed)
  const path = `${folder}/${ownerKey}/${randomUUID()}.${ext}`

  // The stored content type is the ONLY thing standing between an uploaded
  // .html and a phishing page on our storage domain. Unknown means download.
  const contentType = sniffed ? sniffed.mime : 'application/octet-stream'

  const { error } = await supabase.storage
    .from('StayOnMap')
    .upload(path, file.buffer, { contentType })

  if (error) {
    console.error('Supabase storage error:', error)
    throw Object.assign(new Error('Upload failed'), { statusCode: 500 })
  }

  const { data } = supabase.storage.from('StayOnMap').getPublicUrl(path)

  return {
    url: data.publicUrl,
    // The DISPLAY name keeps the sender's own words — "rent-receipt-march" is
    // the whole reason a support agent can act on it — sanitised by the same
    // rules chat documents already use (separators out, control characters out,
    // so "invoice.pdf<RLO>gpj.exe" cannot masquerade in a rendered label).
    fileName: safeFileName(file.originalname, ext),
    // What we will actually SERVE, not what was claimed. The record must match
    // reality or a client renders on a promise the storage will not keep.
    mimeType: contentType,
    sizeBytes: file.buffer.length,
  }
}
