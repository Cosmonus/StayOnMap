// getOwnerTrust() lived here until 2026-08-10 with no route and no caller.
// recalculateOwnerTrust still runs — trust.service.js fires it whenever a
// property's TrustScore changes, which is the only correct time for it.
import { recalculateTrustScore, recalculateRiskScore } from './trust.service.js'
import { ok } from '../../utils/response.js'

export async function forceRecalculate(req, res, next) {
  try {
    const [trust, risk] = await Promise.all([recalculateTrustScore(req.params.propertyId), recalculateRiskScore(req.params.propertyId)])
    ok(res, { trust, risk })
  } catch (err) { next(err) }
}

