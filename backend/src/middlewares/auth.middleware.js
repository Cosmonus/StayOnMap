// Verifies the custom user JWT from Authorization header
// Attaches req.user = { id, email, role }

import jwt from 'jsonwebtoken'
import { env } from '../config/env.js'

export function authMiddleware(req, res, next) {
  const token = req.headers.authorization?.split('Bearer ')[1]
  if (!token) return res.status(401).json({ success: false, message: 'Unauthorized' })

  try {
    const payload = jwt.verify(token, env.jwtSecret)
    req.user = { id: payload.sub, email: payload.email, role: payload.role }
    next()
  } catch {
    return res.status(401).json({ success: false, message: 'Invalid token' })
  }
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
