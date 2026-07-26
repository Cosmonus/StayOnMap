import * as service from './host.service.js'
import { ok } from '../../utils/response.js'

export async function getDashboard(req, res, next) {
  try {
    const dashboard = await service.getHostDashboard(req.user.id)
    ok(res, dashboard)
  } catch (err) { next(err) }
}
