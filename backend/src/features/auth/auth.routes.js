import { Router } from 'express'
import { authMiddleware } from '../../middlewares/auth.middleware.js'
import { validate } from '../../middlewares/validate.middleware.js'
import { registerSchema, loginSchema, forgotPasswordSchema, resetPasswordSchema, updateRoleSchema } from './auth.validation.js'
import * as controller from './auth.controller.js'

const router = Router()

router.post('/register',        validate(registerSchema),       controller.register)
router.post('/login',           validate(loginSchema),          controller.login)
router.post('/forgot-password', validate(forgotPasswordSchema), controller.forgotPassword)
router.post('/reset-password',  validate(resetPasswordSchema),  controller.resetPassword)

router.get('/me', authMiddleware, controller.getMe)
router.patch('/role', authMiddleware, validate(updateRoleSchema), controller.updateRole)

export default router
