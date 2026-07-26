import { Router } from 'express'
import { authMiddleware } from '../../middlewares/auth.middleware.js'
import { adminAuthMiddleware } from '../../middlewares/adminAuth.middleware.js'
import { validate } from '../../middlewares/validate.middleware.js'
import { addDocumentSchema, adminReviewSchema, submitVerificationSchema, adminVerificationsQuerySchema } from './verification.validation.js'
import * as ctrl from './verification.controller.js'

// Mounted under /api/v1/properties/:propertyId/verification
export const propertyVerificationRouter = Router({ mergeParams: true })
propertyVerificationRouter.use(authMiddleware)
propertyVerificationRouter.post('/', validate(submitVerificationSchema), ctrl.submit)
propertyVerificationRouter.post('/documents', validate(addDocumentSchema), ctrl.addDoc)
propertyVerificationRouter.get('/', ctrl.status)

// Admin
export const adminVerificationRouter = Router()
adminVerificationRouter.use(adminAuthMiddleware)
adminVerificationRouter.get('/', validate(adminVerificationsQuerySchema, 'query'), ctrl.adminList)
adminVerificationRouter.patch('/:id', validate(adminReviewSchema), ctrl.adminReview)
