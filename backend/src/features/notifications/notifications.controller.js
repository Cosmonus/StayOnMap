import * as service from './notifications.service.js'
import { ok } from '../../utils/response.js'

export async function list(req, res, next) {
  try { ok(res, await service.getUserNotifications(req.user.id)) } catch (err) { next(err) }
}
export async function markOne(req, res, next) {
  try { ok(res, await service.markRead(req.params.id, req.user.id)) } catch (err) { next(err) }
}
export async function markAll(req, res, next) {
  try { await service.markAllRead(req.user.id, req.query.type); ok(res, null) } catch (err) { next(err) }
}
