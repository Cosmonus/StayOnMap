// A WhatsApp photo → the existing property-image uploader, with every failure
// named rather than swallowed.
import { describe, it, expect, vi, beforeEach } from 'vitest'

const downloadMedia = vi.fn()
vi.mock('../src/features/whatsapp/client.js', () => ({
  downloadMedia: (...a) => downloadMedia(...a),
  whatsappConfigured: () => true,
}))
// uploads.service.js imports the Supabase client, which throws without env.
vi.mock('../src/lib/supabase.js', () => ({ supabase: { storage: { from: () => ({}) } } }))
const uploadPropertyImageSet = vi.fn()
vi.mock('../src/features/uploads/uploads.service.js', async (importOriginal) => {
  const real = await importOriginal()
  return { ...real, uploadPropertyImageSet: (...a) => uploadPropertyImageSet(...a) }
})

const { ingestPhoto, MAX_PHOTOS } = await import('../src/features/whatsapp/media.service.js')

const JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(32, 1)])
const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(32, 2)])
const TEXT = Buffer.from('this is not an image at all')

beforeEach(() => {
  downloadMedia.mockReset()
  uploadPropertyImageSet.mockReset().mockImplementation(async () => `https://x.supabase.co/storage/v1/object/public/StayOnMap/properties/u/${Math.random()}_full.webp`)
})

describe('ingestPhoto', () => {
  it('one image: downloaded, sniffed, uploaded through the wizard uploader, ordered', async () => {
    downloadMedia.mockResolvedValue({ buffer: JPEG, mimeType: 'image/jpeg', sha256: 'aaa' })
    const r = await ingestPhoto({ photos: [] }, { id: 'm1' }, 'user-1')
    expect(r.status).toBe('added')
    expect(r.photo).toMatchObject({ waMediaId: 'm1', sha256: 'aaa', order: 0 })
    expect(r.photo.url).toMatch(/_full\.webp$/)
    expect(uploadPropertyImageSet).toHaveBeenCalledWith({ buffer: JPEG }, 'user-1')
  })

  it('multiple images keep their arrival order', async () => {
    const draft = { photos: [] }
    for (const [i, id] of ['m1', 'm2', 'm3'].entries()) {
      downloadMedia.mockResolvedValueOnce({ buffer: i % 2 ? PNG : JPEG, sha256: `h${i}` })
      const r = await ingestPhoto(draft, { id }, 'u')
      draft.photos.push(r.photo)
    }
    expect(draft.photos.map((p) => p.order)).toEqual([0, 1, 2])
  })

  it('a retried webhook (same media id) is a duplicate, and so is the same bytes under a new id', async () => {
    const draft = { photos: [{ waMediaId: 'm1', sha256: 'aaa', url: 'x' }] }
    expect((await ingestPhoto(draft, { id: 'm1' }, 'u')).status).toBe('duplicate')
    expect(downloadMedia).not.toHaveBeenCalled()
    downloadMedia.mockResolvedValue({ buffer: JPEG, sha256: 'aaa' })
    expect((await ingestPhoto(draft, { id: 'm2' }, 'u')).status).toBe('duplicate')
    expect(uploadPropertyImageSet).not.toHaveBeenCalled()
  })

  it('a file that is not an image is invalid — the declared mimetype is not trusted', async () => {
    downloadMedia.mockResolvedValue({ buffer: TEXT, mimeType: 'image/jpeg', sha256: 'zzz' })
    const r = await ingestPhoto({ photos: [] }, { id: 'm9' }, 'u')
    expect(r.status).toBe('invalid')
    expect(uploadPropertyImageSet).not.toHaveBeenCalled()
  })

  it('a failed download and a failed upload are both reported, never thrown', async () => {
    downloadMedia.mockRejectedValue(new Error('media lookup failed (404)'))
    expect(await ingestPhoto({ photos: [] }, { id: 'm1' }, 'u')).toEqual({ status: 'failed', reason: 'media lookup failed (404)' })
    downloadMedia.mockResolvedValue({ buffer: JPEG, sha256: 'aaa' })
    uploadPropertyImageSet.mockRejectedValue(Object.assign(new Error('Upload failed'), { statusCode: 500 }))
    expect(await ingestPhoto({ photos: [] }, { id: 'm2' }, 'u')).toEqual({ status: 'failed', reason: 'Upload failed' })
  })

  it('stops at the listing cap without downloading', async () => {
    const draft = { photos: Array.from({ length: MAX_PHOTOS }, (_, i) => ({ waMediaId: `m${i}`, sha256: `${i}` })) }
    expect((await ingestPhoto(draft, { id: 'new' }, 'u')).status).toBe('full')
    expect(downloadMedia).not.toHaveBeenCalled()
  })
})
