import { Router } from 'express'
import { authMiddleware } from '../../middlewares/auth.middleware.js'
import * as controller from './auth.controller.js'

const router = Router()

router.post('/sync', authMiddleware, controller.syncProfile)  // called after Supabase signup
router.get('/me', authMiddleware, controller.getMe)
router.patch('/role', authMiddleware, controller.updateRole)

export default router
