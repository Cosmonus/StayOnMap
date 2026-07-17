/**
 * Security regression tests — 2026-07-17 production-readiness audit
 *
 * Each suite below pins a hole that was live in production on this date. They
 * are grouped in one file because they share a theme (an authenticated or
 * anonymous caller reaching past what they should), not because they share a
 * module.
 *
 * Guards:
 *   getOrCreateConversation — chat IDOR: the caller-supplied :tenantId was
 *                             passed through with no ownership check
 *   submitReport            — anyone unauthenticated could suspend any listing
 *                             with 2 CRITICAL reports (severity is client-set)
 *   authMiddleware          — isBlocked was only checked at login, so a blocked
 *                             user kept full access for their token's 7d life
 *   isWithinIndia           — /places/* took arbitrary coordinates, and the
 *                             cache keys on them, so misses were attacker-chosen
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import jwt from 'jsonwebtoken'
import { prismaMock } from './mocks/prisma.js'
import { isWithinIndia } from '../src/utils/geo.js'

// setup.js mocks chat.service.js globally (it's a fire-and-forget dependency of
// other services), so reach past the mock for the real implementation.
const chatService = await vi.importActual('../src/features/chat/chat.service.js')
const reportsService = await vi.importActual('../src/features/reports/reports.service.js')
const { authMiddleware } = await vi.importActual('../src/middlewares/auth.middleware.js')

beforeEach(() => { vi.clearAllMocks() })

describe('getOrCreateConversation — chat IDOR', () => {
  const property = { id: 'prop-1', ownerId: 'owner-1', title: 'Flat' }

  beforeEach(() => {
    prismaMock.property.findUnique.mockResolvedValue(property)
    prismaMock.conversation.findUnique.mockResolvedValue(null)
    prismaMock.conversation.create.mockResolvedValue({ id: 'convo-1' })
  })

  it('lets a tenant start their own conversation', async () => {
    await expect(chatService.getOrCreateConversation('tenant-1', 'prop-1', 'tenant-1')).resolves.toEqual({ id: 'convo-1' })
  })

  it('lets the property owner open a thread with their tenant', async () => {
    await expect(chatService.getOrCreateConversation('tenant-1', 'prop-1', 'owner-1')).resolves.toEqual({ id: 'convo-1' })
  })

  it('rejects a stranger forging a conversation between two other users', async () => {
    await expect(chatService.getOrCreateConversation('tenant-1', 'prop-1', 'attacker-9'))
      .rejects.toMatchObject({ statusCode: 403 })
    expect(prismaMock.conversation.create).not.toHaveBeenCalled()
  })

  it('does not leak an existing conversation to a stranger', async () => {
    // The pre-fix exploit: an existing thread was returned with both parties'
    // emails and the latest message body.
    prismaMock.conversation.findUnique.mockResolvedValue({ id: 'convo-1', tenant: { email: 'a@b.c' } })
    await expect(chatService.getOrCreateConversation('tenant-1', 'prop-1', 'attacker-9'))
      .rejects.toMatchObject({ statusCode: 403 })
  })

  it('still defaults to the tenant when no requester is passed', async () => {
    await expect(chatService.getOrCreateConversation('tenant-1', 'prop-1')).resolves.toEqual({ id: 'convo-1' })
  })
})

describe('submitReport — auto-suspend needs corroboration', () => {
  const critical = { category: 'FRAUD', severity: 'CRITICAL', description: 'x'.repeat(25) }

  beforeEach(() => {
    prismaMock.propertyReport.create.mockResolvedValue({ id: 'report-1' })
    prismaMock.propertyRiskScore.findUnique.mockResolvedValue({ level: 'HIGH' })
    prismaMock.property.findUnique.mockResolvedValue({ ownerId: 'owner-1' })
    prismaMock.property.update.mockResolvedValue({})
  })

  it('does NOT suspend on anonymous reports alone, even at HIGH risk', async () => {
    prismaMock.propertyReport.findMany.mockResolvedValue([])   // no identified reporters
    await reportsService.submitReport(null, 'prop-1', { ...critical, isAnonymous: true })
    expect(prismaMock.property.update).not.toHaveBeenCalled()
  })

  it('does NOT suspend on a single identified reporter', async () => {
    prismaMock.propertyReport.findMany.mockResolvedValue([{ reporterId: 'user-1' }])
    await reportsService.submitReport('user-1', 'prop-1', { ...critical, isAnonymous: false })
    expect(prismaMock.property.update).not.toHaveBeenCalled()
  })

  it('suspends once two distinct identified reporters agree', async () => {
    prismaMock.propertyReport.findMany.mockResolvedValue([{ reporterId: 'user-1' }, { reporterId: 'user-2' }])
    await reportsService.submitReport('user-2', 'prop-1', { ...critical, isAnonymous: false })
    expect(prismaMock.property.update).toHaveBeenCalledWith({ where: { id: 'prop-1' }, data: { status: 'SUSPENDED' } })
  })

  it('never suspends on LOW severity regardless of reporter count', async () => {
    prismaMock.propertyReport.findMany.mockResolvedValue([{ reporterId: 'user-1' }, { reporterId: 'user-2' }])
    await reportsService.submitReport('user-1', 'prop-1', { ...critical, severity: 'LOW' })
    expect(prismaMock.property.update).not.toHaveBeenCalled()
  })

  it('still records an anonymous report rather than dropping it', async () => {
    prismaMock.propertyReport.findMany.mockResolvedValue([])
    await reportsService.submitReport('user-1', 'prop-1', { ...critical, isAnonymous: true })
    expect(prismaMock.propertyReport.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ reporterId: null }) }),
    )
  })
})

describe('authMiddleware — blocked users lose access immediately', () => {
  const token = jwt.sign({ sub: 'user-1', email: 'a@b.c', role: 'OWNER' }, 'test-jwt-secret')
  const mkRes = () => {
    const res = { statusCode: null, body: null }
    res.status = (code) => { res.statusCode = code; return res }
    res.json = (body) => { res.body = body; return res }
    return res
  }

  it('allows an active user through and attaches req.user', async () => {
    prismaMock.user.findUnique.mockResolvedValue({ isBlocked: false })
    const req = { headers: { authorization: `Bearer ${token}` } }
    const next = vi.fn()
    await authMiddleware(req, mkRes(), next)
    expect(next).toHaveBeenCalledWith()
    expect(req.user).toEqual({ id: 'user-1', email: 'a@b.c', role: 'OWNER' })
  })

  it('rejects a blocked user holding a still-valid token', async () => {
    prismaMock.user.findUnique.mockResolvedValue({ isBlocked: true })
    const res = mkRes()
    const next = vi.fn()
    await authMiddleware({ headers: { authorization: `Bearer ${token}` } }, res, next)
    expect(res.statusCode).toBe(403)
    expect(res.body).toMatchObject({ error: 'ACCOUNT_BLOCKED' })
    expect(next).not.toHaveBeenCalled()
  })

  it('rejects a token whose user no longer exists', async () => {
    prismaMock.user.findUnique.mockResolvedValue(null)
    const res = mkRes()
    const next = vi.fn()
    await authMiddleware({ headers: { authorization: `Bearer ${token}` } }, res, next)
    expect(res.statusCode).toBe(401)
    expect(next).not.toHaveBeenCalled()
  })

  it('still rejects a forged token without hitting the DB', async () => {
    const res = mkRes()
    await authMiddleware({ headers: { authorization: 'Bearer not-a-real-token' } }, res, vi.fn())
    expect(res.statusCode).toBe(401)
    expect(prismaMock.user.findUnique).not.toHaveBeenCalled()
  })

  it('passes a DB failure to the error handler rather than letting anyone in', async () => {
    prismaMock.user.findUnique.mockRejectedValue(new Error('db down'))
    const next = vi.fn()
    const req = { headers: { authorization: `Bearer ${token}` } }
    await authMiddleware(req, mkRes(), next)
    expect(next).toHaveBeenCalledWith(expect.any(Error))
    expect(req.user).toBeUndefined()
  })
})

describe('isWithinIndia — /places/* coordinate gate', () => {
  it('accepts real Indian coordinates', () => {
    expect(isWithinIndia(12.9716, 77.5946)).toBe(true)   // Bengaluru
    expect(isWithinIndia(28.6139, 77.2090)).toBe(true)   // Delhi
  })

  it('rejects coordinates outside India — the cache-bust vector', () => {
    expect(isWithinIndia(40.7128, -74.0060)).toBe(false) // New York
    expect(isWithinIndia(0, 0)).toBe(false)              // Null Island
    expect(isWithinIndia(51.5074, -0.1278)).toBe(false)  // London
  })

  it('rejects NaN from a missing or non-numeric query param', () => {
    expect(isWithinIndia(NaN, NaN)).toBe(false)
    expect(isWithinIndia(parseFloat(undefined), parseFloat('abc'))).toBe(false)
  })

  it('rejects Infinity rather than treating it as in-range', () => {
    expect(isWithinIndia(Infinity, 77)).toBe(false)
  })
})
