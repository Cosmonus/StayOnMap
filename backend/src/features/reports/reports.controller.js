import * as service from './reports.service.js'
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
