import { Router } from 'express'
import { adminAuthMiddleware } from '../../middlewares/adminAuth.middleware.js'
import { forceRecalculate } from './trust.controller.js'

const router = Router()
router.use(adminAuthMiddleware)
router.post('/:propertyId/recalculate', forceRecalculate)

export default router
