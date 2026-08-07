import sharp from 'sharp'
import { supabase } from '../../lib/supabase.js'
import { randomUUID } from 'crypto'
import { fingerprintUpload } from '../intelligence/imageFingerprint.js'

// Magic-byte sniffing — the multer fileFilter only sees the CLIENT-declared
// mimetype; the buffer is the truth. A spoofed declaration can't park a
// non-image file on the public storage domain.
export function sniffImageType(buffer) {
  if (!buffer || buffer.length < 12) return null
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return { ext: 'jpg', mime: 'image/jpeg' }
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47 &&
      buffer[4] === 0x0d && buffer[5] === 0x0a && buffer[6] === 0x1a && buffer[7] === 0x0a) return { ext: 'png', mime: 'image/png' }
  if (buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP') return { ext: 'webp', mime: 'image/webp' }
  return null
}

// Re-encode to WebP at a capped width. `.rotate()` with no args bakes in the
// EXIF orientation so portrait phone photos don't come out sideways once the
// orientation tag is dropped. `withoutEnlargement` means a small image is never
// upscaled (which would only add bytes). WebP at these qualities is ~1/8th the
// size of the original JPEG a 12MP camera produces.
async function toWebp(buffer, width, quality) {
  return sharp(buffer)
    .rotate()
    .resize({ width, withoutEnlargement: true })
    .webp({ quality })
    .toBuffer()
}

async function putObject(path, buffer, contentType) {
  const { error } = await supabase.storage
    .from('StayOnMap')
    .upload(path, buffer, { contentType })

  if (error) {
    console.error('Supabase storage error:', error)
    throw Object.assign(new Error('Upload failed'), { statusCode: 500 })
  }

  const { data } = supabase.storage.from('StayOnMap').getPublicUrl(path)
  return data.publicUrl
}

// Property images are viewed in two very different places: a 3-across card list
// (needs ~480px) and a full-screen gallery (needs ~1600px). We store BOTH as
// WebP beside each other under a shared UUID base, and return the "_full" URL as
// the canonical one saved on PropertyImage.url. `imgUrl()` on the clients swaps
// "_full.webp" → "_thumb.webp" for cards — so a list of 20 photos pulls 20
// ~40KB thumbs, not 20 full-res originals. (Supabase's own `?width=` transform
// is a paid Pro-plan feature on a different endpoint and was silently a no-op,
// which is why this is done at write time instead.)
export async function uploadPropertyImageSet(file, userId) {
  const sniffed = sniffImageType(file.buffer)
  if (!sniffed) throw Object.assign(new Error('Unsupported image type'), { statusCode: 400 })

  const base = `properties/${userId}/${randomUUID()}`
  const [thumb, full] = await Promise.all([
    toWebp(file.buffer, 480, 65),
    toWebp(file.buffer, 1600, 80),
  ])
  const [, fullUrl] = await Promise.all([
    putObject(`${base}_thumb.webp`, thumb, 'image/webp'),
    putObject(`${base}_full.webp`, full, 'image/webp'),
  ])

  // Perceptual hash for reused-photo detection, computed HERE because the
  // original bytes are in memory exactly once — anywhere else in the system this
  // would mean downloading the image back off Supabase. Hashed from the ORIGINAL
  // buffer, not the WebP we just wrote, so a re-poster who uploads the same
  // photo at a different size still lands on the same hash.
  //
  // Fire-and-forget: an upload must never fail because a fraud heuristic could
  // not hash it.
  fingerprintUpload(fullUrl, file.buffer, userId).catch(() => {})

  return fullUrl
}

// Avatars and chat images are shown at one size, so a single capped WebP is
// enough — no thumb/full split. `imgUrl()` leaves these URLs untouched (no
// "_full.webp" marker), which is correct: there's nothing smaller to point at.
export async function uploadSingle(file, userId, folder, width, quality) {
  const sniffed = sniffImageType(file.buffer)
  if (!sniffed) throw Object.assign(new Error('Unsupported image type'), { statusCode: 400 })

  const path = `${folder}/${userId}/${randomUUID()}.webp`
  const buffer = await toWebp(file.buffer, width, quality)
  return putObject(path, buffer, 'image/webp')
}
