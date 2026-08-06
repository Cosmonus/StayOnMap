import { Router } from 'express'
import { authMiddleware } from '../../middlewares/auth.middleware.js'
import { validate } from '../../middlewares/validate.middleware.js'
import { createAppointmentSchema, updateStatusSchema } from './appointments.validation.js'
import * as ctrl from './appointments.controller.js'

const router = Router()
router.use(authMiddleware)
router.get('/mine', ctrl.mine)
router.get('/owner', ctrl.ownerAppointments)
router.patch('/:id/status', validate(updateStatusSchema), ctrl.updateStatus)

export default router

// Mounted at /api/v1/properties/:propertyId/appointments by property router
export const propertyAppointmentRouter = Router({ mergeParams: true })
propertyAppointmentRouter.use(authMiddleware)
propertyAppointmentRouter.post('/', validate(createAppointmentSchema), ctrl.create)
// Before '/' so the literal path can never be read as a param. Any signed-in
// renter may read it — it is the dates they are allowed to ask for, and it
// carries no times, counts or identities.
propertyAppointmentRouter.get('/availability', ctrl.availability)
propertyAppointmentRouter.get('/', ctrl.forProperty)
