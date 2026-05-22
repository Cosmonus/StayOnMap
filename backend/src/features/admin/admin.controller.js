import * as service from './admin.service.js'
import { ok, created } from '../../utils/response.js'

export async function login(req, res, next) {
  try { ok(res, await service.adminLogin(req.body.email, req.body.password)) } catch (err) { next(err) }
}
export async function analytics(req, res, next) {
  try { ok(res, await service.getDashboardAnalytics()) } catch (err) { next(err) }
}
export async function users(req, res, next) {
  try { ok(res, await service.listUsers(req.query)) } catch (err) { next(err) }
}
export async function userDetail(req, res, next) {
  try { ok(res, await service.getUserDetail(req.params.userId)) } catch (err) { next(err) }
}
export async function blockUser(req, res, next) {
  try { ok(res, await service.toggleUserBlock(req.params.userId, req.body.blocked, req.body.reason, req.admin.sub)) } catch (err) { next(err) }
}
export async function properties(req, res, next) {
  try { ok(res, await service.listAdminProperties(req.query)) } catch (err) { next(err) }
}
export async function propertyById(req, res, next) {
  try { ok(res, await service.getAdminPropertyById(req.params.id)) } catch (err) { next(err) }
}
export async function adminPins(req, res, next) {
  try { ok(res, await service.getAdminPins(req.query)) } catch (err) { next(err) }
}
export async function setPropertyStatus(req, res, next) {
  try { ok(res, await service.setPropertyStatus(req.params.id, req.body.status, req.body.note, req.admin.sub)) } catch (err) { next(err) }
}
export async function getReviews(req, res, next) {
  try { ok(res, await service.listReviews(req.query)) } catch (err) { next(err) }
}
export async function moderateReview(req, res, next) {
  try { ok(res, await service.moderateReview(req.params.id, req.body.status, req.admin.sub)) } catch (err) { next(err) }
}
export async function moderationQueue(req, res, next) {
  try { ok(res, await service.getModerationQueue()) } catch (err) { next(err) }
}
export async function activityLogs(req, res, next) {
  try { ok(res, await service.listActivityLogs(req.query)) } catch (err) { next(err) }
}
export async function getAmenities(req, res, next) {
  try { ok(res, await service.listAmenities()) } catch (err) { next(err) }
}
export async function addAmenity(req, res, next) {
  try { created(res, await service.createAmenity(req.body.name)) } catch (err) { next(err) }
}
export async function removeAmenity(req, res, next) {
  try { ok(res, await service.deleteAmenity(req.params.id)) } catch (err) { next(err) }
}
export async function getMonitorStatus(req, res, next) {
  try { ok(res, await service.getMonitorStatus()) } catch (err) { next(err) }
}
export async function getProfile(req, res, next) {
  try { ok(res, await service.getAdminProfile(req.admin.sub)) } catch (err) { next(err) }
}
export async function updateProfile(req, res, next) {
  try { ok(res, await service.updateAdminProfile(req.admin.sub, req.body)) } catch (err) { next(err) }
}
export async function changePassword(req, res, next) {
  try { await service.changeAdminPassword(req.admin.sub, req.body.currentPassword, req.body.newPassword); ok(res, { changed: true }) } catch (err) { next(err) }
}
