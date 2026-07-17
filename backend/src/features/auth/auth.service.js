import crypto from 'crypto'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { prisma } from '../../lib/prisma.js'
import { env } from '../../config/env.js'
import { generateUserDisplayId } from '../../utils/idGenerator.js'
import { sendEmail, canSend, passwordResetEmail, emailVerificationEmail, loginOtpEmail } from '../../services/email.service.js'
import { SUPPORTED_CITIES } from '../../config/cities.js'

function signUserToken(user) {
  return jwt.sign(
    { sub: user.id, email: user.email, role: user.role },
    env.jwtSecret,
    { expiresIn: env.jwtExpiresIn }
  )
}

function stripPasswordHash(user) {
  const { passwordHash: _passwordHash, ...rest } = user
  return rest
}

export async function registerUser({ name, email, password, city, role }) {
  // Cities outside SUPPORTED_CITIES never get a real account — captured on
  // the waitlist instead, so there's nothing for them to log into later.
  if (!SUPPORTED_CITIES.includes(city)) {
    await prisma.waitlistEntry.create({ data: { name, email, city } })
    return { waitlisted: true }
  }

  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) throw Object.assign(new Error('An account with this email already exists'), { statusCode: 409 })

  const passwordHash = await bcrypt.hash(password, 12)
  const user = await prisma.user.create({
    data: {
      displayId: generateUserDisplayId(name, email),
      email,
      name,
      city,
      passwordHash,
      role: role ?? 'TENANT',
    },
  })

  sendVerificationEmailTo(user) // non-blocking — user can browse unverified

  return { token: signUserToken(user), user: stripPasswordHash(user) }
}

export async function loginUser(email, password) {
  const user = await prisma.user.findUnique({ where: { email } })
  if (!user) throw Object.assign(new Error('Invalid email or password'), { statusCode: 401 })

  const valid = await bcrypt.compare(password, user.passwordHash)
  if (!valid) throw Object.assign(new Error('Invalid email or password'), { statusCode: 401 })

  if (user.isBlocked) throw Object.assign(new Error('This account has been blocked'), { statusCode: 403 })

  return { token: signUserToken(user), user: stripPasswordHash(user) }
}

export async function getUserById(id) {
  const user = await prisma.user.findUnique({ where: { id } })
  if (!user) return null

  // Auto-upgrade: if role is TENANT but they own properties, fix the inconsistency
  if (user.role === 'TENANT') {
    const hasListings = await prisma.property.count({ where: { ownerId: id } })
    if (hasListings > 0) {
      return stripPasswordHash(await prisma.user.update({ where: { id }, data: { role: 'OWNER' } }))
    }
  }

  return stripPasswordHash(user)
}

export async function updateUserRole(id, role) {
  if (role !== 'OWNER') throw Object.assign(new Error('Can only upgrade to OWNER'), { statusCode: 400 })
  const user = await prisma.user.findUnique({ where: { id }, select: { role: true } })
  if (!user) throw Object.assign(new Error('User not found'), { statusCode: 404 })
  if (user.role === 'OWNER') throw Object.assign(new Error('Already an owner'), { statusCode: 400 })
  return stripPasswordHash(await prisma.user.update({ where: { id }, data: { role: 'OWNER' } }))
}

// Stub upgrade — no payment gateway yet (see roadmap.md P3.2/P3.3), just flips
// the flag immediately so PG/COMMERCIAL/SHORT_STAY listing creation unlocks.
export async function upgradeToBusiness(id) {
  const user = await prisma.user.findUnique({ where: { id }, select: { isBusiness: true } })
  if (!user) throw Object.assign(new Error('User not found'), { statusCode: 404 })
  if (user.isBusiness) throw Object.assign(new Error('Already a Business account'), { statusCode: 400 })
  return stripPasswordHash(await prisma.user.update({ where: { id }, data: { isBusiness: true, businessSince: new Date() } }))
}

const RESET_TOKEN_TTL_MS = 60 * 60 * 1000 // 1 hour

export async function requestPasswordReset(email) {
  const user = await prisma.user.findUnique({ where: { email } })
  if (!user) return // don't leak whether an account exists

  const rawToken = crypto.randomBytes(32).toString('hex')
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex')

  await prisma.passwordResetToken.create({
    data: { userId: user.id, tokenHash, expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS) },
  })

  const link = `${env.frontendUrl}/reset-password?token=${rawToken}`
  sendEmail({ to: user.email, ...passwordResetEmail({ name: user.name, link }), critical: true })
}

export async function resetPassword(rawToken, newPassword) {
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex')
  const resetToken = await prisma.passwordResetToken.findUnique({ where: { tokenHash } })

  if (!resetToken || resetToken.usedAt || resetToken.expiresAt < new Date()) {
    throw Object.assign(new Error('This reset link is invalid or has expired'), { statusCode: 400 })
  }

  const passwordHash = await bcrypt.hash(newPassword, 12)
  await prisma.$transaction([
    prisma.user.update({ where: { id: resetToken.userId }, data: { passwordHash } }),
    prisma.passwordResetToken.update({ where: { id: resetToken.id }, data: { usedAt: new Date() } }),
  ])
}

// ── Email verification — non-blocking, sets User.isVerified ─────────────────
// Stateless JWT instead of a DB token table: verifying twice is harmless, so
// single-use tracking isn't needed. Signed with a DERIVED secret so a
// verification token can never be replayed as a login token (authMiddleware
// verifies against env.jwtSecret) and a login token can never verify an email.
const VERIFY_EMAIL_SECRET = `${env.jwtSecret}:email-verify`

function sendVerificationEmailTo(user) {
  const token = jwt.sign({ sub: user.id, purpose: 'email_verify' }, VERIFY_EMAIL_SECRET, { expiresIn: '24h' })
  const link = `${env.frontendUrl}/verify-email?token=${token}`
  sendEmail({ to: user.email, ...emailVerificationEmail({ name: user.name, link }) })
}

export async function resendVerificationEmail(userId) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, name: true, isVerified: true },
  })
  if (!user) throw Object.assign(new Error('User not found'), { statusCode: 404 })
  if (user.isVerified) throw Object.assign(new Error('Email is already verified'), { statusCode: 400 })
  sendVerificationEmailTo(user)
}

export async function verifyEmail(rawToken) {
  let payload
  try {
    payload = jwt.verify(rawToken, VERIFY_EMAIL_SECRET)
  } catch {
    throw Object.assign(new Error('This verification link is invalid or has expired'), { statusCode: 400 })
  }
  if (payload.purpose !== 'email_verify') {
    throw Object.assign(new Error('This verification link is invalid or has expired'), { statusCode: 400 })
  }

  const { count } = await prisma.user.updateMany({ where: { id: payload.sub }, data: { isVerified: true } })
  if (count === 0) throw Object.assign(new Error('This verification link is invalid or has expired'), { statusCode: 400 })
}

// ── Passwordless login — emailed 6-digit OTP ────────────────────────────────
// Every send costs one of the platform's ~450 daily SMTP sends (lib/mailer.js),
// shared with every other email. Unlike notifications, an OTP that silently
// drops is a total login failure, so sends are `critical` AND pre-flighted.
// The per-email limits below are the real abuse defense: without them, an
// attacker could drain the whole day's quota — including the reserve that
// password resets depend on — by replaying this unauthenticated endpoint.
const OTP_TTL_MS = 10 * 60 * 1000
const OTP_TTL_MINUTES = OTP_TTL_MS / 60_000
const OTP_RESEND_COOLDOWN_MS = 60 * 1000
const OTP_MAX_PER_DAY = 5
const OTP_MAX_ATTEMPTS = 5

const hashOtp = (code) => crypto.createHash('sha256').update(code).digest('hex')

// crypto.randomInt, not Math.random — a predictable code is a login bypass.
const generateOtp = () => String(crypto.randomInt(0, 1_000_000)).padStart(6, '0')

export async function requestLoginOtp(email) {
  // Quota is checked FIRST, before any account lookup, so an exhausted-quota
  // response is byte-identical whether or not the address is registered.
  // Checking it after the lookup would turn "503 vs 200" into an
  // account-enumeration oracle.
  if (!(await canSend(true))) {
    // expose: this text is ours and leaks nothing — without it, error.middleware
    // sanitises every 5xx in prod and the user sees "Internal server error"
    // instead of being told the password still works. Verified against
    // production, where exactly that happened.
    throw Object.assign(
      new Error('Sign-in codes are temporarily unavailable. Please sign in with your password.'),
      { statusCode: 503, expose: true }
    )
  }

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true, name: true, isBlocked: true },
  })
  // Silent no-op for unknown or blocked accounts — never leak which emails are
  // registered. Blocked users are rejected at verify time too, so an OTP is
  // useless to them regardless; not sending simply avoids the wasted quota.
  if (!user || user.isBlocked) return

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000)
  const [recent, todayCount] = await Promise.all([
    prisma.emailOtp.findFirst({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    }),
    prisma.emailOtp.count({ where: { userId: user.id, createdAt: { gte: since } } }),
  ])

  if (recent && Date.now() - recent.createdAt.getTime() < OTP_RESEND_COOLDOWN_MS) {
    const wait = Math.ceil((OTP_RESEND_COOLDOWN_MS - (Date.now() - recent.createdAt.getTime())) / 1000)
    throw Object.assign(new Error(`Please wait ${wait}s before requesting another code`), { statusCode: 429 })
  }
  if (todayCount >= OTP_MAX_PER_DAY) {
    throw Object.assign(
      new Error('Too many sign-in codes requested today. Please sign in with your password.'),
      { statusCode: 429 }
    )
  }

  const code = generateOtp()
  await prisma.emailOtp.create({
    data: { userId: user.id, codeHash: hashOtp(code), expiresAt: new Date(Date.now() + OTP_TTL_MS) },
  })

  // Awaited, unlike every other email in this service: if the code never goes
  // out there is nothing for the user to type, so a failed send must surface
  // as an error rather than a code-entry screen that can never succeed.
  const sent = await sendEmail({
    to: user.email,
    ...loginOtpEmail({ name: user.name, code, ttlMinutes: OTP_TTL_MINUTES }),
    critical: true,
  })
  if (!sent) {
    // expose: same reasoning as the pre-flight above — our text, no internals.
    throw Object.assign(
      new Error('Could not send your sign-in code. Please sign in with your password.'),
      { statusCode: 503, expose: true }
    )
  }
}

export async function verifyLoginOtp(email, code) {
  const invalid = () => Object.assign(new Error('Invalid or expired code'), { statusCode: 401 })

  const user = await prisma.user.findUnique({ where: { email } })
  if (!user) throw invalid()

  const otp = await prisma.emailOtp.findFirst({
    where: { userId: user.id, consumedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: 'desc' },
  })
  if (!otp) throw invalid()

  // Attempt cap is per-code: 6 digits is 1e6 combos, trivially brute-forced
  // inside a 10-minute window without it. A burnt code forces a fresh request,
  // which the cooldown + daily cap then throttle.
  if (otp.attempts >= OTP_MAX_ATTEMPTS) throw invalid()

  if (otp.codeHash !== hashOtp(code)) {
    await prisma.emailOtp.update({ where: { id: otp.id }, data: { attempts: { increment: 1 } } })
    throw invalid()
  }

  // Checked only after the code is proven correct, so the distinct 403 can't
  // be used to probe which emails belong to blocked accounts.
  if (user.isBlocked) throw Object.assign(new Error('This account has been blocked'), { statusCode: 403 })

  // Receiving the code proves control of the inbox — exactly what the
  // verification link proves — so a first OTP login verifies the email for
  // free. `isVerified` is set here rather than left to the separate link flow.
  const [, updated] = await prisma.$transaction([
    prisma.emailOtp.update({ where: { id: otp.id }, data: { consumedAt: new Date() } }),
    prisma.user.update({ where: { id: user.id }, data: { isVerified: true } }),
  ])

  return { token: signUserToken(updated), user: stripPasswordHash(updated) }
}
