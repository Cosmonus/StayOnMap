import { Router } from 'express'
import { authMiddleware } from '../../middlewares/auth.middleware.js'
import { validate } from '../../middlewares/validate.middleware.js'
import { createSavedSearchSchema } from './savedSearch.validation.js'
import * as controller from './savedSearch.controller.js'

const router = Router()

router.use(authMiddleware) // a saved search belongs to somebody by definition

router.get('/', controller.list)
router.post('/', validate(createSavedSearchSchema), controller.create)
router.delete('/:id', controller.remove)

export default router
