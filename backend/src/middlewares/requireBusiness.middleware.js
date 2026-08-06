import { prisma } from '../lib/prisma.js'

// Exported so tests can assert the wizard's gated categories map onto
// exactly this set (tests/wizard-sixtype-contract.test.js).
export const BUSINESS_GATED_TYPES = ['PG', 'COMMERCIAL', 'SHORT_STAY']

// Runs after validate(createPropertySchema), so req.body.type is already a
// known-good enum value. Only gates listing creation — never touches
// existing listings or requires already-active owners to upgrade.
export async function requireBusinessForType(req, res, next) {
  try {
    if (!BUSINESS_GATED_TYPES.includes(req.body.type)) return next()

    const user = await prisma.user.findUnique({ where: { id: req.user.id }, select: { isBusiness: true } })
    if (!user?.isBusiness) {
      // `statusCode` is included to match what errorMiddleware emits on every
      // other error. These two middlewares hand-roll their response instead of
      // throwing, and without the field a client that branches on
      // `statusCode === 403` silently fails to match THIS route while matching
      // everywhere else — a gap that is invisible until someone writes that
      // branch and it quietly never fires.
      return res.status(403).json({ success: false, error: 'BUSINESS_REQUIRED', message: 'A StayOnMap Business account is required to list this property type', statusCode: 403 })
    }
    next()
  } catch (err) { next(err) }
}
