import { Router } from 'express'
import { authMiddleware, optionalAuth } from '../../middlewares/auth.middleware.js'
import { adminAuthMiddleware } from '../../middlewares/adminAuth.middleware.js'
import { validate } from '../../middlewares/validate.middleware.js'
import { strictLimiter } from '../../middlewares/rateLimit.middleware.js'
import { createReportSchema, moderateReportSchema, ownerRespondSchema } from './reports.validation.js'
import * as ctrl from './reports.controller.js'

export const propertyReportRouter = Router({ mergeParams: true })
// Public by design (anonymous fraud reports are intentional), but rate-limited,
// and optionalAuth so a logged-in reporter is actually recorded as one — the
// controller reads req.user?.id, which was always undefined without this.
propertyReportRouter.post('/', strictLimiter, optionalAuth, validate(createReportSchema), ctrl.submit)
propertyReportRouter.get('/mine',                authMiddleware, ctrl.ownerList)
propertyReportRouter.patch('/:reportId/respond', authMiddleware, validate(ownerRespondSchema), ctrl.ownerRespond)

export const adminReportRouter = Router()
adminReportRouter.use(adminAuthMiddleware)
adminReportRouter.get('/', ctrl.adminList)
adminReportRouter.patch('/:id/moderate', validate(moderateReportSchema), ctrl.adminModerate)
