import { Router } from 'express'
import { optionalAuth } from '../../middlewares/auth.middleware.js'
import { validate } from '../../middlewares/validate.middleware.js'
import { analyticsLimiter } from '../../middlewares/rateLimit.middleware.js'
import { ingestSchema } from './analytics.validation.js'
import * as controller from './analytics.controller.js'

const router = Router()

// Public, because the top of the funnel is guests — requiring auth here would
// measure only the people who already converted. `optionalAuth` attaches
// req.user when a token happens to be present, so a signed-in session's steps
// carry their user id and a guest's simply do not.
router.post('/events', analyticsLimiter, optionalAuth, validate(ingestSchema), controller.ingest)

export default router
