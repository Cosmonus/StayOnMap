import * as service from './ai.service.js'
import { ok } from '../../utils/response.js'

export async function fraudScan(req, res, next) {
  try { ok(res, await service.runFraudScan(req.params.propertyId)) } catch (err) { next(err) }
}
export async function reviewScan(req, res, next) {
  try { ok(res, await service.detectFakeReview(req.params.reviewId)) } catch (err) { next(err) }
}
