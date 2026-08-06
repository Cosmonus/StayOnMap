/**
 * Phone verification — 2026-08-07
 *
 * The three properties that make this a trust signal rather than a text field,
 * each of which is a way the feature silently becomes worthless if it breaks:
 *
 *   1. The code proves control of the number it was ISSUED for. Bind it to
 *      anything else and a user verifies number A and lands number B.
 *   2. One number, one verified account. Without that, one SIM verifies ten
 *      broker accounts and the badge means nothing — which is the exact abuse
 *      the "broker-free + verified" pitch is about.
 *   3. Editing the phone drops the verification. A badge that outlives the
 *      number that earned it is a lie the user does not even have to intend.
 *
 * Plus the abuse surface the emailed OTP does not have: the destination here
 * is user-supplied, so this endpoint can text a stranger. The per-destination
 * daily cap is the thing standing between us and paying to harass someone.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { prismaMock } from './mocks/prisma.js'

const sendSms = vi.fn().mockResolvedValue(true)
const canSendSms = vi.fn().mockResolvedValue(true)
vi.mock('../src/lib/smsSender.js', () => ({
  sendSms: (...a) => sendSms(...a),
  canSendSms: (...a) => canSendSms(...a),
  smsConfigured: () => true,
}))

const awardPoints = vi.fn().mockResolvedValue(null)
vi.mock('../src/features/points/points.service.js', () => ({
  awardPoints: (...a) => awardPoints(...a),
}))

const { requestPhoneOtp, verifyPhoneOtp } = await import('../src/features/auth/phone.service.js')

const USER = 'user_1'
const PHONE = '9876543210'

// The code the service generated, recovered from the row it wrote — the plain
// text never leaves the service, which is the point of storing only a hash.
function issuedCode() {
  return sendSms.mock.calls.at(-1)[0].code
}

beforeEach(() => {
  vi.clearAllMocks()
  sendSms.mockResolvedValue(true)
  canSendSms.mockResolvedValue(true)
  prismaMock.user.findUnique.mockResolvedValue({ id: USER, phone: null, phoneVerifiedAt: null })
  prismaMock.user.findFirst.mockResolvedValue(null)
  prismaMock.user.update.mockImplementation(({ data }) =>
    Promise.resolve({ id: USER, phone: data.phone ?? PHONE, phoneVerifiedAt: data.phoneVerifiedAt ?? null }))
  prismaMock.phoneOtp.create.mockResolvedValue({})
  prismaMock.phoneOtp.findFirst.mockResolvedValue(null)
  prismaMock.phoneOtp.count.mockResolvedValue(0)
  prismaMock.phoneOtp.update.mockResolvedValue({})
})

/** Drive a full request→verify round trip and hand back the stored row. */
async function requestAndCapture(phone = PHONE) {
  await requestPhoneOtp(USER, phone)
  return prismaMock.phoneOtp.create.mock.calls.at(-1)[0].data
}

describe('requesting a code', () => {
  it('sends to the requested number and stores only a hash of the code', async () => {
    const row = await requestAndCapture()

    expect(sendSms).toHaveBeenCalledWith({ phone: PHONE, code: expect.stringMatching(/^\d{6}$/) })
    expect(row.phone).toBe(PHONE)
    expect(row.codeHash).toMatch(/^[a-f0-9]{64}$/)
    // The plain code must exist nowhere in the row — a stored code is a code
    // a database read hands over.
    expect(JSON.stringify(row)).not.toContain(issuedCode())
  })

  it('checks SMS quota BEFORE issuing a code it cannot deliver', async () => {
    canSendSms.mockResolvedValue(false)

    await expect(requestPhoneOtp(USER, PHONE)).rejects.toMatchObject({ statusCode: 503 })
    expect(prismaMock.phoneOtp.create).not.toHaveBeenCalled()
  })

  it('surfaces a failed send as an error, not a code screen that can never work', async () => {
    sendSms.mockResolvedValue(false)
    await expect(requestPhoneOtp(USER, PHONE)).rejects.toMatchObject({ statusCode: 503, expose: true })
  })

  it('refuses a number already verified on another account', async () => {
    prismaMock.user.findFirst.mockResolvedValue({ id: 'someone_else' })

    await expect(requestPhoneOtp(USER, PHONE)).rejects.toMatchObject({ statusCode: 409 })
    expect(sendSms).not.toHaveBeenCalled()
  })

  it('refuses a number this account has already verified', async () => {
    prismaMock.user.findUnique.mockResolvedValue({ id: USER, phone: PHONE, phoneVerifiedAt: new Date() })
    await expect(requestPhoneOtp(USER, PHONE)).rejects.toMatchObject({ statusCode: 409 })
  })
})

describe('throttling', () => {
  it('holds a resend for 60s', async () => {
    prismaMock.phoneOtp.findFirst.mockResolvedValue({ createdAt: new Date(Date.now() - 10_000) })
    await expect(requestPhoneOtp(USER, PHONE)).rejects.toMatchObject({ statusCode: 429 })
  })

  it('lets a resend through once the cooldown has passed', async () => {
    prismaMock.phoneOtp.findFirst.mockResolvedValue({ createdAt: new Date(Date.now() - 61_000) })
    await expect(requestPhoneOtp(USER, PHONE)).resolves.toMatchObject({ phone: PHONE })
  })

  it('caps one account at 5 codes a day', async () => {
    // count() is called for the user first, then the phone — both read 5 here,
    // so this asserts the cap fires, not which one fired.
    prismaMock.phoneOtp.count.mockResolvedValue(5)
    await expect(requestPhoneOtp(USER, PHONE)).rejects.toMatchObject({ statusCode: 429 })
  })

  it('caps one DESTINATION at 5 codes a day across accounts', async () => {
    // This account has sent nothing; the number has been texted 5 times today
    // by others. Without this cap, N accounts × 5 = an SMS bomb we pay for.
    prismaMock.phoneOtp.count
      .mockResolvedValueOnce(0)   // this user today
      .mockResolvedValueOnce(5)   // this number today, all accounts

    await expect(requestPhoneOtp(USER, PHONE)).rejects.toMatchObject({ statusCode: 429 })
    expect(sendSms).not.toHaveBeenCalled()
  })

  it('gives the same message for both caps, so it cannot map who is being targeted', async () => {
    prismaMock.phoneOtp.count.mockResolvedValue(5)
    const userCap = await requestPhoneOtp(USER, PHONE).catch((e) => e.message)

    vi.clearAllMocks()
    prismaMock.phoneOtp.count.mockResolvedValueOnce(0).mockResolvedValueOnce(5)
    prismaMock.phoneOtp.findFirst.mockResolvedValue(null)
    prismaMock.user.findUnique.mockResolvedValue({ id: USER, phone: null, phoneVerifiedAt: null })
    const phoneCap = await requestPhoneOtp(USER, PHONE).catch((e) => e.message)

    expect(userCap).toBe(phoneCap)
  })
})

describe('verifying a code', () => {
  it('verifies the number the code was issued for and stamps it', async () => {
    const row = await requestAndCapture()
    prismaMock.phoneOtp.findFirst.mockResolvedValue({ id: 'otp_1', ...row, attempts: 0 })

    const result = await verifyPhoneOtp(USER, issuedCode())

    expect(result.phone).toBe(PHONE)
    const written = prismaMock.user.update.mock.calls.at(-1)[0].data
    expect(written.phone).toBe(PHONE)
    expect(written.phoneVerifiedAt).toBeInstanceOf(Date)
  })

  it('verifies the number from the CODE, never a number supplied later', async () => {
    // Requested for PHONE, then the account's `phone` field says something
    // else. The code proves control of PHONE and nothing else.
    const row = await requestAndCapture()
    prismaMock.user.findUnique.mockResolvedValue({ id: USER, phone: '9000000000', phoneVerifiedAt: null })
    prismaMock.phoneOtp.findFirst.mockResolvedValue({ id: 'otp_1', ...row, attempts: 0 })

    await verifyPhoneOtp(USER, issuedCode())

    expect(prismaMock.user.update.mock.calls.at(-1)[0].data.phone).toBe(PHONE)
  })

  it('rejects a wrong code and burns an attempt', async () => {
    const row = await requestAndCapture()
    prismaMock.phoneOtp.findFirst.mockResolvedValue({ id: 'otp_1', ...row, attempts: 0 })

    await expect(verifyPhoneOtp(USER, '000000')).rejects.toMatchObject({ statusCode: 401 })
    expect(prismaMock.phoneOtp.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { attempts: { increment: 1 } } })
    )
  })

  it('stops at 5 attempts — 6 digits is brute-forceable inside the TTL', async () => {
    const row = await requestAndCapture()
    prismaMock.phoneOtp.findFirst.mockResolvedValue({ id: 'otp_1', ...row, attempts: 5 })

    // Even the CORRECT code fails once the cap is reached.
    await expect(verifyPhoneOtp(USER, issuedCode())).rejects.toMatchObject({ statusCode: 401 })
    expect(prismaMock.user.update).not.toHaveBeenCalled()
  })

  it('rejects when there is no live code (expired or already consumed)', async () => {
    prismaMock.phoneOtp.findFirst.mockResolvedValue(null)
    await expect(verifyPhoneOtp(USER, '123456')).rejects.toMatchObject({ statusCode: 401 })
  })

  it('burns a correct code that lost the race to another account', async () => {
    const row = await requestAndCapture()
    prismaMock.phoneOtp.findFirst.mockResolvedValue({ id: 'otp_1', ...row, attempts: 0 })
    prismaMock.user.findFirst.mockResolvedValue({ id: 'someone_else' })

    await expect(verifyPhoneOtp(USER, issuedCode())).rejects.toMatchObject({ statusCode: 409 })
    // Consumed anyway: a correct code that has been seen must not stay usable.
    expect(prismaMock.phoneOtp.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { consumedAt: expect.any(Date) } })
    )
    expect(prismaMock.user.update).not.toHaveBeenCalled()
  })

  it('awards PHONE_VERIFIED once the number is proven, never before', async () => {
    const row = await requestAndCapture()
    expect(awardPoints).not.toHaveBeenCalled()

    prismaMock.phoneOtp.findFirst.mockResolvedValue({ id: 'otp_1', ...row, attempts: 0 })
    await verifyPhoneOtp(USER, issuedCode())

    expect(awardPoints).toHaveBeenCalledWith(USER, 'PHONE_VERIFIED')
  })
})
