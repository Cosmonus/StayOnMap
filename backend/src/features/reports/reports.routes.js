import { Router } from 'express'
import { authMiddleware } from '../../middlewares/auth.middleware.js'
import { adminAuthMiddleware } from '../../middlewares/adminAuth.middleware.js'
import { validate } from '../../middlewares/validate.middleware.js'
import { createReportSchema, moderateReportSchema, ownerRespondSchema } from './reports.validation.js'
import * as ctrl from './reports.controller.js'

export const propertyReportRouter = Router({ mergeParams: true })
propertyReportRouter.post('/', validate(createReportSchema), ctrl.submit)
propertyReportRouter.get('/mine',                authMiddleware, ctrl.ownerList)
propertyReportRouter.patch('/:reportId/respond', authMiddleware, validate(ownerRespondSchema), ctrl.ownerRespond)

export const adminReportRouter = Router()
adminReportRouter.use(adminAuthMiddleware)
adminReportRouter.get('/', ctrl.adminList)
adminReportRouter.patch('/:id/moderate', validate(moderateReportSchema), ctrl.adminModerate)
