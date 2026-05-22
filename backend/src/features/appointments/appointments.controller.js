import * as service from './appointments.service.js'
import { ok, created } from '../../utils/response.js'

export async function create(req, res, next) {
  try { created(res, await service.requestAppointment(req.user.id, req.params.propertyId, req.body)) } catch (err) { next(err) }
}
export async function mine(req, res, next) {
  try { ok(res, await service.getTenantAppointments(req.user.id)) } catch (err) { next(err) }
}
export async function ownerAppointments(req, res, next) {
  try { ok(res, await service.getOwnerAppointments(req.user.id)) } catch (err) { next(err) }
}
export async function forProperty(req, res, next) {
  try { ok(res, await service.getPropertyAppointments(req.params.propertyId, req.user.id)) } catch (err) { next(err) }
}
export async function updateStatus(req, res, next) {
  try { ok(res, await service.updateAppointmentStatus(req.params.id, req.user.id, req.body)) } catch (err) { next(err) }
}
