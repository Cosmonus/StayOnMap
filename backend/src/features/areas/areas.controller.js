import { ok } from '../../utils/response.js'
import * as service from './areas.service.js'

export function list(req, res, next) {
  try {
    ok(res, service.listAreas({ city: req.query.city }))
  } catch (err) { next(err) }
}

export function get(req, res, next) {
  try {
    ok(res, service.getArea(req.params.slug))
  } catch (err) { next(err) }
}

export function match(req, res, next) {
  try {
    const profile = service.matchArea(req.query.city, req.query.area)
    ok(res, profile ?? null)
  } catch (err) { next(err) }
}
