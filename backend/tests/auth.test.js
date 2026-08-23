/**
 * Auth service tests
 *
 * What each suite guards against:
 *   registerUser   — cities outside SUPPORTED_CITIES never get a User row,
 *                    only a WaitlistEntry; duplicate email is rejected
 *   updateUserRole — role upgrade is one-way (TENANT → OWNER only): rejects
 *                    any target other than OWNER, and rejects re-upgrading
 *                    an existing OWNER
 *   verifyEmail    — only a purpose-scoped token signed with the DERIVED
 *                    secret verifies; a login JWT (same base secret) must
 *                    never work as a verification link and vice versa
 *   requestLoginOtp — the abuse surface: an unauthenticated endpoint that
 *                    spends the platform's shared ~450/day SMTP quota. Guards
 *                    that quota is pre-flighted BEFORE any account lookup (so
 *                    the failure can't enumerate accounts), that unknown
 *                    emails no-op silently, and that the per-email cooldown /
 *                    daily cap actually block
 *   verifyLoginOtp — guards that expired/consumed/wrong codes never mint a
 *                    token, that attempts are capped (6 digits is brute-
 *                    forceable without it), and that a correct code both
 *                    consumes itself and verifies the email
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import jwt from 'jsonwebtoken'
import crypto from 'crypto'
import { prismaMock } from './mocks/prisma.js'
import { sendEmail, canSend, loginOtpEmail } from '../src/services/email.service.js'

import {
  registerUser, updateUserRole, verifyEmail, requestLoginOtp, verifyLoginOtp,
} from '../src/features/auth/auth.service.js'

beforeEach(() => {
  vi.clearAllMocks()
  canSend.mockResolvedValue(true)
  sendEmail.mockResolvedValue(true)
})

describe('registerUser', () => {
  it('waitlists a signup from a city outside SUPPORTED_CITIES instead of creating a User', async () => {
    prismaMock.waitlistEntry.create.mockResolvedValue({ id: 'wait-1' })

    const result = await registerUser({ name: 'Test', email: 'test@example.com', password: 'pw', city: 'Goa' })

    expect(result).toEqual({ waitlisted: true })
    expect(prismaMock.waitlistEntry.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ city: 'Goa' }) })
    )
    expect(prismaMock.user.create).not.toHaveBeenCalled()
  })

  // Since 2026-08-24 the signup dropdown sends a STATE ("Tamil Nadu"), while
  // released mobile builds still send a city name — the gate takes either.
  it('accepts a supported STATE as the signup place', async () => {
    prismaMock.user.findUnique.mockResolvedValue(null)
    prismaMock.user.create.mockResolvedValue({ id: 'user-1', email: 'test@example.com', role: 'TENANT', city: 'Tamil Nadu' })

    const result = await registerUser({ name: 'Test', email: 'test@example.com', password: 'pw', city: 'Tamil Nadu' })

    expect(result.waitlisted).toBeUndefined()
    expect(prismaMock.user.create).toHaveBeenCalled()
    expect(prismaMock.waitlistEntry.create).not.toHaveBeenCalled()
  })

  it('still waitlists an unsupported STATE', async () => {
    prismaMock.waitlistEntry.create.mockResolvedValue({ id: 'wait-1' })

    const result = await registerUser({ name: 'Test', email: 'test@example.com', password: 'pw', city: 'Kerala' })

    expect(result).toEqual({ waitlisted: true })
    expect(prismaMock.user.create).not.toHaveBeenCalled()
  })

  it('throws 409 when the email is already registered in a supported city', async () => {
    prismaMock.user.findUnique.mockResolvedValue({ id: 'user-1', email: 'test@example.com' })

    await expect(
      registerUser({ name: 'Test', email: 'test@example.com', password: 'pw', city: 'Chennai' })
    ).rejects.toMatchObject({ statusCode: 409 })
  })

  it('creates a TENANT by default for a supported city', async () => {
    prismaMock.user.findUnique.mockResolvedValue(null)
    prismaMock.user.create.mockResolvedValue({
      id: 'user-1', email: 'test@example.com', name: 'Test', city: 'Chennai', role: 'TENANT', passwordHash: 'hashed',
    })

    const result = await registerUser({ name: 'Test', email: 'test@example.com', password: 'pw', city: 'Chennai' })

    expect(result.user.role).toBe('TENANT')
    expect(result.user.passwordHash).toBeUndefined() // never leak the hash to the caller
    expect(result.token).toBeTypeOf('string')
  })
})

describe('updateUserRole', () => {
  it('rejects any target role other than OWNER', async () => {
    await expect(updateUserRole('user-1', 'TENANT')).rejects.toMatchObject({ statusCode: 400 })
    expect(prismaMock.user.findUnique).not.toHaveBeenCalled()
  })

  it('throws 404 when the user does not exist', async () => {
    prismaMock.user.findUnique.mockResolvedValue(null)

    await expect(updateUserRole('user-1', 'OWNER')).rejects.toMatchObject({ statusCode: 404 })
  })

  it('throws 400 when the user is already an OWNER (no re-upgrade)', async () => {
    prismaMock.user.findUnique.mockResolvedValue({ role: 'OWNER' })

    await expect(updateUserRole('user-1', 'OWNER')).rejects.toMatchObject({ statusCode: 400 })
    expect(prismaMock.user.update).not.toHaveBeenCalled()
  })

  it('upgrades a TENANT to OWNER', async () => {
    prismaMock.user.findUnique.mockResolvedValue({ role: 'TENANT' })
    prismaMock.user.update.mockResolvedValue({ id: 'user-1', role: 'OWNER', passwordHash: 'hashed' })

    const result = await updateUserRole('user-1', 'OWNER')

    expect(result.role).toBe('OWNER')
    expect(result.passwordHash).toBeUndefined()
  })
})

describe('verifyEmail', () => {
  // Must match auth.service.js's derived secret and the env mock's jwtSecret
  const VERIFY_SECRET = 'test-jwt-secret:email-verify'

  it('sets isVerified for a valid verification token', async () => {
    prismaMock.user.updateMany.mockResolvedValue({ count: 1 })
    const token = jwt.sign({ sub: 'user-1', purpose: 'email_verify' }, VERIFY_SECRET, { expiresIn: '24h' })

    await expect(verifyEmail(token)).resolves.toBeUndefined()
    expect(prismaMock.user.updateMany).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: { isVerified: true },
    })
  })

  it('rejects a login JWT (signed with the base secret) as a verification link', async () => {
    const loginToken = jwt.sign({ sub: 'user-1', email: 'a@b.c', role: 'TENANT' }, 'test-jwt-secret', { expiresIn: '7d' })

    await expect(verifyEmail(loginToken)).rejects.toMatchObject({ statusCode: 400 })
    expect(prismaMock.user.updateMany).not.toHaveBeenCalled()
  })

  it('rejects a correctly-signed token with the wrong purpose claim', async () => {
    const token = jwt.sign({ sub: 'user-1', purpose: 'password_reset' }, VERIFY_SECRET, { expiresIn: '24h' })

    await expect(verifyEmail(token)).rejects.toMatchObject({ statusCode: 400 })
    expect(prismaMock.user.updateMany).not.toHaveBeenCalled()
  })

  it('rejects garbage and expired tokens', async () => {
    await expect(verifyEmail('not-a-token')).rejects.toMatchObject({ statusCode: 400 })

    const expired = jwt.sign({ sub: 'user-1', purpose: 'email_verify' }, VERIFY_SECRET, { expiresIn: '-1s' })
    await expect(verifyEmail(expired)).rejects.toMatchObject({ statusCode: 400 })
  })

  it('rejects a valid token whose user no longer exists', async () => {
    prismaMock.user.updateMany.mockResolvedValue({ count: 0 })
    const token = jwt.sign({ sub: 'ghost', purpose: 'email_verify' }, VERIFY_SECRET, { expiresIn: '24h' })

    await expect(verifyEmail(token)).rejects.toMatchObject({ statusCode: 400 })
  })
})

// ── Passwordless OTP login ──────────────────────────────────────────────────
const USER = { id: 'user-1', email: 'a@b.c', name: 'Test', isBlocked: false }
const hash = (code) => crypto.createHash('sha256').update(code).digest('hex')
const future = () => new Date(Date.now() + 10 * 60 * 1000)

// No prior OTP, none today — the default "clean slate" for a first request.
function noPriorOtps() {
  prismaMock.emailOtp.findFirst.mockResolvedValue(null)
  prismaMock.emailOtp.count.mockResolvedValue(0)
}

describe('requestLoginOtp', () => {
  it('rejects with 503 when the SMTP quota is exhausted, WITHOUT looking up the account', async () => {
    // The lookup order is the whole point: checking quota after the user
    // lookup would make 503-vs-200 an account-enumeration oracle.
    canSend.mockResolvedValue(false)

    await expect(requestLoginOtp('a@b.c')).rejects.toMatchObject({ statusCode: 503 })
    expect(prismaMock.user.findUnique).not.toHaveBeenCalled()
    expect(sendEmail).not.toHaveBeenCalled()
  })

  it('no-ops silently for an unregistered email (never leaks account existence)', async () => {
    prismaMock.user.findUnique.mockResolvedValue(null)

    await expect(requestLoginOtp('nobody@b.c')).resolves.toBeUndefined()
    expect(prismaMock.emailOtp.create).not.toHaveBeenCalled()
    expect(sendEmail).not.toHaveBeenCalled()
  })

  it('no-ops silently for a blocked account without spending quota', async () => {
    prismaMock.user.findUnique.mockResolvedValue({ ...USER, isBlocked: true })

    await expect(requestLoginOtp('a@b.c')).resolves.toBeUndefined()
    expect(sendEmail).not.toHaveBeenCalled()
  })

  it('emails a 6-digit code but persists only its hash', async () => {
    prismaMock.user.findUnique.mockResolvedValue(USER)
    noPriorOtps()
    prismaMock.emailOtp.create.mockResolvedValue({ id: 'otp-1' })

    await requestLoginOtp('a@b.c')

    // The plaintext code reaches the template and nothing else; what lands in
    // the DB is its sha256, so a DB read can never yield a usable code.
    const { code } = loginOtpEmail.mock.calls[0][0]
    const stored = prismaMock.emailOtp.create.mock.calls[0][0].data
    expect(code).toMatch(/^\d{6}$/)
    expect(stored).not.toHaveProperty('code')
    expect(stored.codeHash).toBe(hash(code))
    expect(stored.codeHash).not.toContain(code)
    expect(sendEmail.mock.calls[0][0].critical).toBe(true) // a dropped OTP is a failed login, not a missed notification
  })

  it('generates a different code each request', async () => {
    prismaMock.user.findUnique.mockResolvedValue(USER)
    noPriorOtps()
    prismaMock.emailOtp.create.mockResolvedValue({ id: 'otp-1' })

    await requestLoginOtp('a@b.c')
    await requestLoginOtp('a@b.c')

    // Guards against a predictable-code regression (e.g. a switch to a seeded
    // or time-derived generator), which would be a straight login bypass.
    const [first, second] = loginOtpEmail.mock.calls.map((c) => c[0].code)
    expect(first).not.toBe(second)
  })

  it('blocks a resend inside the 60s cooldown', async () => {
    prismaMock.user.findUnique.mockResolvedValue(USER)
    prismaMock.emailOtp.findFirst.mockResolvedValue({ createdAt: new Date(Date.now() - 5_000) })
    prismaMock.emailOtp.count.mockResolvedValue(1)

    await expect(requestLoginOtp('a@b.c')).rejects.toMatchObject({ statusCode: 429 })
    expect(sendEmail).not.toHaveBeenCalled()
  })

  it('blocks once the per-email daily cap is reached', async () => {
    prismaMock.user.findUnique.mockResolvedValue(USER)
    prismaMock.emailOtp.findFirst.mockResolvedValue({ createdAt: new Date(Date.now() - 10 * 60 * 1000) })
    prismaMock.emailOtp.count.mockResolvedValue(5)

    await expect(requestLoginOtp('a@b.c')).rejects.toMatchObject({ statusCode: 429 })
    expect(sendEmail).not.toHaveBeenCalled()
  })

  it('surfaces a failed send as 503 instead of leaving the user on a dead code screen', async () => {
    prismaMock.user.findUnique.mockResolvedValue(USER)
    noPriorOtps()
    prismaMock.emailOtp.create.mockResolvedValue({ id: 'otp-1' })
    sendEmail.mockResolvedValue(false) // mailer never throws — it returns false

    await expect(requestLoginOtp('a@b.c')).rejects.toMatchObject({ statusCode: 503 })
  })
})

describe('verifyLoginOtp', () => {
  it('rejects when no unconsumed, unexpired code exists', async () => {
    prismaMock.user.findUnique.mockResolvedValue(USER)
    prismaMock.emailOtp.findFirst.mockResolvedValue(null)

    await expect(verifyLoginOtp('a@b.c', '123456')).rejects.toMatchObject({ statusCode: 401 })
  })

  it('only ever selects a code that is unconsumed and unexpired', async () => {
    prismaMock.user.findUnique.mockResolvedValue(USER)
    prismaMock.emailOtp.findFirst.mockResolvedValue(null)

    await expect(verifyLoginOtp('a@b.c', '123456')).rejects.toMatchObject({ statusCode: 401 })
    expect(prismaMock.emailOtp.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ userId: 'user-1', consumedAt: null, expiresAt: expect.objectContaining({ gt: expect.any(Date) }) }),
      })
    )
  })

  it('increments attempts on a wrong code without minting a token', async () => {
    prismaMock.user.findUnique.mockResolvedValue(USER)
    prismaMock.emailOtp.findFirst.mockResolvedValue({ id: 'otp-1', codeHash: hash('111111'), attempts: 0, expiresAt: future() })

    await expect(verifyLoginOtp('a@b.c', '999999')).rejects.toMatchObject({ statusCode: 401 })
    expect(prismaMock.emailOtp.update).toHaveBeenCalledWith({
      where: { id: 'otp-1' },
      data: { attempts: { increment: 1 } },
    })
    expect(prismaMock.$transaction).not.toHaveBeenCalled()
  })

  it('refuses a burnt code even when the digits are correct', async () => {
    // Without the attempt cap, 6 digits (1e6 combos) is brute-forceable inside
    // the 10-minute TTL.
    prismaMock.user.findUnique.mockResolvedValue(USER)
    prismaMock.emailOtp.findFirst.mockResolvedValue({ id: 'otp-1', codeHash: hash('111111'), attempts: 5, expiresAt: future() })

    await expect(verifyLoginOtp('a@b.c', '111111')).rejects.toMatchObject({ statusCode: 401 })
    expect(prismaMock.$transaction).not.toHaveBeenCalled()
  })

  it('rejects a blocked account only AFTER the code is proven correct', async () => {
    // Ordering matters: a 403 returned before the code check would let an
    // attacker probe which emails belong to blocked accounts.
    prismaMock.user.findUnique.mockResolvedValue({ ...USER, isBlocked: true, passwordHash: 'h' })
    prismaMock.emailOtp.findFirst.mockResolvedValue({ id: 'otp-1', codeHash: hash('111111'), attempts: 0, expiresAt: future() })

    await expect(verifyLoginOtp('a@b.c', '999999')).rejects.toMatchObject({ statusCode: 401 }) // wrong code -> generic
    await expect(verifyLoginOtp('a@b.c', '111111')).rejects.toMatchObject({ statusCode: 403 }) // right code -> blocked
  })

  it('consumes the code, verifies the email, and returns a token', async () => {
    prismaMock.user.findUnique.mockResolvedValue({ ...USER, passwordHash: 'hashed', role: 'TENANT' })
    prismaMock.emailOtp.findFirst.mockResolvedValue({ id: 'otp-1', codeHash: hash('111111'), attempts: 0, expiresAt: future() })
    prismaMock.emailOtp.update.mockResolvedValue({ id: 'otp-1' })
    prismaMock.user.update.mockResolvedValue({ ...USER, isVerified: true, role: 'TENANT', passwordHash: 'hashed' })

    const result = await verifyLoginOtp('a@b.c', '111111')

    expect(result.token).toBeTypeOf('string')
    expect(result.user.isVerified).toBe(true) // receiving the code proves inbox control
    expect(result.user.passwordHash).toBeUndefined()
    // Consume + verify must be atomic — a consumed code with an unverified
    // user (or vice versa) is a torn write.
    expect(prismaMock.$transaction).toHaveBeenCalled()
  })
})
