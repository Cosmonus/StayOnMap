import crypto from 'crypto'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { prisma } from '../../lib/prisma.js'
import { env } from '../../config/env.js'
import { generateUserDisplayId } from '../../utils/idGenerator.js'
import { sendEmail, passwordResetEmail } from '../../services/email.service.js'
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
  sendEmail({ to: user.email, ...passwordResetEmail({ name: user.name, link }) })
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
