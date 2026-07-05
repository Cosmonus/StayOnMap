import { Router } from 'express'
import { authMiddleware } from '../../middlewares/auth.middleware.js'
import { validate } from '../../middlewares/validate.middleware.js'
import { setAvailabilitySchema } from './availability.validation.js'
import * as ctrl from './availability.controller.js'

// Mounted under /api/v1/properties/:propertyId/availability — SHORT_STAY only,
// but not restricted at the route level since ownership already scopes it.
export const propertyAvailabilityRouter = Router({ mergeParams: true })
propertyAvailabilityRouter.use(authMiddleware)
propertyAvailabilityRouter.get('/', ctrl.list)
propertyAvailabilityRouter.put('/', validate(setAvailabilitySchema), ctrl.set)
