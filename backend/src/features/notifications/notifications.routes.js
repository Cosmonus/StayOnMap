import { Router } from 'express'
import { authMiddleware } from '../../middlewares/auth.middleware.js'
import * as ctrl from './notifications.controller.js'

const router = Router()
router.use(authMiddleware)
router.get('/', ctrl.list)
router.patch('/read-all', ctrl.markAll)
router.patch('/:id/read', ctrl.markOne)

export default router
