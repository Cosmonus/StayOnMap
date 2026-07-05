import * as service from './availability.service.js'
import { ok } from '../../utils/response.js'

export async function list(req, res, next) {
  try { ok(res, await service.getAvailability(req.user.id, req.params.propertyId)) } catch (err) { next(err) }
}

export async function set(req, res, next) {
  try { ok(res, await service.setAvailability(req.user.id, req.params.propertyId, req.body.dates)) } catch (err) { next(err) }
}
