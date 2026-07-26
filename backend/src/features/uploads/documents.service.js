import { randomUUID } from 'crypto'
import { supabase } from '../../lib/supabase.js'

// Document uploads — chat attachments that aren't photos. Separate from
// uploads.service.js because the pipeline genuinely differs: an image is
// re-encoded to WebP at a capped width, while a document is stored byte for
// byte (there is nothing to resize in a PDF).
//
// What is NOT different is the magic-byte discipline: the declared mimetype is
// the client's claim, the buffer is the truth.

// PDF only, deliberately. Office formats (.docx/.xlsx) are ZIP containers whose
// real contents a magic-byte check cannot see, so allowing them would mean
// serving arbitrary archives from our public storage domain. An agreement draft
// is a PDF in practice; if that ever stops being true, the answer is a virus
// scanner, not a wider allowlist.
export function sniffDocumentType(buffer) {
  if (!buffer || buffer.length < 5) return null
  if (buffer.toString('ascii', 0, 5) === '%PDF-') return { ext: 'pdf', mime: 'application/pdf' }
  return null
}

const SEPARATORS = /[\\/]/g
// Written as a code-point filter rather than a regex character class: a literal
// control-character range would put unreviewable raw bytes in this file.
const isPrintable = (ch) => {
  const code = ch.charCodeAt(0)
  return code > 31 && code !== 127
}
const TRAILING_EXT = /\.[^.]*$/

// The storage PATH stays a UUID — an original filename in a public URL leaks
// whatever the sender happened to call the file, and that rule predates this.
// The DISPLAY name travels with the message instead, because "a PDF" with no
// name is not something a person can act on.
//
// Sanitised on three counts: path separators out (a name is not a path),
// control characters out (they can hide the real extension inside a rendered
// label — "invoice.pdf<RLO>gpj.exe"), and the sender's own extension dropped so
// the label carries the one we actually verified from the bytes.
export function safeFileName(originalName, ext) {
  const base = String(originalName ?? '')
    .replace(SEPARATORS, ' ')
    .split('').filter(isPrintable).join('')
    .replace(TRAILING_EXT, '')
    .trim()
    .slice(0, 80)
  return base ? `${base}.${ext}` : `document.${ext}`
}

export async function uploadDocument(file, userId, folder) {
  const sniffed = sniffDocumentType(file?.buffer)
  if (!sniffed) throw Object.assign(new Error('Only PDF documents are allowed'), { statusCode: 400 })

  const path = `${folder}/${userId}/${randomUUID()}.${sniffed.ext}`
  const { error } = await supabase.storage
    .from('StayOnMap')
    .upload(path, file.buffer, { contentType: sniffed.mime })

  if (error) {
    console.error('Supabase storage error:', error)
    throw Object.assign(new Error('Upload failed'), { statusCode: 500 })
  }

  const { data } = supabase.storage.from('StayOnMap').getPublicUrl(path)
  return { url: data.publicUrl, mime: sniffed.mime, name: safeFileName(file.originalname, sniffed.ext) }
}
