import * as service from './auth.service.js'
import { ok, created } from '../../utils/response.js'

export async function syncProfile(req, res, next) {
  try {
    const user = await service.syncOrCreateUser(req.user, req.body)
    created(res, user)
  } catch (err) { next(err) }
}

export async function getMe(req, res, next) {
  try {
    const user = await service.getUserById(req.user.id)
    if (!user) {
      // User authenticated with Supabase but hasn't synced their DB profile yet
      return res.status(404).json({ success: false, error: 'PROFILE_NOT_FOUND', message: 'Call POST /auth/sync to create your profile' })
    }
    ok(res, user)
  } catch (err) { next(err) }
}

export async function updateRole(req, res, next) {
  try {
    const user = await service.updateUserRole(req.user.id, req.body.role)
    ok(res, user)
  } catch (err) { next(err) }
}
