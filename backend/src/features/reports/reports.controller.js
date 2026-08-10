import * as service from './reports.service.js'
import * as thread from './reportThread.service.js'
import { ok, created } from '../../utils/response.js'

export async function submit(req, res, next) {
  try { created(res, await service.submitReport(req.user?.id, req.params.propertyId, req.body)) } catch (err) { next(err) }
}
export async function ownerList(req, res, next) {
  try { ok(res, await service.getOwnerReports(req.user.id, req.params.propertyId)) } catch (err) { next(err) }
}
export async function ownerRespond(req, res, next) {
  try { ok(res, await service.respondToReport(req.user.id, req.params.propertyId, req.params.reportId, req.body.ownerResponse)) } catch (err) { next(err) }
}
export async function adminList(req, res, next) {
  try { ok(res, await service.adminListReports(req.query)) } catch (err) { next(err) }
}
export async function adminModerate(req, res, next) {
  try { ok(res, await service.adminModerateReport(req.params.id, req.admin.sub, req.body)) } catch (err) { next(err) }
}

// ── The report thread (reporter ↔ moderator) ────────────────────────────────
// Two sides, two controllers, and no shared handler: the reporter's reads are
// scoped by their own id inside the service, the admin's are not, and one
// function taking a "who is asking" flag is how that distinction gets lost.
export async function reporterThread(req, res, next) {
  try { ok(res, await thread.getThreadForReporter(req.params.reportId, req.user.id)) } catch (err) { next(err) }
}
export async function reporterReply(req, res, next) {
  try { created(res, await thread.addReporterMessage(req.params.reportId, req.user.id, req.body.body)) } catch (err) { next(err) }
}
export async function adminThread(req, res, next) {
  try { ok(res, await thread.getThreadForAdmin(req.params.id)) } catch (err) { next(err) }
}
export async function adminReply(req, res, next) {
  try { created(res, await thread.addAdminMessage(req.params.id, req.admin.sub, req.body.body)) } catch (err) { next(err) }
}
export async function adminAwaiting(req, res, next) {
  try { ok(res, { reportIds: await thread.reportsAwaitingModerator() }) } catch (err) { next(err) }
}
