import { Router } from 'express'
import { authMiddleware, optionalAuth } from '../../middlewares/auth.middleware.js'
import { requireOwner } from '../../middlewares/requireOwner.middleware.js'
import { validate } from '../../middlewares/validate.middleware.js'
import * as controller from './properties.controller.js'
import { createPropertySchema, updatePropertySchema, pinsQuerySchema } from './properties.validation.js'
import { propertyAppointmentRouter } from '../appointments/appointments.routes.js'
import { propertyReviewRouter } from '../reviews/reviews.routes.js'
import { propertyInsightRouter } from '../insights/insights.routes.js'
import { propertyReportRouter } from '../reports/reports.routes.js'
import { propertyVerificationRouter } from '../verification/verification.routes.js'

const router = Router()

// Public (optionalAuth so visibility filtering can check login state)
router.get('/',          optionalAuth, controller.listProperties)
router.get('/pins',      optionalAuth, validate(pinsQuerySchema, 'query'), controller.getPins)
router.get('/stats',     controller.getStats)
router.get('/amenities', controller.getAmenities)

// Owner-protected (must be before /:id to prevent 'mine' being matched as an id)
router.get('/mine',              authMiddleware, controller.getMyProperties)
router.get('/:id',               optionalAuth, controller.getProperty)
router.post('/',                 authMiddleware, requireOwner, validate(createPropertySchema), controller.createProperty)
router.put('/:id',               authMiddleware, validate(updatePropertySchema), controller.updateProperty)
router.delete('/:id',            authMiddleware, controller.deleteProperty)
router.patch('/:id/status',      authMiddleware, controller.togglePropertyStatus)
router.patch('/:id/publish',     authMiddleware, controller.publishProperty)
router.post('/:id/tenant',       authMiddleware, controller.markTenant)
router.delete('/:id/tenant',     authMiddleware, controller.vacateProperty)
router.get('/:id/contacts',      authMiddleware, controller.getPropertyContacts)

// Sub-resources (nested routers)
router.use('/:propertyId/appointments',  propertyAppointmentRouter)
router.use('/:propertyId/reviews',       propertyReviewRouter)
router.use('/:propertyId/insights',      propertyInsightRouter)
router.use('/:propertyId/reports',       propertyReportRouter)
router.use('/:propertyId/verification',  propertyVerificationRouter)

export default router
