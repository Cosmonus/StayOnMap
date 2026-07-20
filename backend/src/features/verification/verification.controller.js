import * as service from './verification.service.js'
import { ok, created } from '../../utils/response.js'

export async function submit(req, res, next) {
  try { created(res, await service.submitVerification(req.user.id, req.params.propertyId, req.body)) } catch (err) { next(err) }
}
export async function addDoc(req, res, next) {
  try { created(res, await service.addDocument(req.user.id, req.params.propertyId, req.body)) } catch (err) { next(err) }
}
export async function status(req, res, next) {
  try { ok(res, await service.getVerificationStatus(req.user.id, req.params.propertyId)) } catch (err) { next(err) }
}
export async function adminList(req, res, next) {
  try { ok(res, await service.adminListVerifications(req.query)) } catch (err) { next(err) }
}
export async function adminReview(req, res, next) {
  try { ok(res, await service.adminReviewVerification(req.params.id, req.admin.sub, req.body)) } catch (err) { next(err) }
}
