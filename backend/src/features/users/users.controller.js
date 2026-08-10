import * as service from './users.service.js'
import * as safety from './safety.service.js'
import { ok, created } from '../../utils/response.js'

export async function updateProfile(req, res, next) {
  try {
    const user = await service.updateUser(req.user.id, req.body)
    ok(res, user)
  } catch (err) { next(err) }
}

export async function getAccountSummary(req, res, next) {
  try {
    const summary = await service.getAccountSummary(req.user.id)
    ok(res, summary)
  } catch (err) { next(err) }
}

export async function getSettings(req, res, next) {
  try {
    const settings = await service.getSettings(req.user.id)
    ok(res, settings)
  } catch (err) { next(err) }
}

export async function changePassword(req, res, next) {
  try {
    await service.changePassword(req.user.email)
    ok(res, { sent: true })
  } catch (err) { next(err) }
}

export async function deleteAccount(req, res, next) {
  try {
    await service.deleteAccount(req.user.id)
    res.status(200).json({ success: true, data: { deleted: true } })
  } catch (err) { next(err) }
}

// ─── User safety: blocking and reporting a person ────────────────────────────

export async function blockUser(req, res, next) {
  try {
    ok(res, await safety.blockUser(req.user.id, req.params.userId))
  } catch (err) { next(err) }
}

export async function unblockUser(req, res, next) {
  try {
    ok(res, await safety.unblockUser(req.user.id, req.params.userId))
  } catch (err) { next(err) }
}

export async function listBlockedUsers(req, res, next) {
  try {
    ok(res, await safety.listBlockedUsers(req.user.id))
  } catch (err) { next(err) }
}

export async function reportUser(req, res, next) {
  try {
    created(res, await safety.reportUser(req.user.id, req.params.userId, req.body))
  } catch (err) { next(err) }
}
