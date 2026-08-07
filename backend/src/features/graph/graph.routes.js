import { Router } from 'express'
import { authMiddleware } from '../../middlewares/auth.middleware.js'
import { adminAuthMiddleware } from '../../middlewares/adminAuth.middleware.js'
import { ok } from '../../utils/response.js'
import { getRecommendations } from './recommendations.js'
import { GraphRepository } from './repository.js'
import { toolCatalogue } from './tools.js'
import { getWeights } from './ranking.js'
import { getGraphHealth } from './health.js'

const router = Router()

/**
 * Personalised recommendations for the signed-in user.
 *
 * `authMiddleware`, not optionalAuth: there is no anonymous version of "for
 * you", and returning a generic list under that name would be a lie about what
 * it is. `req.user.id` — never a query parameter — so one person can never ask
 * for another's recommendations.
 */
router.get('/recommendations', authMiddleware, async (req, res, next) => {
  try {
    const limit = Math.min(Math.max(Number(req.query.limit) || 12, 1), 24)
    const center = req.query.lat && req.query.lng
      ? { lat: Number(req.query.lat), lng: Number(req.query.lng) }
      : null
    ok(res, await getRecommendations(req.user.id, { limit, center }))
  } catch (err) { next(err) }
})

// NOTE: there is no `/areas/:id/related` route. `findRelatedAreas` exists on the
// repository and in the tool registry, where it has a real consumer; a public
// route for it had none, and an endpoint kept "just in case" is the thing the
// code-quality checklist forbids. Six lines to re-add when a locality page wants
// it — which will also want `localityId` back on that page's payload, currently
// stripped on purpose.

/**
 * ADMIN ONLY, and read-only: the shape of the graph around one node, plus the
 * ranking weights currently in force.
 *
 * This is an inspection surface for whoever has to answer "why was this ranked
 * there" — it is not a query language. `from` names a node; depth and result
 * count are clamped inside the repository. There is deliberately no endpoint
 * anywhere that accepts SQL, a Cypher string, or a free-form traversal spec.
 */
router.get('/inspect', adminAuthMiddleware, async (req, res, next) => {
  try {
    const from = String(req.query.from ?? '')
    if (!GraphRepository.parseNodeId(from)) {
      return res.status(400).json({
        success: false,
        error: 'INVALID_NODE',
        message: 'from must be a node id like "Property:abc123"',
      })
    }
    const [neighbours, walk, weights] = await Promise.all([
      GraphRepository.findRelated(from, { limit: 50 }),
      GraphRepository.traverse(from, { depth: Number(req.query.depth) || 2, limit: 100 }),
      getWeights(),
    ])
    ok(res, { from, neighbours, walk, weights, tools: toolCatalogue() })
  } catch (err) { next(err) }
})

/**
 * ADMIN ONLY: is the graph actually built?
 *
 * The observability the brief asks for, answering the question that has actually
 * gone wrong every time — coverage, not speed. Every metric names the script
 * that fixes it, because a number with no remedy beside it is one somebody reads
 * and forgets.
 */
router.get('/health', adminAuthMiddleware, async (req, res, next) => {
  try {
    ok(res, await getGraphHealth())
  } catch (err) { next(err) }
})

export default router
