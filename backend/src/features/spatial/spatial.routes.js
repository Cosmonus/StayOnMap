import { Router } from 'express'
import { placesIntelLimiter } from '../../middlewares/rateLimit.middleware.js'
import * as ctrl from './spatial.controller.js'

const router = Router()

// Public. Reads are cheap (one indexed lookup), but a miss on an unseen
// coordinate schedules billed materialisation — so this shares the same
// limiter bucket as the other coordinate-driven intel endpoints rather than
// getting a fourth one.
router.get('/at', placesIntelLimiter, ctrl.contextAt) // GET /api/v1/spatial/at?lat=&lng=

// Public, and deliberately NOT behind placesIntelLimiter: /at needs it because
// a miss schedules billed materialisation, but this is a pure local read of
// our own PoiIndex — no external call exists on any path. The global
// defaultLimiter still applies, and a browsing user opens several categories
// in one sitting, which a 30/15min bucket would cut off mid-scroll.
router.get('/pois', ctrl.poisNear) // GET /api/v1/spatial/pois?lat=&lng=&category=&radius=

export default router
