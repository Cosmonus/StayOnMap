// Verifies the custom user JWT from Authorization header
// Attaches req.user = { id, email, role }

import jwt from 'jsonwebtoken'
import { prisma } from '../lib/prisma.js'
import { env } from '../config/env.js'

// These 401s are hand-rolled rather than thrown, so `errorMiddleware` — which
// puts `error` and `statusCode` on every response it formats — never sees them.
// They carried only { success, message } until 2026-08-10, which is the same
// gap `requireOwner` had: a client branching on `statusCode === 401` matches
// everywhere else and silently fails to match here. Invisible until someone
// writes that branch and it quietly never fires.
const unauthorized = (res, message, error = 'UNAUTHORIZED') =>
  res.status(401).json({ success: false, error, message, statusCode: 401 })

export async function authMiddleware(req, res, next) {
  const token = req.headers.authorization?.split('Bearer ')[1]
  if (!token) return unauthorized(res, 'Unauthorized', 'NO_TOKEN')

  let payload
  try {
    payload = jwt.verify(token, env.jwtSecret)
  } catch {
    return unauthorized(res, 'Invalid token', 'INVALID_TOKEN')
  }

  // isBlocked is checked here, not only at login, because tokens live for 7
  // days (env.jwtExpiresIn): without this, blocking a fraudster mid-scam left
  // them listing and messaging for the rest of the token's life. Costs one
  // indexed PK lookup per authenticated request.
  try {
    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: { isBlocked: true },
    })
    if (!user) return unauthorized(res, 'Invalid token', 'INVALID_TOKEN')
    if (user.isBlocked) {
      return res.status(403).json({ success: false, error: 'ACCOUNT_BLOCKED', message: 'Your account has been blocked', statusCode: 403 })
    }
  } catch (err) {
    return next(err)
  }

  req.user = { id: payload.sub, email: payload.email, role: payload.role }
  next()
}

/** Attach req.user if token present, but don't block unauthenticated requests */
export function optionalAuth(req, _res, next) {
  const token = req.headers.authorization?.split('Bearer ')[1]
  if (!token) return next()

  try {
    const payload = jwt.verify(token, env.jwtSecret)
    req.user = { id: payload.sub, email: payload.email, role: payload.role }
  } catch {
    // ignore — treat as unauthenticated
  }
  next()
}
