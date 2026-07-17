import { Router } from 'express'
import { authMiddleware } from '../../middlewares/auth.middleware.js'
import { validate } from '../../middlewares/validate.middleware.js'
import { registerSchema, loginSchema, forgotPasswordSchema, resetPasswordSchema, verifyEmailSchema, updateRoleSchema, requestOtpSchema, verifyOtpSchema } from './auth.validation.js'
import * as controller from './auth.controller.js'

const router = Router()

router.post('/register',        validate(registerSchema),       controller.register)
router.post('/login',           validate(loginSchema),          controller.login)
router.post('/forgot-password', validate(forgotPasswordSchema), controller.forgotPassword)
router.post('/reset-password',  validate(resetPasswordSchema),  controller.resetPassword)
router.post('/verify-email',    validate(verifyEmailSchema),    controller.verifyEmail)

// Passwordless login. The whole /auth router already carries strictLimiter
// (20 req/15min per IP, see index.js); the per-EMAIL cooldown and daily cap
// live in the service, because an IP limit alone doesn't stop a distributed
// caller from draining the shared SMTP quota.
router.post('/otp/request', validate(requestOtpSchema), controller.requestOtp)
router.post('/otp/verify',  validate(verifyOtpSchema),  controller.verifyOtp)

router.post('/send-verification', authMiddleware, controller.sendVerification)

router.get('/me', authMiddleware, controller.getMe)
router.patch('/role', authMiddleware, validate(updateRoleSchema), controller.updateRole)
router.patch('/business', authMiddleware, controller.upgradeBusiness)

export default router
