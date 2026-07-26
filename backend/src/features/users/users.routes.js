import { Router } from 'express'
import { authMiddleware } from '../../middlewares/auth.middleware.js'
import * as controller from './users.controller.js'

const router = Router()

router.get('/profile',         authMiddleware, controller.getProfile)
router.put('/profile',         authMiddleware, controller.updateProfile)
router.get('/settings',        authMiddleware, controller.getSettings)
router.get('/account-summary', authMiddleware, controller.getAccountSummary)
router.post('/change-password', authMiddleware, controller.changePassword)
router.delete('/account',      authMiddleware, controller.deleteAccount)

export default router
