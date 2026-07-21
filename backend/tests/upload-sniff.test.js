/**
 * Upload magic-byte sniffing — 2026-07-21 security fix.
 *
 * The multer fileFilter only sees the CLIENT-declared mimetype, so a spoofed
 * declaration used to reach Supabase storage unchecked (arbitrary file hosting
 * on the public image domain). uploadToSupabase now derives extension and
 * stored contentType from the buffer's actual magic bytes.
 */
import { describe, it, expect, vi } from 'vitest'

vi.mock('../src/lib/supabase.js', () => ({ supabase: {} }))
const { sniffImageType } = await import('../src/features/uploads/uploads.service.js')

const JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(16)])
const PNG  = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(16)])
const WEBP = Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WEBP'), Buffer.alloc(16)])
const GIF  = Buffer.concat([Buffer.from('GIF89a'), Buffer.alloc(16)])
const HTML = Buffer.from('<!doctype html><script>alert(1)</script>' + ' '.repeat(16))

describe('sniffImageType', () => {
  it('recognises real JPEG, PNG and WebP headers', () => {
    expect(sniffImageType(JPEG)).toEqual({ ext: 'jpg', mime: 'image/jpeg' })
    expect(sniffImageType(PNG)).toEqual({ ext: 'png', mime: 'image/png' })
    expect(sniffImageType(WEBP)).toEqual({ ext: 'webp', mime: 'image/webp' })
  })

  it('rejects content whose bytes are not an allowed image, whatever was declared', () => {
    expect(sniffImageType(HTML)).toBeNull() // declared image/png, actually HTML
    expect(sniffImageType(GIF)).toBeNull()  // real image, but not an allowed type
  })

  it('rejects empty and too-short buffers', () => {
    expect(sniffImageType(null)).toBeNull()
    expect(sniffImageType(Buffer.alloc(0))).toBeNull()
    expect(sniffImageType(Buffer.from([0xff, 0xd8, 0xff]))).toBeNull() // under 12 bytes
  })
})
