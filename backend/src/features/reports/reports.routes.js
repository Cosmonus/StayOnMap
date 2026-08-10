import { Router } from 'express'
import { authMiddleware, optionalAuth } from '../../middlewares/auth.middleware.js'
import { adminAuthMiddleware } from '../../middlewares/adminAuth.middleware.js'
import { validate } from '../../middlewares/validate.middleware.js'
import { strictLimiter } from '../../middlewares/rateLimit.middleware.js'
import { createReportSchema, moderateReportSchema, ownerRespondSchema, reportMessageSchema } from './reports.validation.js'
import * as ctrl from './reports.controller.js'

export const propertyReportRouter = Router({ mergeParams: true })
// Public by design (anonymous fraud reports are intentional), but rate-limited,
// and optionalAuth so a logged-in reporter is actually recorded as one — the
// controller reads req.user?.id, which was always undefined without this.
propertyReportRouter.post('/', strictLimiter, optionalAuth, validate(createReportSchema), ctrl.submit)
propertyReportRouter.get('/mine',                authMiddleware, ctrl.ownerList)
propertyReportRouter.patch('/:reportId/respond', authMiddleware, validate(ownerRespondSchema), ctrl.ownerRespond)

/**
 * The reporter's own reports, addressed by REPORT id rather than nested under a
 * property.
 *
 * A separate top-level router because the reporter reaches this from a
 * notification, which carries `referenceId` — the report — and not the property
 * it was about. Nesting it under `/properties/:propertyId/reports` would make
 * the client reconstruct a path from an id it was never given.
 *
 * Mounted at `/api/v1/reports`. Everything here is scoped to the caller's own
 * reports inside the service; there is no list endpoint and no owner path.
 */
export const reportThreadRouter = Router()
reportThreadRouter.use(authMiddleware)
reportThreadRouter.get('/:reportId/messages', ctrl.reporterThread)
// strictLimiter: user-generated content on a moderation surface, the same gate
// the report itself goes through.
reportThreadRouter.post('/:reportId/messages', strictLimiter, validate(reportMessageSchema), ctrl.reporterReply)

export const adminReportRouter = Router()
adminReportRouter.use(adminAuthMiddleware)
adminReportRouter.get('/', ctrl.adminList)
// Before `/:id/...`, or "awaiting" is read as a report id.
adminReportRouter.get('/awaiting', ctrl.adminAwaiting)
adminReportRouter.get('/:id/messages', ctrl.adminThread)
adminReportRouter.post('/:id/messages', validate(reportMessageSchema), ctrl.adminReply)
adminReportRouter.patch('/:id/moderate', validate(moderateReportSchema), ctrl.adminModerate)
