import { Router } from 'express'
import { adminAuthMiddleware } from '../../middlewares/adminAuth.middleware.js'
import { validate } from '../../middlewares/validate.middleware.js'
import { adminLoginSchema, adminChangePasswordSchema } from './admin.validation.js'
import { strictLimiter } from '../../middlewares/rateLimit.middleware.js'
import * as ctrl from './admin.controller.js'

const router = Router()

// Public — strict rate limit on login only
router.post('/login', strictLimiter, validate(adminLoginSchema), ctrl.login)

// Protected
router.use(adminAuthMiddleware)
router.get('/analytics', ctrl.analytics)
router.get('/waitlist', ctrl.waitlist)
router.get('/users', ctrl.users)
router.get('/users/:userId', ctrl.userDetail)
router.patch('/users/:userId/block', ctrl.blockUser)
router.get('/properties', ctrl.properties)
router.get('/properties/pins', ctrl.adminPins)
router.get('/properties/:id', ctrl.propertyById)
router.patch('/properties/:id/status', ctrl.setPropertyStatus)
router.get('/moderation/queue', ctrl.moderationQueue)
router.get('/reviews', ctrl.getReviews)
router.patch('/reviews/:id/status', ctrl.moderateReview)
router.get('/logs', ctrl.activityLogs)
router.get('/monitor', ctrl.getMonitorStatus)
router.get('/profile', ctrl.getProfile)
router.patch('/profile', ctrl.updateProfile)
router.patch('/profile/password', validate(adminChangePasswordSchema), ctrl.changePassword)
router.get('/amenities', ctrl.getAmenities)
router.post('/amenities', ctrl.addAmenity)
router.delete('/amenities/:id', ctrl.removeAmenity)

export default router
