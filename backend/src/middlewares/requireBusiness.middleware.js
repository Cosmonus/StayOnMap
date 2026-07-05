import { prisma } from '../lib/prisma.js'

const BUSINESS_GATED_TYPES = ['PG', 'COMMERCIAL', 'SHORT_STAY']

// Runs after validate(createPropertySchema), so req.body.type is already a
// known-good enum value. Only gates listing creation — never touches
// existing listings or requires already-active owners to upgrade.
export async function requireBusinessForType(req, res, next) {
  try {
    if (!BUSINESS_GATED_TYPES.includes(req.body.type)) return next()

    const user = await prisma.user.findUnique({ where: { id: req.user.id }, select: { isBusiness: true } })
    if (!user?.isBusiness) {
      return res.status(403).json({ success: false, error: 'BUSINESS_REQUIRED', message: 'A StayOnMap Business account is required to list this property type' })
    }
    next()
  } catch (err) { next(err) }
}
