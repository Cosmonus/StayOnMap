import * as service from './tenancy.service.js'
import { ok, created } from '../../utils/response.js'

export async function mine(req, res, next) {
  try {
    ok(res, await service.listMyTenancies(req.user.id, req.query.hat))
  } catch (err) { next(err) }
}

export async function confirm(req, res, next) {
  try {
    ok(res, await service.confirmTenancy(req.params.id, req.user.id))
  } catch (err) { next(err) }
}

export async function decline(req, res, next) {
  try {
    await service.declineTenancy(req.params.id, req.user.id)
    ok(res, { declined: true })
  } catch (err) { next(err) }
}

export async function addReview(req, res, next) {
  try {
    created(res, await service.addReview(req.params.id, req.user.id, req.body))
  } catch (err) { next(err) }
}

export async function resume(req, res, next) {
  try {
    ok(res, await service.tenantResume(req.user.id, req.params.userId))
  } catch (err) { next(err) }
}
