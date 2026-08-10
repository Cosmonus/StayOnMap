/**
 * Attaching evidence.
 *
 * The dangerous part is not the upload — it is the RECORD step. An attachment
 * is rendered to an admin and to the other party, so the URL is a thing this
 * platform will show somebody and a thing staff will click.
 *
 * The schema comment said "must not become a second way to attach an arbitrary
 * remote URL to a case" from the day it was written, and for that whole time
 * nothing enforced it: `z.string().url()` passed any https address. This file
 * exists so the sentence and the code cannot drift apart again.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { prismaMock } from './mocks/prisma.js'

const CASE = {
  id: 'c1', status: 'OPEN', createdById: 'u1', openedAs: 'TENANT',
  relatedUserId: null, relatedPropertyId: null,
}

// SUPABASE_URL is unset across the suite, and the guard deliberately falls open
// without it — a local checkout has no uploader, so refusing every URL would
// mean refusing the only ones that could exist. Set it BEFORE the import so
// this file exercises the configured path, which is the one production runs.
// Scoped to this module, so no other suite's image URLs change meaning.
process.env.SUPABASE_URL = 'https://storage.test.invalid'

// Storage is the one dependency here that would reach the network. Mocked to
// echo back the path it was given, so the assertions can read what the service
// DECIDED — the content type and the path — which is the whole subject.
const uploaded = []
vi.mock('../src/lib/supabase.js', () => ({
  supabase: {
    storage: {
      from: () => ({
        upload: (path, buffer, opts) => {
          uploaded.push({ path, opts })
          return Promise.resolve({ error: null })
        },
        getPublicUrl: (path) => ({ data: { publicUrl: `https://storage.test.invalid/storage/v1/object/public/${path}` } }),
      }),
    },
  },
}))

const { attachmentSchema } = await import('../src/features/support/support.validation.js')
const { addAttachment } = await import('../src/features/support/supportCase.service.js')
const { uploadEvidence, sniffRenderable } = await import('../src/features/uploads/evidence.service.js')

const OURS = `${process.env.SUPABASE_URL}/storage/v1/object/public/support/u1/abc.webp`

beforeEach(() => {
  vi.clearAllMocks()
  prismaMock.$transaction.mockImplementation(async (fn) => fn(prismaMock))
  prismaMock.supportCase.findUnique.mockResolvedValue({ ...CASE })
  prismaMock.supportAttachment.create.mockResolvedValue({ id: 'at1', visibility: 'TENANT_ONLY' })
  prismaMock.supportEvent.create.mockResolvedValue({ id: 'e1' })
})

describe('only a file we stored', () => {
  it('accepts a URL from our own storage', () => {
    expect(attachmentSchema.safeParse({ url: OURS, mimeType: 'image/webp' }).success).toBe(true)
  })

  for (const hostile of [
    'https://evil.example.com/receipt.pdf',
    'https://drive.google.com/file/d/x/view',
    // The prefix is checked, not merely contained — a host that embeds ours in
    // its path is the obvious way past a naive `includes`.
    'https://evil.example.com/?x=https://supabase.co/storage/v1/object/public/',
  ]) {
    it(`refuses ${hostile.slice(0, 44)}…`, () => {
      const result = attachmentSchema.safeParse({ url: hostile, mimeType: 'image/png' })
      expect(result.success).toBe(false)
    })
  }

  it('refuses something that is not a URL at all', () => {
    expect(attachmentSchema.safeParse({ url: 'javascript:alert(1)', mimeType: 'image/png' }).success).toBe(false)
  })

  it('takes no visibility from the caller', () => {
    // A user who could set PUBLIC on their own evidence could publish a
    // screenshot into a case the person they reported reads.
    const parsed = attachmentSchema.safeParse({ url: OURS, mimeType: 'image/webp', visibility: 'PUBLIC' })
    expect(parsed.success).toBe(true)
    expect(parsed.data.visibility).toBeUndefined()
  })
})

describe('what the server decides about it', () => {
  it('stores a tenant’s file as TENANT_ONLY, whatever was asked for', async () => {
    prismaMock.property.findUnique.mockResolvedValue(null)
    await addAttachment('c1', { role: 'TENANT', userId: 'u1' }, { url: OURS, mimeType: 'image/webp' })

    expect(prismaMock.supportAttachment.create.mock.calls[0][0].data.visibility).toBe('TENANT_ONLY')
  })

  it('stores staff evidence as INTERNAL by default', async () => {
    await addAttachment('c1', { role: 'ADMIN', adminId: 'a1' }, { url: OURS, mimeType: 'application/pdf' })

    expect(prismaMock.supportAttachment.create.mock.calls[0][0].data.visibility).toBe('INTERNAL')
  })

  it('lets staff share one deliberately', async () => {
    // An admin showing an owner the document that settles a dispute has to be
    // able to. It is a choice, which is exactly why it is not the default.
    await addAttachment('c1', { role: 'ADMIN', adminId: 'a1' }, { url: OURS, mimeType: 'application/pdf', visibility: 'OWNER_ONLY' })

    expect(prismaMock.supportAttachment.create.mock.calls[0][0].data.visibility).toBe('OWNER_ONLY')
  })

  it('falls back to INTERNAL on a visibility nobody has reasoned about', async () => {
    await addAttachment('c1', { role: 'ADMIN', adminId: 'a1' }, { url: OURS, mimeType: 'application/pdf', visibility: 'EVERYONE' })

    expect(prismaMock.supportAttachment.create.mock.calls[0][0].data.visibility).toBe('INTERNAL')
  })

  it('ignores a USER asking to make their evidence public', async () => {
    // On a report case that would publish the reporter's own identity to the
    // person they reported.
    prismaMock.property.findUnique.mockResolvedValue(null)
    await addAttachment('c1', { role: 'TENANT', userId: 'u1' }, { url: OURS, mimeType: 'image/png', visibility: 'PUBLIC' })

    expect(prismaMock.supportAttachment.create.mock.calls[0][0].data.visibility).toBe('TENANT_ONLY')
  })

  it('refuses a case the caller is no party to — 404, not 403', async () => {
    prismaMock.supportCase.findUnique.mockResolvedValue({ ...CASE, createdById: 'someone-else' })
    prismaMock.property.findUnique.mockResolvedValue(null)

    await expect(
      addAttachment('c1', { role: 'TENANT', userId: 'u1' }, { url: OURS, mimeType: 'image/webp' }),
    ).rejects.toMatchObject({ statusCode: 404 })
  })

  it('refuses a closed case', async () => {
    prismaMock.supportCase.findUnique.mockResolvedValue({ ...CASE, status: 'CLOSED' })
    prismaMock.property.findUnique.mockResolvedValue(null)

    await expect(
      addAttachment('c1', { role: 'TENANT', userId: 'u1' }, { url: OURS, mimeType: 'image/webp' }),
    ).rejects.toMatchObject({ statusCode: 400 })
  })

  it('records it in the timeline', async () => {
    prismaMock.property.findUnique.mockResolvedValue(null)
    await addAttachment('c1', { role: 'TENANT', userId: 'u1' }, { url: OURS, mimeType: 'image/webp' })

    const types = prismaMock.supportEvent.create.mock.calls.map((c) => c[0].data.type)
    expect(types).toContain('ATTACHMENT_ADDED')
  })
})

describe('the upload endpoints behind it', () => {
  const routes = readFileSync(new URL('../src/features/uploads/uploads.routes.js', import.meta.url), 'utf8')
  const supportRoutes = readFileSync(new URL('../src/features/support/support.routes.js', import.meta.url), 'utf8')

  it('is authenticated on the user side', () => {
    expect(routes).toMatch(/support-file'.*authMiddleware/)
  })

  it('gives staff their own upload route, behind the ADMIN secret', () => {
    // /uploads/* is all user-JWT, so before this an admin could record an
    // attachment URL and had no way to produce one.
    expect(supportRoutes).toMatch(/adminSupportRouter\.post\('\/cases\/:id\/upload'/)
    expect(supportRoutes).toMatch(/adminSupportRouter\.use\(adminAuthMiddleware\)/)
  })

  it('takes every type — no fileFilter on either', () => {
    // Narrowing the types narrows what somebody can PROVE. The safety is in
    // HOW the file is stored, not in whether it is accepted.
    const evidenceBlocks = [routes, supportRoutes]
      .flatMap((src) => src.split('multer({').slice(1))
      .filter((block) => /25 \* 1024 \* 1024/.test(block))

    expect(evidenceBlocks.length).toBe(2)
    for (const block of evidenceBlocks) {
      expect(block.slice(0, block.indexOf('})'))).not.toMatch(/fileFilter/)
    }
  })
})

describe('what may RENDER is decided by the bytes', () => {
  // The one real hazard is not the file at rest, it is the browser rendering
  // it: an .svg or .html served inline from our storage domain is a working
  // script or a phishing page on a URL that looks like ours, which staff have
  // been told is evidence.
  const png = Buffer.concat([Buffer.from('89504e470d0a1a0a', 'hex'), Buffer.alloc(16)])
  const pdf = Buffer.concat([Buffer.from('%PDF-1.7'), Buffer.alloc(16)])
  const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>')
  const html = Buffer.from('<!doctype html><html><body>Sign in to StayOnMap</body></html>')

  it('renders a real PNG as an image', () => {
    expect(sniffRenderable(png)?.mime).toBe('image/png')
  })

  it('renders a real PDF as a PDF', () => {
    expect(sniffRenderable(pdf)?.mime).toBe('application/pdf')
  })

  it('never renders SVG, image though it is', () => {
    // XML that can carry script — the single most common stored-XSS vector in
    // an uploader. It still UPLOADS; it downloads instead of rendering.
    expect(sniffRenderable(svg)).toBeNull()
  })

  it('never renders HTML', () => {
    expect(sniffRenderable(html)).toBeNull()
  })

  it('ignores the DECLARED type entirely — HTML claiming to be a PNG still downloads', async () => {
    const stored = await uploadEvidence(
      { buffer: html, originalname: 'screenshot.png', mimetype: 'image/png' },
      'u1',
    )
    expect(stored.mimeType).toBe('application/octet-stream')
  })

  it('records the type it will actually SERVE, not the one claimed', async () => {
    // A record that disagrees with storage makes a client render on a promise
    // the storage will not keep.
    const stored = await uploadEvidence({ buffer: png, originalname: 'proof.png', mimetype: 'image/png' }, 'u1')
    expect(stored.mimeType).toBe('image/png')
  })

  it('keeps an unknown type rather than refusing it', async () => {
    const docx = Buffer.concat([Buffer.from('PK'), Buffer.alloc(16)])
    const stored = await uploadEvidence({ buffer: docx, originalname: 'agreement.docx', mimetype: 'x/x' }, 'u1')
    expect(stored.url).toContain('.docx')
    expect(stored.mimeType).toBe('application/octet-stream')
  })

  it('keeps the sender’s words in the display name, sanitised', async () => {
    const stored = await uploadEvidence({ buffer: png, originalname: 'rent receipt march.png', mimetype: 'image/png' }, 'u1')
    expect(stored.fileName).toBe('rent receipt march.png')
  })

  it('never puts the original filename in the stored path', async () => {
    // A public URL must not leak whatever the sender happened to call the file.
    const stored = await uploadEvidence({ buffer: png, originalname: 'my-home-address.png', mimetype: 'image/png' }, 'u1')
    expect(stored.url).not.toContain('my-home-address')
  })

  it('refuses an empty upload rather than storing nothing under a URL', async () => {
    await expect(uploadEvidence(undefined, 'u1')).rejects.toMatchObject({ statusCode: 400 })
  })
})
