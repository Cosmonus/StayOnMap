// Refresh-token sessions: rotation, replay detection, revocation scoping.
//
// The property under test throughout: a refresh token is single-use. Using it
// rotates it; using a ROTATED-OUT one is treated as theft and kills the whole
// session — not just the request.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { prismaMock } from './mocks/prisma.js'
import {
  refreshSession,
  revokeSessionByToken,
  revokeAllSessions,
  revokeSessionById,
  deviceLabelFrom,
} from '../src/features/auth/session.service.js'
import crypto from 'crypto'

const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex')

const USER = { id: 'u1', email: 'a@b.c', role: 'TENANT', isBlocked: false, passwordHash: 'x' }

function sessionRow(overrides = {}) {
  return {
    id: 's1',
    userId: 'u1',
    tokenHash: sha256('current-token'),
    prevTokenHash: null,
    revokedAt: null,
    expiresAt: new Date(Date.now() + 86400_000),
    user: USER,
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  prismaMock.authSession = {
    findUnique: vi.fn().mockResolvedValue(null),
    findMany: vi.fn().mockResolvedValue([]),
    create: vi.fn().mockResolvedValue({}),
    update: vi.fn().mockResolvedValue({}),
    updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
  }
})

describe('refreshSession', () => {
  it('rotates: new token issued, old hash kept as prevTokenHash', async () => {
    prismaMock.authSession.findUnique
      .mockResolvedValueOnce(null) // no replay match
      .mockResolvedValueOnce(sessionRow()) // current-token lookup
    const result = await refreshSession('current-token')

    expect(result.token).toBeTruthy()
    expect(result.refreshToken).toBeTruthy()
    expect(result.refreshToken).not.toBe('current-token')
    expect(result.user.passwordHash).toBeUndefined()

    const update = prismaMock.authSession.update.mock.calls[0][0]
    expect(update.data.prevTokenHash).toBe(sha256('current-token'))
    expect(update.data.tokenHash).toBe(sha256(result.refreshToken))
  })

  it('replaying a rotated-out token revokes the whole session', async () => {
    prismaMock.authSession.findUnique.mockResolvedValueOnce(
      sessionRow({ prevTokenHash: sha256('stolen-old-token') })
    )
    await expect(refreshSession('stolen-old-token')).rejects.toMatchObject({ statusCode: 401 })
    expect(prismaMock.authSession.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { revokedAt: expect.any(Date) } })
    )
  })

  it('rejects revoked and expired sessions', async () => {
    prismaMock.authSession.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(sessionRow({ revokedAt: new Date() }))
    await expect(refreshSession('current-token')).rejects.toMatchObject({ statusCode: 401 })

    prismaMock.authSession.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(sessionRow({ expiresAt: new Date(Date.now() - 1000) }))
    await expect(refreshSession('current-token')).rejects.toMatchObject({ statusCode: 401 })
  })

  it('a blocked user cannot refresh their way past the block', async () => {
    prismaMock.authSession.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(sessionRow({ user: { ...USER, isBlocked: true } }))
    await expect(refreshSession('current-token')).rejects.toMatchObject({ statusCode: 403 })
  })

  it('an unknown token is a plain 401 — no oracle about why', async () => {
    await expect(refreshSession('garbage')).rejects.toMatchObject({ statusCode: 401 })
  })
})

describe('revocation', () => {
  it('logout accepts the current OR the just-rotated token', async () => {
    await revokeSessionByToken('some-token')
    const where = prismaMock.authSession.updateMany.mock.calls[0][0].where
    expect(where.OR).toEqual([
      { tokenHash: sha256('some-token') },
      { prevTokenHash: sha256('some-token') },
    ])
  })

  it('logout-all revokes only the given user, only active sessions', async () => {
    await revokeAllSessions('u1')
    expect(prismaMock.authSession.updateMany).toHaveBeenCalledWith({
      where: { userId: 'u1', revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    })
  })

  it('revoking by id is scoped to the owner — a stranger gets 404', async () => {
    prismaMock.authSession.updateMany.mockResolvedValue({ count: 0 })
    await expect(revokeSessionById('u1', 'someone-elses-session')).rejects.toMatchObject({ statusCode: 404 })
    expect(prismaMock.authSession.updateMany.mock.calls[0][0].where.userId).toBe('u1')
  })
})

describe('deviceLabelFrom', () => {
  it('labels common agents without fingerprinting', () => {
    expect(deviceLabelFrom('Mozilla/5.0 (Windows NT 10.0) Chrome/126.0 Safari/537.36')).toBe('Chrome on Windows')
    expect(deviceLabelFrom('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0) Safari/604.1')).toBe('Safari on iOS')
    expect(deviceLabelFrom('okhttp/4.9.2')).toBe('StayOnMap mobile app')
    expect(deviceLabelFrom('')).toBeNull()
  })
})
