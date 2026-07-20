import { Router } from 'express'
import { authMiddleware } from '../../middlewares/auth.middleware.js'
import { validate } from '../../middlewares/validate.middleware.js'
import { registerSchema, loginSchema, forgotPasswordSchema, resetPasswordSchema, verifyEmailSchema, updateRoleSchema, requestOtpSchema, verifyOtpSchema, refreshSchema, logoutSchema, oauthCompleteSchema } from './auth.validation.js'
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

// ── Sessions / refresh tokens ───────────────────────────────────────────────
// /refresh and /logout authenticate BY the refresh token itself, not the
// access JWT — an expired access token is precisely when a client needs them.
router.post('/refresh',    validate(refreshSchema), controller.refresh)
router.post('/logout',     validate(logoutSchema),  controller.logout)
router.post('/logout-all', authMiddleware,          controller.logoutAll)
router.get('/sessions',        authMiddleware, controller.listSessions)
router.delete('/sessions/:id', authMiddleware, controller.revokeSession)

// ── Social login ────────────────────────────────────────────────────────────
// Providers appear here only when their credentials are configured
// (oauth.providers.js) — the UI reads this list, so no dead buttons.
router.get('/oauth/providers', controller.oauthProviders)
router.get('/oauth/:provider', controller.oauthStart) // 302 to the provider
router.get('/oauth/:provider/callback', controller.oauthCallback) // 302 back to the frontend
router.post('/oauth/complete', validate(oauthCompleteSchema), controller.oauthComplete) // new-user city step
router.post('/oauth/:provider/link', authMiddleware, controller.oauthLinkStart)
router.delete('/oauth/:provider',    authMiddleware, controller.unlinkProvider)
router.get('/linked-accounts', authMiddleware, controller.linkedAccounts)

export default router
