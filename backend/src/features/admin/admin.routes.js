import { Router } from 'express'
import { adminAuthMiddleware } from '../../middlewares/adminAuth.middleware.js'
import { validate } from '../../middlewares/validate.middleware.js'
import {
  adminLoginSchema, adminChangePasswordSchema, adminPinsQuerySchema,
  adminPropertiesQuerySchema, adminPropertyStatusSchema,
  adminBlockUserSchema, adminReviewStatusSchema, adminAmenitySchema,
  adminUpdateProfileSchema,
} from './admin.validation.js'
import { funnelQuerySchema } from '../analytics/analytics.validation.js'
import { strictLimiter } from '../../middlewares/rateLimit.middleware.js'
import * as ctrl from './admin.controller.js'

const router = Router()

// Public — strict rate limit on login only
router.post('/login', strictLimiter, validate(adminLoginSchema), ctrl.login)

// Protected
router.use(adminAuthMiddleware)
router.get('/analytics', ctrl.analytics)
// `days` reaches date-range queries that scan AnalyticsEvent and a message log.
// Unvalidated it was `Number(req.query.days)`: "?days=abc" became NaN, then an
// Invalid Date, then a 500 — and a huge value was an unbounded scan anyone with
// an admin session could trigger from the address bar. funnelQuerySchema has
// existed for exactly this since the funnel shipped and had zero importers
// until 2026-08-10; `marketplace` had hand-rolled the same clamp three lines
// away, which is what made the gap in its two neighbours easy to miss.
router.get('/analytics/funnel', validate(funnelQuerySchema, 'query'), ctrl.funnel)
router.get('/analytics/demand', validate(funnelQuerySchema, 'query'), ctrl.demand)
router.get('/analytics/marketplace', validate(funnelQuerySchema, 'query'), ctrl.marketplace)
router.get('/waitlist', ctrl.waitlist)
router.get('/users', ctrl.users)
router.get('/users/:userId', ctrl.userDetail)
router.patch('/users/:userId/block', validate(adminBlockUserSchema), ctrl.blockUser)
router.get('/properties', validate(adminPropertiesQuerySchema, 'query'), ctrl.properties)
router.get('/properties/pins', validate(adminPinsQuerySchema, 'query'), ctrl.adminPins)
router.get('/properties/:id', ctrl.propertyById)
// Approve / pause / reject only — see ADMIN_PROPERTY_STATUSES. There is
// deliberately no POST or DELETE for a property on the admin router: a
// listing is created and deleted by its owner, and an admin's power over it
// is to pause it, not to remove it.
router.patch('/properties/:id/status', validate(adminPropertyStatusSchema), ctrl.setPropertyStatus)
router.get('/reviews', ctrl.getReviews)
router.patch('/reviews/:id/status', validate(adminReviewStatusSchema), ctrl.moderateReview)
router.get('/logs', ctrl.activityLogs)
router.get('/monitor', ctrl.getMonitorStatus)
// Read-only: the latest ETL run per dataset. There is no write side by
// design — a quality report is a record of what a seeder observed, and an
// operator editing it would defeat the point of keeping it.
router.get('/data-quality', ctrl.getDataQuality)
router.get('/profile', ctrl.getProfile)
router.patch('/profile', validate(adminUpdateProfileSchema), ctrl.updateProfile)
router.patch('/profile/password', validate(adminChangePasswordSchema), ctrl.changePassword)
router.get('/amenities', ctrl.getAmenities)
router.post('/amenities', validate(adminAmenitySchema), ctrl.addAmenity)
router.delete('/amenities/:id', ctrl.removeAmenity)

export default router
