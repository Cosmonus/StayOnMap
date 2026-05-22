import { prisma } from '../lib/prisma.js'

export async function requireOwner(req, res, next) {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user.id }, select: { role: true } })
    if (!user || user.role !== 'OWNER') {
      return res.status(403).json({ success: false, error: 'OWNER_REQUIRED', message: 'Only owners can perform this action' })
    }
    next()
  } catch (err) { next(err) }
}
