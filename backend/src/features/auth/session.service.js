// Refresh-token sessions — one AuthSession row per logged-in device.
//
// The access JWT stays exactly what it was (env.jwtExpiresIn, 7d default):
// released mobile builds have no refresh logic, and shortening the access
// token before every client can refresh would sign them all out on a loop.
// Sessions are issued ALONGSIDE the existing { token, user } response, so a
// client that ignores refreshToken behaves exactly as before. Once web and
// mobile both refresh, JWT_EXPIRES_IN can be dialled down to 15m — that flip
// is an env change, not a deploy.
//
// Rotation: every refresh replaces the token and remembers the sha256 of the
// one it replaced. A request presenting that REPLACED token is the signature
// of a stolen-and-replayed refresh token (the legitimate client already moved
// on), and the response is to revoke the whole session, not just decline.
import crypto from 'crypto'
import { prisma } from '../../lib/prisma.js'
import { signUserToken, stripPasswordHash } from './tokens.js'

const REFRESH_TTL_MS = 30 * 24 * 60 * 60 * 1000 // 30 days
const MAX_SESSIONS_PER_USER = 10 // oldest are dropped, not an error

const hashToken = (raw) => crypto.createHash('sha256').update(raw).digest('hex')

const authError = (message) => Object.assign(new Error(message), { statusCode: 401 })

// "Chrome on Windows" from a raw User-Agent — coarse on purpose. This labels a
// row in the user's own device list; it does not need to fingerprint anyone.
export function deviceLabelFrom(userAgent) {
  const ua = String(userAgent ?? '')
  if (!ua) return null
  if (/StayOnMap-Mobile|okhttp|Expo/i.test(ua)) return 'StayOnMap mobile app'
  const browser =
    /Edg\//.test(ua) ? 'Edge' :
    /OPR\//.test(ua) ? 'Opera' :
    /Chrome\//.test(ua) ? 'Chrome' :
    /Firefox\//.test(ua) ? 'Firefox' :
    /Safari\//.test(ua) ? 'Safari' : 'Browser'
  const os =
    /Windows/.test(ua) ? 'Windows' :
    /Android/.test(ua) ? 'Android' :
    /iPhone|iPad|iOS/.test(ua) ? 'iOS' :
    /Mac OS/.test(ua) ? 'macOS' :
    /Linux/.test(ua) ? 'Linux' : null
  return os ? `${browser} on ${os}` : browser
}

/**
 * Create a session for a freshly-authenticated user and return the raw
 * refresh token (its hash is all the DB ever sees). Also stamps lastLoginAt.
 */
export async function issueSession(userId, { userAgent, ip } = {}) {
  const raw = crypto.randomBytes(32).toString('hex')

  await prisma.$transaction([
    prisma.authSession.create({
      data: {
        userId,
        tokenHash: hashToken(raw),
        userAgent: userAgent?.slice(0, 400) ?? null,
        deviceLabel: deviceLabelFrom(userAgent),
        ip: ip?.slice(0, 60) ?? null,
        expiresAt: new Date(Date.now() + REFRESH_TTL_MS),
      },
    }),
    prisma.user.update({ where: { id: userId }, data: { lastLoginAt: new Date() } }),
  ])

  // Cap sessions per user — a login loop must not grow rows forever. Delete
  // beyond the newest N, never error the login itself.
  const stale = await prisma.authSession.findMany({
    where: { userId },
    orderBy: { lastUsedAt: 'desc' },
    skip: MAX_SESSIONS_PER_USER,
    select: { id: true },
  })
  if (stale.length) {
    await prisma.authSession.deleteMany({ where: { id: { in: stale.map((s) => s.id) } } })
  }

  return raw
}

/**
 * Exchange a refresh token for a fresh access token + rotated refresh token.
 */
export async function refreshSession(rawToken) {
  const hash = hashToken(String(rawToken ?? ''))

  // A rotated-out token turning up again is a replay — someone (the thief or
  // the victim, no way to tell which) is holding a stale copy. Kill the session.
  const replayed = await prisma.authSession.findUnique({ where: { prevTokenHash: hash } })
  if (replayed && !replayed.revokedAt) {
    await prisma.authSession.update({ where: { id: replayed.id }, data: { revokedAt: new Date() } })
    throw authError('Session revoked — please sign in again')
  }

  const session = await prisma.authSession.findUnique({
    where: { tokenHash: hash },
    include: { user: true },
  })
  if (!session || session.revokedAt || session.expiresAt < new Date()) {
    throw authError('Invalid or expired session')
  }
  if (session.user.isBlocked) {
    throw Object.assign(new Error('This account has been blocked'), { statusCode: 403 })
  }

  const nextRaw = crypto.randomBytes(32).toString('hex')
  await prisma.authSession.update({
    where: { id: session.id },
    data: { tokenHash: hashToken(nextRaw), prevTokenHash: hash, lastUsedAt: new Date() },
  })

  return {
    token: signUserToken(session.user),
    refreshToken: nextRaw,
    user: stripPasswordHash(session.user),
  }
}

/** Logout this device: revoke the session the presented refresh token belongs to. */
export async function revokeSessionByToken(rawToken) {
  const hash = hashToken(String(rawToken ?? ''))
  // Accept the current OR just-rotated hash — a client that refreshed and then
  // immediately logged out may only have the older token in hand.
  await prisma.authSession.updateMany({
    where: { OR: [{ tokenHash: hash }, { prevTokenHash: hash }], revokedAt: null },
    data: { revokedAt: new Date() },
  })
}

/** Logout everywhere. Used by explicit logout-all AND by password reset. */
export async function revokeAllSessions(userId) {
  await prisma.authSession.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  })
}

/** The user's own device list — active sessions only, no token material. */
export async function listSessions(userId) {
  return prisma.authSession.findMany({
    where: { userId, revokedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { lastUsedAt: 'desc' },
    select: { id: true, deviceLabel: true, ip: true, createdAt: true, lastUsedAt: true },
  })
}

/** Revoke one session by id — scoped by userId so nobody revokes a stranger's. */
export async function revokeSessionById(userId, sessionId) {
  const { count } = await prisma.authSession.updateMany({
    where: { id: sessionId, userId, revokedAt: null },
    data: { revokedAt: new Date() },
  })
  if (count === 0) throw Object.assign(new Error('Session not found'), { statusCode: 404 })
}
