// Phone verification — proving a number belongs to the person holding it.
//
// The product reason: StayOnMap's pitch is broker-free and verified, and until
// this shipped a phone number was whatever someone typed into Settings. An
// unverified number is not a trust signal, it is a text field.
//
// Shaped deliberately like auth.service.js's emailed login OTP (sha256-only
// storage, crypto.randomInt, single use, 10-minute TTL, 5-attempt cap,
// cooldown + daily cap), because the threat is the same one and that flow's
// constraints are load-bearing. Three things differ, and each is here because
// the destination is USER-SUPPLIED rather than a registered address:
//
//   1. A per-DESTINATION daily cap, not just per-user. Without it this endpoint
//      texts any number in India on demand — five accounts pointing at one
//      victim is harassment we would be paying for.
//   2. The code is bound to the number it was issued for. Change the number
//      mid-flow and the code in transit verifies nothing.
//   3. A number already verified on another account is refused. That rule is
//      the entire anti-broker value: without it one person verifies one SIM
//      across ten accounts and "verified" means nothing.
//
// This is an AUTHENTICATED flow, so none of the account-enumeration dance the
// email OTP does applies — the caller already proved who they are.
import crypto from 'crypto'
import { prisma } from '../../lib/prisma.js'
import { sendSms, canSendSms } from '../../lib/smsSender.js'
import { awardPoints } from '../points/points.service.js'

const OTP_TTL_MS = 10 * 60 * 1000
const OTP_RESEND_COOLDOWN_MS = 60 * 1000
const OTP_MAX_PER_USER_PER_DAY = 5
const OTP_MAX_PER_PHONE_PER_DAY = 5
const OTP_MAX_ATTEMPTS = 5

const hashOtp = (code) => crypto.createHash('sha256').update(code).digest('hex')

// crypto.randomInt, not Math.random — a predictable code is a free badge.
const generateOtp = () => String(crypto.randomInt(0, 1_000_000)).padStart(6, '0')

const err = (message, statusCode, expose = false) =>
  Object.assign(new Error(message), { statusCode, expose })

/**
 * Is this number already verified by somebody else? Checked at request time so
 * we don't spend an SMS on a code that could never be accepted, and again at
 * verify time because the two calls are minutes apart.
 */
async function claimedByAnother(phone, userId) {
  const owner = await prisma.user.findFirst({
    where: { phone, phoneVerifiedAt: { not: null }, id: { not: userId } },
    select: { id: true },
  })
  return Boolean(owner)
}

/** Send a 6-digit code to `phone` on behalf of the signed-in user. */
export async function requestPhoneOtp(userId, phone) {
  if (!(await canSendSms())) {
    // expose: error.middleware sanitises every 5xx in production, so without
    // this the user is told "Internal server error" for a condition that is
    // neither their fault nor a fault at all.
    throw err('Phone verification is temporarily unavailable. Please try again later.', 503, true)
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, phone: true, phoneVerifiedAt: true },
  })
  if (!user) throw err('Not found', 404)

  if (user.phone === phone && user.phoneVerifiedAt) {
    throw err('This number is already verified', 409, true)
  }
  if (await claimedByAnother(phone, userId)) {
    // Deliberately vague about WHOSE. Naming the account would turn this into
    // a lookup for "which StayOnMap user owns this number".
    throw err('This number is already verified on another account', 409, true)
  }

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000)
  const [recent, userToday, phoneToday] = await Promise.all([
    prisma.phoneOtp.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    }),
    prisma.phoneOtp.count({ where: { userId, createdAt: { gte: since } } }),
    prisma.phoneOtp.count({ where: { phone, createdAt: { gte: since } } }),
  ])

  if (recent && Date.now() - recent.createdAt.getTime() < OTP_RESEND_COOLDOWN_MS) {
    const wait = Math.ceil((OTP_RESEND_COOLDOWN_MS - (Date.now() - recent.createdAt.getTime())) / 1000)
    throw err(`Please wait ${wait}s before requesting another code`, 429, true)
  }
  if (userToday >= OTP_MAX_PER_USER_PER_DAY) {
    throw err('Too many codes requested today. Please try again tomorrow.', 429, true)
  }
  if (phoneToday >= OTP_MAX_PER_PHONE_PER_DAY) {
    // Same message as the per-user cap on purpose: the distinction between
    // "you asked too often" and "this number was asked about too often" is
    // exactly what a bomber would use to map which numbers are being targeted.
    throw err('Too many codes requested today. Please try again tomorrow.', 429, true)
  }

  const code = generateOtp()
  await prisma.phoneOtp.create({
    data: { userId, phone, codeHash: hashOtp(code), expiresAt: new Date(Date.now() + OTP_TTL_MS) },
  })

  // Awaited, and a failure is an error: if the code never arrives there is
  // nothing to type, so a silent drop would leave a code-entry screen that can
  // never succeed.
  const sent = await sendSms({ phone, code })
  if (!sent) {
    throw err('Could not send your verification code. Please try again later.', 503, true)
  }

  return { phone, expiresInMinutes: OTP_TTL_MS / 60_000 }
}

/**
 * Consume a code. On success the number becomes the user's verified phone —
 * `phone` is written here too, so verifying is what puts the number on the
 * account rather than a separate save the user could forget.
 */
export async function verifyPhoneOtp(userId, code) {
  const invalid = () => err('Invalid or expired code', 401, true)

  const otp = await prisma.phoneOtp.findFirst({
    where: { userId, consumedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: 'desc' },
  })
  if (!otp) throw invalid()

  // Per-code attempt cap: 6 digits is 1e6 combinations, trivially brute-forced
  // inside a 10-minute window without it. A burnt code forces a fresh request,
  // which the cooldown and daily caps then throttle.
  if (otp.attempts >= OTP_MAX_ATTEMPTS) throw invalid()

  if (otp.codeHash !== hashOtp(code)) {
    await prisma.phoneOtp.update({ where: { id: otp.id }, data: { attempts: { increment: 1 } } })
    throw invalid()
  }

  // Re-checked after minutes have passed: someone else may have verified this
  // number since the code went out. Burn the code either way — it has been
  // seen, and a correct code that stays reusable is a correct code that leaks.
  if (await claimedByAnother(otp.phone, userId)) {
    await prisma.phoneOtp.update({ where: { id: otp.id }, data: { consumedAt: new Date() } })
    throw err('This number is already verified on another account', 409, true)
  }

  const [, user] = await prisma.$transaction([
    prisma.phoneOtp.update({ where: { id: otp.id }, data: { consumedAt: new Date() } }),
    prisma.user.update({
      where: { id: userId },
      data: { phone: otp.phone, phoneVerifiedAt: new Date() },
    }),
  ])

  // Fire-and-forget and idempotent via the ledger's unique (userId, action, '')
  // — re-verifying after a number change never pays twice.
  awardPoints(userId, 'PHONE_VERIFIED').catch(() => {})

  return { phone: user.phone, phoneVerifiedAt: user.phoneVerifiedAt }
}
