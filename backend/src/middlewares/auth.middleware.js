// Verifies Supabase JWT from Authorization header
// Attaches req.user = { id, email, role }

import { supabase } from '../lib/supabase.js'

export async function authMiddleware(req, res, next) {
  const token = req.headers.authorization?.split('Bearer ')[1]
  if (!token) return res.status(401).json({ success: false, message: 'Unauthorized' })

  const { data: { user }, error } = await supabase.auth.getUser(token)
  if (error || !user) return res.status(401).json({ success: false, message: 'Invalid token' })

  req.user = user
  next()
}

/** Attach req.user if token present, but don't block unauthenticated requests */
export async function optionalAuth(req, _res, next) {
  const token = req.headers.authorization?.split('Bearer ')[1]
  if (!token) return next()

  try {
    const { data: { user } } = await supabase.auth.getUser(token)
    if (user) req.user = user
  } catch {
    // ignore — treat as unauthenticated
  }
  next()
}
