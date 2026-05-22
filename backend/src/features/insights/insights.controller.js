import * as service from './insights.service.js'
import { ok, created } from '../../utils/response.js'

export async function add(req, res, next) {
  try { created(res, await service.addInsight(req.user.id, req.params.propertyId, req.body)) } catch (err) { next(err) }
}
export async function list(req, res, next) {
  try { ok(res, await service.getInsights(req.params.propertyId)) } catch (err) { next(err) }
}
