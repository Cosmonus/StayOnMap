import { Router } from 'express'
import { adminAuthMiddleware } from '../../middlewares/adminAuth.middleware.js'
import * as ctrl from './ai.controller.js'

const router = Router()
router.use(adminAuthMiddleware)
router.post('/fraud-scan/:propertyId', ctrl.fraudScan)
router.post('/review-scan/:reviewId', ctrl.reviewScan)

export default router
