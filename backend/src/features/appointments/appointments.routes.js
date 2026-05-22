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
propertyAppointmentRouter.get('/', ctrl.forProperty)
