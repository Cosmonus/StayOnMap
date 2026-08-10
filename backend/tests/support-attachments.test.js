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

const { attachmentSchema } = await import('../src/features/support/support.validation.js')
const { addAttachment } = await import('../src/features/support/supportCase.service.js')

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

describe('the upload endpoint behind it', () => {
  const routes = readFileSync(new URL('../src/features/uploads/uploads.routes.js', import.meta.url), 'utf8')
  const controller = readFileSync(new URL('../src/features/uploads/uploads.controller.js', import.meta.url), 'utf8')

  it('is authenticated', () => {
    expect(routes).toMatch(/support-file'.*authMiddleware/)
  })

  it('takes images AND PDFs, and nothing else', () => {
    // One door, because the person attaching does not think in mime types: the
    // fake listing is a screenshot and the disputed agreement is a PDF.
    expect(routes).toMatch(/uploadEvidence[\s\S]*ALLOWED_MIMETYPES[\s\S]*DOC_MIMETYPES/)
  })

  it('reports image/webp for an image, because it CONVERTS', () => {
    // Recording the uploaded type would store a mime the URL does not serve.
    expect(controller).toMatch(/uploadSupportFile[\s\S]*mimeType: 'image\/webp'/)
  })
})
