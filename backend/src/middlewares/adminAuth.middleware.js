import jwt from 'jsonwebtoken'

export function adminAuthMiddleware(req, res, next) {
  const token = req.headers.authorization?.split('Bearer ')[1]
  if (!token) return res.status(401).json({ success: false, message: 'Unauthorized' })
  try {
    const payload = jwt.verify(token, process.env.ADMIN_JWT_SECRET)
    if (payload.role !== 'ADMIN') return res.status(403).json({ success: false, message: 'Forbidden' })
    req.admin = payload
    next()
  } catch {
    return res.status(401).json({ success: false, message: 'Invalid token' })
  }
}
