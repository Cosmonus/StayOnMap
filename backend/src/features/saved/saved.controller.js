import * as service from './saved.service.js'
import { ok, created } from '../../utils/response.js'

export async function getMySaved(req, res, next) {
  try {
    const saved = await service.getSavedByUser(req.user.id)
    ok(res, saved)
  } catch (err) { next(err) }
}

export async function saveProperty(req, res, next) {
  try {
    const saved = await service.saveProperty(req.user.id, req.params.propertyId)
    created(res, saved)
  } catch (err) { next(err) }
}

export async function unsaveProperty(req, res, next) {
  try {
    await service.unsaveProperty(req.user.id, req.params.propertyId)
    ok(res, null, 'Removed from saved')
  } catch (err) { next(err) }
}
