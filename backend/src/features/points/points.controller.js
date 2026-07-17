import { ok } from '../../utils/response.js'
import { getPointsSummary } from './points.service.js'

// Always req.user.id — never a client-supplied userId. Points are only ever
// readable by the person who earned them; there's no leaderboard to expose
// (deliberately — see points.service.js).
export async function getMyPoints(req, res, next) {
  try {
    ok(res, await getPointsSummary(req.user.id))
  } catch (err) { next(err) }
}
