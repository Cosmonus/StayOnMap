import * as service from './savedSearch.service.js'
import { ok, created } from '../../utils/response.js'

export async function list(req, res, next) {
  try {
    ok(res, await service.listSavedSearches(req.user.id))
  } catch (err) { next(err) }
}

export async function create(req, res, next) {
  try {
    created(res, await service.createSavedSearch(req.user.id, req.body))
  } catch (err) { next(err) }
}

export async function remove(req, res, next) {
  try {
    await service.deleteSavedSearch(req.user.id, req.params.id)
    ok(res, { deleted: true })
  } catch (err) { next(err) }
}
