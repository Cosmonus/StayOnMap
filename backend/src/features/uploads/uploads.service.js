import { supabase } from '../../lib/supabase.js'
import { randomUUID } from 'crypto'

const MIME_TO_EXT = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }

export async function uploadToSupabase(file, userId, folder = 'properties') {
  const ext = MIME_TO_EXT[file.mimetype]
  if (!ext) throw Object.assign(new Error('Unsupported image type'), { statusCode: 400 })

  // randomUUID path prevents original filename exposure and path traversal
  const path = `${folder}/${userId}/${randomUUID()}.${ext}`

  const { error } = await supabase.storage
    .from('StayOnMap')
    .upload(path, file.buffer, { contentType: file.mimetype })

  if (error) {
    console.error('Supabase storage error:', error)
    throw Object.assign(new Error('Upload failed'), { statusCode: 500 })
  }

  const { data } = supabase.storage.from('StayOnMap').getPublicUrl(path)
  return data.publicUrl
}
