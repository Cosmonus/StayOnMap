import { Router } from 'express'
import { authMiddleware } from '../../middlewares/auth.middleware.js'
import { adminAuthMiddleware } from '../../middlewares/adminAuth.middleware.js'
import { validate } from '../../middlewares/validate.middleware.js'
import { createReviewSchema } from './reviews.validation.js'
import * as ctrl from './reviews.controller.js'

// Mounted under /api/v1/properties/:propertyId/reviews
export const propertyReviewRouter = Router({ mergeParams: true })
propertyReviewRouter.get('/', ctrl.list)
propertyReviewRouter.post('/', authMiddleware, validate(createReviewSchema), ctrl.submit)
propertyReviewRouter.post('/vote', authMiddleware, ctrl.vote)
propertyReviewRouter.patch('/:reviewId/response', authMiddleware, ctrl.ownerRespond)

// Admin
export const adminReviewRouter = Router()
adminReviewRouter.use(adminAuthMiddleware)
adminReviewRouter.get('/', ctrl.adminList)
adminReviewRouter.patch('/:id/status', ctrl.adminSetStatus)
