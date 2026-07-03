import { ok } from '../../utils/response.js'
import * as service from './metro.service.js'

export function getNetwork(req, res, next) {
  try {
    // Static per-city file, only changes when re-fetched from OSM on deploy
    res.set('Cache-Control', 'public, max-age=3600')
    ok(res, service.getMetroNetwork(req.query.city))
  } catch (err) { next(err) }
}
