import { ok } from '../../utils/response.js'
import * as service from './itCorridors.service.js'

export function getCorridors(req, res, next) {
  try {
    // Static hand-authored file, only changes on redeploy — same caching as metro.controller.js
    res.set('Cache-Control', 'public, max-age=3600')
    ok(res, service.getItCorridors(req.query.city))
  } catch (err) { next(err) }
}
