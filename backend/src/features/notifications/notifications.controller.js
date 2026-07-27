import * as service from './notifications.service.js'
import { ok } from '../../utils/response.js'

// ?audience=TENANT|OWNER narrows the list to one hat (see
// Notification.audience). Anything else — including omitting it — returns
// everything, so a client that doesn't know about hats is unaffected.
export async function list(req, res, next) {
  try { ok(res, await service.getUserNotifications(req.user.id, req.query.audience)) } catch (err) { next(err) }
}
export async function unread(req, res, next) {
  try { ok(res, await service.getUnreadCounts(req.user.id)) } catch (err) { next(err) }
}
export async function markOne(req, res, next) {
  try { ok(res, await service.markRead(req.params.id, req.user.id)) } catch (err) { next(err) }
}
export async function markAll(req, res, next) {
  try {
    await service.markAllRead(req.user.id, req.query.type, req.query.audience)
    ok(res, null)
  } catch (err) { next(err) }
}
