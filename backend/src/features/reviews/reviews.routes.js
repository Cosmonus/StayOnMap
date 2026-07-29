import { Router } from 'express'
import { authMiddleware } from '../../middlewares/auth.middleware.js'
import { validate } from '../../middlewares/validate.middleware.js'
import { createReviewSchema, voteSchema, reviewResponseSchema } from './reviews.validation.js'
import * as ctrl from './reviews.controller.js'

// Mounted under /api/v1/properties/:propertyId/reviews
export const propertyReviewRouter = Router({ mergeParams: true })
propertyReviewRouter.get('/', ctrl.list)
propertyReviewRouter.post('/', authMiddleware, validate(createReviewSchema), ctrl.submit)
propertyReviewRouter.post('/vote', authMiddleware, validate(voteSchema), ctrl.vote)
propertyReviewRouter.patch('/:reviewId/response', authMiddleware, validate(reviewResponseSchema), ctrl.ownerRespond)
