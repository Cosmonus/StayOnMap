import { Router } from 'express'
import { authMiddleware } from '../../middlewares/auth.middleware.js'
import * as controller from './saved.controller.js'

const router = Router()

router.use(authMiddleware) // all saved routes require auth

router.get('/', controller.getMySaved)
router.post('/:propertyId', controller.saveProperty)
router.delete('/:propertyId', controller.unsaveProperty)

export default router
