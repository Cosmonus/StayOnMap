// Signing in with a phone number.
//
// Almost every test here is about a REFUSAL, because this flow mints a session
// from an unauthenticated request and the ways that goes wrong are all quiet
// ones. The single most important assertion in the file is the first: a number
// that was merely TYPED into a profile cannot receive a sign-in code.
import { describe, it, expect, beforeEach, vi } from 'vitest'
import crypto from 'crypto'
import { prismaMock } from './mocks/prisma.js'

const sendSms = vi.fn().mockResolvedValue(true)
const canSendSms = vi.fn().mockResolvedValue(true)
const smsConfigured = vi.fn().mockReturnValue(true)
vi.mock('../src/lib/smsSender.js', () => ({
  sendSms: (...a) => sendSms(...a),
  canSendSms: (...a) => canSendSms(...a),
  smsConfigured: (...a) => smsConfigured(...a),
  smsStatus: vi.fn(),
}))
vi.mock('../src/features/auth/session.service.js', () => ({
  issueSession: vi.fn().mockResolvedValue('refresh-token'),
  revokeAllSessions: vi.fn(),
}))

const { requestPhoneLoginOtp, verifyPhoneLoginOtp } = await import('../src/features/auth/phone.service.js')

const PHONE = '9876500002'
const hash = (c) => crypto.createHash('sha256').update(c).digest('hex')

const verifiedUser = (over = {}) => ({
  id: 'u1', phone: PHONE, phoneVerifiedAt: new Date(), isBlocked: false, email: 'a@b.c', name: 'Asha', ...over,
})
const liveOtp = (over = {}) => ({
  id: 'otp1', userId: 'u1', phone: PHONE, codeHash: hash('123456'),
  expiresAt: new Date(Date.now() + 60_000), consumedAt: null, attempts: 0, createdAt: new Date(), ...over,
})

beforeEach(() => {
  sendSms.mockClear().mockResolvedValue(true)
  canSendSms.mockClear().mockResolvedValue(true)
  smsConfigured.mockClear().mockReturnValue(true)
  // mockClear, not just mockResolvedValue. prismaMock is a module-level object
  // shared by the whole suite, so call HISTORY survives between tests even when
  // the return value is reset — which made "was never called" assertions see
  // four calls from earlier tests, and calls[0] belong to a different one.
  for (const fn of [
    prismaMock.user.findFirst, prismaMock.user.findUnique, prismaMock.user.update,
    prismaMock.phoneOtp.findFirst, prismaMock.phoneOtp.count,
    prismaMock.phoneOtp.create, prismaMock.phoneOtp.update,
  ]) fn.mockClear()

  prismaMock.user.findFirst.mockResolvedValue(null)
  prismaMock.user.findUnique.mockResolvedValue(verifiedUser())
  prismaMock.phoneOtp.findFirst.mockResolvedValue(null)
  prismaMock.phoneOtp.count.mockResolvedValue(0)
  prismaMock.phoneOtp.create.mockResolvedValue({})
  prismaMock.phoneOtp.update.mockResolvedValue({})
})

describe('only a VERIFIED number can sign in', () => {
  it('looks the account up by phone AND phoneVerifiedAt, never phone alone', async () => {
    // User.phone is free text and is NOT unique — anyone can type your number
    // into their own profile. phoneVerifiedAt is the only field here that is
    // evidence of anything, and without it in the WHERE clause a stranger who
    // typed your number would receive your sign-in codes.
    prismaMock.user.findFirst.mockResolvedValue(verifiedUser())
    await requestPhoneLoginOtp(PHONE)

    const where = prismaMock.user.findFirst.mock.calls[0][0].where
    expect(where.phone).toBe(PHONE)
    expect(where.phoneVerifiedAt).toEqual({ not: null })
  })

  it('sends nothing when the number is on an account but unverified', async () => {
    // findFirst with the verified filter returns nothing for such a row.
    prismaMock.user.findFirst.mockResolvedValue(null)
    await expect(requestPhoneLoginOtp(PHONE)).resolves.toBeUndefined()
    expect(sendSms).not.toHaveBeenCalled()
  })
})

describe('no enumeration', () => {
  it('resolves silently for a number with no account', async () => {
    prismaMock.user.findFirst.mockResolvedValue(null)
    await expect(requestPhoneLoginOtp('9999999999')).resolves.toBeUndefined()
    expect(sendSms).not.toHaveBeenCalled()
  })

  it('resolves silently for a blocked account, spending no SMS', async () => {
    prismaMock.user.findFirst.mockResolvedValue(verifiedUser({ isBlocked: true }))
    await expect(requestPhoneLoginOtp(PHONE)).resolves.toBeUndefined()
    expect(sendSms).not.toHaveBeenCalled()
  })

  it('checks the SMS quota BEFORE the account lookup', async () => {
    // Order is the point. After the lookup, 503-vs-200 tells a caller whether
    // the number is registered — the exact oracle the silent no-op prevents.
    canSendSms.mockResolvedValue(false)
    await expect(requestPhoneLoginOtp(PHONE)).rejects.toMatchObject({ statusCode: 503 })
    expect(prismaMock.user.findFirst).not.toHaveBeenCalled()
  })

  it('refuses up front when no SMS provider is configured', async () => {
    smsConfigured.mockReturnValue(false)
    await expect(requestPhoneLoginOtp(PHONE)).rejects.toMatchObject({ statusCode: 503 })
    expect(prismaMock.user.findFirst).not.toHaveBeenCalled()
  })
})

describe('throttling', () => {
  it('enforces the resend cooldown', async () => {
    prismaMock.user.findFirst.mockResolvedValue(verifiedUser())
    prismaMock.phoneOtp.findFirst.mockResolvedValue({ createdAt: new Date() })
    await expect(requestPhoneLoginOtp(PHONE)).rejects.toMatchObject({ statusCode: 429 })
    expect(sendSms).not.toHaveBeenCalled()
  })

  it('caps per DESTINATION as well as per account, with one shared message', async () => {
    // Two different caps, deliberately indistinguishable: a different message
    // would say whether the number belongs to the account being throttled.
    prismaMock.user.findFirst.mockResolvedValue(verifiedUser())
    prismaMock.phoneOtp.count.mockResolvedValueOnce(0).mockResolvedValueOnce(99)
    const perPhone = await requestPhoneLoginOtp(PHONE).catch((e) => e)

    prismaMock.phoneOtp.count.mockReset().mockResolvedValueOnce(99).mockResolvedValueOnce(0)
    const perUser = await requestPhoneLoginOtp(PHONE).catch((e) => e)

    expect(perPhone.statusCode).toBe(429)
    expect(perUser.message).toBe(perPhone.message)
  })
})

describe('verifying', () => {
  it('returns the same token/refreshToken/user triple as every other login', async () => {
    prismaMock.user.findFirst.mockResolvedValue(verifiedUser())
    prismaMock.phoneOtp.findFirst.mockResolvedValue(liveOtp())

    const out = await verifyPhoneLoginOtp(PHONE, '123456')
    expect(out.token).toBeTruthy()
    expect(out.refreshToken).toBe('refresh-token')
    expect(out.user.id).toBe('u1')
    // A client must need no special case for signing in by SMS.
    expect(out.user).not.toHaveProperty('passwordHash')
  })

  it('matches the code on the NUMBER too, not just the account', async () => {
    // PhoneOtp is shared with the authenticated verification flow, where a
    // row's `phone` is a number being ADDED rather than one already held.
    // Without this, the two uses could consume each other's codes.
    prismaMock.user.findFirst.mockResolvedValue(verifiedUser())
    prismaMock.phoneOtp.findFirst.mockResolvedValue(liveOtp())
    await verifyPhoneLoginOtp(PHONE, '123456')

    expect(prismaMock.phoneOtp.findFirst.mock.calls[0][0].where).toMatchObject({ userId: 'u1', phone: PHONE })
  })

  it('rejects a wrong code and counts the attempt', async () => {
    prismaMock.user.findFirst.mockResolvedValue(verifiedUser())
    prismaMock.phoneOtp.findFirst.mockResolvedValue(liveOtp())
    await expect(verifyPhoneLoginOtp(PHONE, '000000')).rejects.toMatchObject({ statusCode: 401 })
    expect(prismaMock.phoneOtp.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { attempts: { increment: 1 } } }),
    )
  })

  it('refuses a code that has been guessed at too many times', async () => {
    // Six digits is 1e6 combinations — brute-forceable inside ten minutes
    // without this.
    prismaMock.user.findFirst.mockResolvedValue(verifiedUser())
    prismaMock.phoneOtp.findFirst.mockResolvedValue(liveOtp({ attempts: 5 }))
    await expect(verifyPhoneLoginOtp(PHONE, '123456')).rejects.toMatchObject({ statusCode: 401 })
  })

  it('gives the same 401 for an unknown number as for a wrong code', async () => {
    prismaMock.user.findFirst.mockResolvedValue(null)
    await expect(verifyPhoneLoginOtp('9999999999', '123456')).rejects.toMatchObject({ statusCode: 401 })
  })

  it('rejects a blocked account only AFTER the code is proven', async () => {
    // A 403 reachable with a wrong code would probe which numbers are blocked.
    prismaMock.user.findFirst.mockResolvedValue(verifiedUser({ isBlocked: true }))
    prismaMock.phoneOtp.findFirst.mockResolvedValue(liveOtp())

    await expect(verifyPhoneLoginOtp(PHONE, '000000')).rejects.toMatchObject({ statusCode: 401 })
    await expect(verifyPhoneLoginOtp(PHONE, '123456')).rejects.toMatchObject({ statusCode: 403 })
  })

  it('consumes the code, so it cannot be replayed', async () => {
    prismaMock.user.findFirst.mockResolvedValue(verifiedUser())
    prismaMock.phoneOtp.findFirst.mockResolvedValue(liveOtp())
    await verifyPhoneLoginOtp(PHONE, '123456')
    expect(prismaMock.phoneOtp.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { consumedAt: expect.any(Date) } }),
    )
  })

  it('grants nothing — the number was already verified before a code could be sent', async () => {
    // The EMAIL code sets isVerified, because receiving it proves inbox
    // control. Here there is no new fact, and no points to pay twice.
    prismaMock.user.findFirst.mockResolvedValue(verifiedUser())
    prismaMock.phoneOtp.findFirst.mockResolvedValue(liveOtp())
    await verifyPhoneLoginOtp(PHONE, '123456')
    expect(prismaMock.user.update).not.toHaveBeenCalled()
  })
})
