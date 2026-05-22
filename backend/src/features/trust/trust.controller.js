import { recalculateTrustScore, recalculateRiskScore, recalculateOwnerTrust } from './trust.service.js'
import { ok } from '../../utils/response.js'

export async function forceRecalculate(req, res, next) {
  try {
    const [trust, risk] = await Promise.all([recalculateTrustScore(req.params.propertyId), recalculateRiskScore(req.params.propertyId)])
    ok(res, { trust, risk })
  } catch (err) { next(err) }
}

export async function getOwnerTrust(req, res, next) {
  try {
    const result = await recalculateOwnerTrust(req.params.ownerId)
    ok(res, result)
  } catch (err) { next(err) }
}
