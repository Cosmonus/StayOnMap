import { supabase } from '../../lib/supabase.js'
import { randomUUID } from 'crypto'

// Magic-byte sniffing — the multer fileFilter only sees the CLIENT-declared
// mimetype; the buffer is the truth. Extension and stored contentType derive
// from what the bytes actually are, so a spoofed declaration can't park a
// non-image file on the public storage domain.
export function sniffImageType(buffer) {
  if (!buffer || buffer.length < 12) return null
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return { ext: 'jpg', mime: 'image/jpeg' }
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47 &&
      buffer[4] === 0x0d && buffer[5] === 0x0a && buffer[6] === 0x1a && buffer[7] === 0x0a) return { ext: 'png', mime: 'image/png' }
  if (buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP') return { ext: 'webp', mime: 'image/webp' }
  return null
}

export async function uploadToSupabase(file, userId, folder = 'properties') {
  const sniffed = sniffImageType(file.buffer)
  if (!sniffed) throw Object.assign(new Error('Unsupported image type'), { statusCode: 400 })

  // randomUUID path prevents original filename exposure and path traversal
  const path = `${folder}/${userId}/${randomUUID()}.${sniffed.ext}`

  const { error } = await supabase.storage
    .from('StayOnMap')
    .upload(path, file.buffer, { contentType: sniffed.mime })

  if (error) {
    console.error('Supabase storage error:', error)
    throw Object.assign(new Error('Upload failed'), { statusCode: 500 })
  }

  const { data } = supabase.storage.from('StayOnMap').getPublicUrl(path)
  return data.publicUrl
}
