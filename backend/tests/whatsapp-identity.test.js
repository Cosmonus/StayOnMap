// Who a WhatsApp number is, and how the sign-in link it receives works.
//
// The refusals matter most: a number that was merely TYPED into a profile is
// never silently linked, and a used, expired or malformed link is one and the
// same 401.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import crypto from 'crypto'
import { prismaMock } from './mocks/prisma.js'

vi.mock('../src/features/auth/session.service.js', () => ({
  issueSession: vi.fn().mockResolvedValue('refresh-token'),
}))

const { toE164, toLocal, toDisplay, toMasked } = await import('../src/features/whatsapp/phone.js')
const identity = await import('../src/features/whatsapp/identity.service.js')
const { createLoginLink, consumeLoginLink } = await import('../src/features/whatsapp/loginLink.service.js')

const PHONE = '919876543210'

beforeEach(() => {
  for (const m of [prismaMock.user.findFirst, prismaMock.user.findMany, prismaMock.user.create, prismaMock.user.update, prismaMock.user.findUnique,
    prismaMock.whatsAppLoginLink.create, prismaMock.whatsAppLoginLink.findUnique, prismaMock.whatsAppLoginLink.update]) m.mockReset()
  prismaMock.user.findFirst.mockResolvedValue(null)
  prismaMock.user.findMany.mockResolvedValue([])
  prismaMock.user.update.mockImplementation(async ({ data }) => ({ id: 'u1', ...data }))
  prismaMock.whatsAppLoginLink.create.mockResolvedValue({})
  prismaMock.whatsAppLoginLink.update.mockResolvedValue({})
})

describe('phone normalisation — one number, two spellings', () => {
  it('accepts every way an Indian mobile is written', () => {
    for (const s of ['+91 98765 43210', '09876543210', '9876543210', '919876543210', '91-98765-43210']) expect(toE164(s)).toBe(PHONE)
  })
  it('rejects what cannot be an Indian mobile', () => {
    for (const s of ['12345', '1234567890', '447700900123', '', null]) expect(toE164(s)).toBeNull()
  })
  it('derives the local, display and masked forms from the same normaliser', () => {
    expect(toLocal(PHONE)).toBe('9876543210')
    expect(toDisplay(PHONE)).toBe('+91 98765 43210')
    expect(toMasked(PHONE)).toBe('+91 •••••43210')
  })
})

describe('resolving the owner', () => {
  it('a number VERIFIED on an account resolves to that account', async () => {
    prismaMock.user.findFirst.mockResolvedValue({ id: 'u1', phone: '9876543210', phoneVerifiedAt: new Date(), role: 'TENANT' })
    const u = await identity.findVerifiedOwner(PHONE)
    expect(u.id).toBe('u1')
    expect(prismaMock.user.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { phone: '9876543210', phoneVerifiedAt: { not: null } } }))
  })

  it('a first-time owner gets an account with NO email, a verified phone and the OWNER role', async () => {
    prismaMock.user.create.mockImplementation(async ({ data }) => ({ id: 'new', ...data }))
    const u = await identity.createWhatsAppOwner(PHONE, { name: 'Asha Rao' })
    expect(u.email).toBeNull()
    expect(u.passwordHash).toBeNull()
    expect(u.phone).toBe('9876543210')
    expect(u.phoneVerifiedAt).toBeInstanceOf(Date)
    expect(u.role).toBe('OWNER')
    expect(u.name).toBe('Asha Rao')
  })

  it('an account that merely TYPED the number is offered, not assumed — and only when it is the only one', async () => {
    prismaMock.user.findMany.mockResolvedValue([{ id: 'u2', email: 'asha.rao@gmail.com', name: 'Asha' }])
    const c = await identity.findUnverifiedCandidate(PHONE)
    expect(c.id).toBe('u2')
    expect(identity.maskEmail(c.email)).toBe('as******@gmail.com')
    prismaMock.user.findMany.mockResolvedValue([{ id: 'u2', email: 'a@b.c' }, { id: 'u3', email: 'c@d.e' }])
    expect(await identity.findUnverifiedCandidate(PHONE)).toBeNull()
  })

  it('linking is refused if someone else verified the number in the meantime', async () => {
    prismaMock.user.findFirst.mockResolvedValue({ id: 'other' })
    await expect(identity.linkExistingAccount('u2', PHONE)).rejects.toMatchObject({ statusCode: 409 })
    expect(prismaMock.user.update).not.toHaveBeenCalled()
  })

  it('linking marks the number verified and makes the account an owner', async () => {
    const u = await identity.linkExistingAccount('u2', PHONE)
    expect(u.phoneVerifiedAt).toBeInstanceOf(Date)
    expect(u.role).toBe('OWNER')
  })
})

describe('the sign-in link', () => {
  const hash = (raw) => crypto.createHash('sha256').update(raw).digest('hex')

  it('stores only the hash and puts the raw token in the URL, with a safe next path', async () => {
    const url = await createLoginLink('u1', { next: '/list' })
    const u = new URL(url)
    expect(u.pathname).toBe('/wa/login')
    const raw = u.searchParams.get('token')
    expect(raw).toMatch(/^[a-f0-9]{64}$/)
    expect(u.searchParams.get('next')).toBe('/list')
    const stored = prismaMock.whatsAppLoginLink.create.mock.calls[0][0].data
    expect(stored.tokenHash).toBe(hash(raw))
    expect(stored.tokenHash).not.toBe(raw)
    expect(stored.expiresAt.getTime()).toBeGreaterThan(Date.now() + 23 * 3_600_000)
  })

  it('an off-site next is dropped', async () => {
    const url = await createLoginLink('u1', { next: 'https://evil.example' })
    expect(new URL(url).searchParams.get('next')).toBeNull()
  })

  it('a valid link mints the ordinary session triple and burns itself', async () => {
    const raw = 'a'.repeat(64)
    prismaMock.whatsAppLoginLink.findUnique.mockResolvedValue({ id: 'l1', userId: 'u1', usedAt: null, expiresAt: new Date(Date.now() + 60_000) })
    prismaMock.user.findUnique.mockResolvedValue({ id: 'u1', email: null, role: 'OWNER', isBlocked: false, passwordHash: null })
    const r = await consumeLoginLink(raw)
    expect(r.refreshToken).toBe('refresh-token')
    expect(typeof r.token).toBe('string')
    expect(r.user.passwordHash).toBeUndefined()
    expect(prismaMock.whatsAppLoginLink.update).toHaveBeenCalledWith({ where: { id: 'l1' }, data: { usedAt: expect.any(Date) } })
  })

  it('used, expired, unknown and malformed links all fail identically', async () => {
    const raw = 'b'.repeat(64)
    prismaMock.user.findUnique.mockResolvedValue({ id: 'u1', isBlocked: false })
    prismaMock.whatsAppLoginLink.findUnique.mockResolvedValue({ id: 'l1', userId: 'u1', usedAt: new Date(), expiresAt: new Date(Date.now() + 60_000) })
    await expect(consumeLoginLink(raw)).rejects.toMatchObject({ statusCode: 401 })
    prismaMock.whatsAppLoginLink.findUnique.mockResolvedValue({ id: 'l1', userId: 'u1', usedAt: null, expiresAt: new Date(Date.now() - 1) })
    await expect(consumeLoginLink(raw)).rejects.toMatchObject({ statusCode: 401 })
    prismaMock.whatsAppLoginLink.findUnique.mockResolvedValue(null)
    await expect(consumeLoginLink(raw)).rejects.toMatchObject({ statusCode: 401 })
    await expect(consumeLoginLink('not-a-token')).rejects.toMatchObject({ statusCode: 401 })
    expect(prismaMock.whatsAppLoginLink.findUnique).toHaveBeenCalledTimes(3) // the malformed one never reaches the DB
  })

  it('a blocked account burns the link and is refused', async () => {
    prismaMock.whatsAppLoginLink.findUnique.mockResolvedValue({ id: 'l1', userId: 'u1', usedAt: null, expiresAt: new Date(Date.now() + 60_000) })
    prismaMock.user.findUnique.mockResolvedValue({ id: 'u1', isBlocked: true })
    await expect(consumeLoginLink('c'.repeat(64))).rejects.toMatchObject({ statusCode: 403 })
    expect(prismaMock.whatsAppLoginLink.update).toHaveBeenCalled()
  })
})
