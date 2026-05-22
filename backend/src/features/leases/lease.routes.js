import { Router } from 'express'
import { authMiddleware } from '../../middlewares/auth.middleware.js'
import { validate } from '../../middlewares/validate.middleware.js'
import { createLeaseSchema, signLeaseSchema, terminateLeaseSchema } from './lease.validation.js'
import * as ctrl from './lease.controller.js'

const router = Router()
router.use(authMiddleware)

router.get('/',                         ctrl.getMine)
router.get('/:id',                      ctrl.getById)
router.post('/property/:propertyId',    validate(createLeaseSchema), ctrl.create)
router.patch('/:id/sign',               validate(signLeaseSchema), ctrl.sign)
router.patch('/:id/reject',             validate(signLeaseSchema), ctrl.reject)
router.patch('/:id/terminate',          validate(terminateLeaseSchema), ctrl.terminate)

export default router
