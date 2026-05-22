import * as service from './users.service.js'
import { ok } from '../../utils/response.js'

export async function getProfile(req, res, next) {
  try {
    const user = await service.getUserById(req.user.id)
    ok(res, user)
  } catch (err) { next(err) }
}

export async function updateProfile(req, res, next) {
  try {
    const user = await service.updateUser(req.user.id, req.body)
    ok(res, user)
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
