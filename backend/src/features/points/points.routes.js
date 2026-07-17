import { Router } from 'express'
import { authMiddleware } from '../../middlewares/auth.middleware.js'
import * as controller from './points.controller.js'

const router = Router()

router.use(authMiddleware) // your points are yours alone

router.get('/', controller.getMyPoints)

export default router
