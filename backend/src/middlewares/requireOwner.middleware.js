import { prisma } from '../lib/prisma.js'

export async function requireOwner(req, res, next) {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user.id }, select: { role: true } })
    if (!user || user.role !== 'OWNER') {
      // `statusCode` is included to match what errorMiddleware emits on every
      // other error. These two middlewares hand-roll their response instead of
      // throwing, and without the field a client that branches on
      // `statusCode === 403` silently fails to match THIS route while matching
      // everywhere else — a gap that is invisible until someone writes that
      // branch and it quietly never fires.
      return res.status(403).json({ success: false, error: 'OWNER_REQUIRED', message: 'Only owners can perform this action', statusCode: 403 })
    }
    next()
  } catch (err) { next(err) }
}
