// "Manage your property" — a sign-in link that is only ever sent to the
// WhatsApp number an account is verified on.
//
// The same discipline as PasswordResetToken: the raw token exists only in the
// message, sha256 in the database, single use, 24-hour TTL. Consuming it mints
// the same { token, refreshToken, user } triple every other login path mints,
// so the website treats it as an ordinary sign-in — the session is revocable
// from Settings → Devices like any other.
//
// Why a link and not a plain URL: a permanent unauthenticated URL that opens
// an owner's listing for editing is a URL anyone forwarded the message can
// use. This one expires, burns on first use, and lands the person in a real
// authenticated session with the ordinary ownership checks in front of every
// write.
import crypto from 'crypto'
import { prisma } from '../../lib/prisma.js'
import { env } from '../../config/env.js'
import { signUserToken, stripPasswordHash } from '../auth/tokens.js'
import { issueSession } from '../auth/session.service.js'

const TTL_MS = 24 * 60 * 60 * 1000
const hash = (raw) => crypto.createHash('sha256').update(raw).digest('hex')

/** Create a link for this user. Returns the URL to send. */
export async function createLoginLink(userId, { next = '/list' } = {}) {
  const raw = crypto.randomBytes(32).toString('hex')
  await prisma.whatsAppLoginLink.create({
    data: { userId, tokenHash: hash(raw), expiresAt: new Date(Date.now() + TTL_MS) },
  })
  const url = new URL('/wa/login', env.frontendUrl)
  url.searchParams.set('token', raw)
  if (next && next.startsWith('/')) url.searchParams.set('next', next)
  return url.toString()
}

/**
 * Exchange a raw token for a session. Every failure is the same 401 — an
 * expired, used or unknown token must look identical from outside.
 */
export async function consumeLoginLink(raw, ctx = {}) {
  const invalid = () => Object.assign(new Error('This link is invalid or has expired'), { statusCode: 401, expose: true })
  if (typeof raw !== 'string' || !/^[a-f0-9]{64}$/.test(raw)) throw invalid()

  const link = await prisma.whatsAppLoginLink.findUnique({ where: { tokenHash: hash(raw) } })
  if (!link || link.usedAt || link.expiresAt < new Date()) throw invalid()

  const user = await prisma.user.findUnique({ where: { id: link.userId } })
  if (!user) throw invalid()
  // Burn before checking the block, so a blocked account cannot keep retrying
  // the same link to probe its status.
  await prisma.whatsAppLoginLink.update({ where: { id: link.id }, data: { usedAt: new Date() } })
  if (user.isBlocked) throw Object.assign(new Error('This account has been blocked'), { statusCode: 403, expose: true })

  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } }).catch(() => {})
  const refreshToken = await issueSession(user.id, ctx)
  return { token: signUserToken(user), refreshToken, user: stripPasswordHash(user) }
}
