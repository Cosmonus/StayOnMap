import * as service from './reviews.service.js'
import { ok, created } from '../../utils/response.js'

export async function submit(req, res, next) {
  try { created(res, await service.submitReview(req.user.id, req.params.propertyId, req.body)) } catch (err) { next(err) }
}
export async function list(req, res, next) {
  try { ok(res, await service.getPropertyReviews(req.params.propertyId)) } catch (err) { next(err) }
}
export async function adminList(req, res, next) {
  try { ok(res, await service.adminListReviews(req.query)) } catch (err) { next(err) }
}
export async function adminSetStatus(req, res, next) {
  try { ok(res, await service.adminSetReviewStatus(req.params.id, req.body.status)) } catch (err) { next(err) }
}
export async function vote(req, res, next) {
  try { ok(res, await service.voteRecommendation(req.user.id, req.params.propertyId, req.body.recommend)) } catch (err) { next(err) }
}
export async function ownerRespond(req, res, next) {
  try { ok(res, await service.respondToReview(req.user.id, req.params.propertyId, req.params.reviewId, req.body.response)) } catch (err) { next(err) }
}
