import { ok } from '../../utils/response.js'
import * as service from './areas.service.js'

// Hand-authored data, only changes on deploy — safe for browsers/CDNs to cache
const CACHE_HEADER = 'public, max-age=3600'

export function list(req, res, next) {
  try {
    res.set('Cache-Control', CACHE_HEADER)
    ok(res, service.listAreas({ city: req.query.city }))
  } catch (err) { next(err) }
}

export function get(req, res, next) {
  try {
    res.set('Cache-Control', CACHE_HEADER)
    ok(res, service.getArea(req.params.slug))
  } catch (err) { next(err) }
}

export function match(req, res, next) {
  try {
    res.set('Cache-Control', CACHE_HEADER)
    const profile = service.matchArea(req.query.city, req.query.area)
    ok(res, profile ?? null)
  } catch (err) { next(err) }
}
