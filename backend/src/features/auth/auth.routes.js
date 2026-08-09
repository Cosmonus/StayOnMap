import { Router } from 'express'
import { authMiddleware } from '../../middlewares/auth.middleware.js'
import { validate } from '../../middlewares/validate.middleware.js'
import { strictLimiter } from '../../middlewares/rateLimit.middleware.js'
import { registerSchema, loginSchema, forgotPasswordSchema, resetPasswordSchema, verifyEmailSchema, updateRoleSchema, requestOtpSchema, verifyOtpSchema, refreshSchema, logoutSchema, oauthCompleteSchema, requestPhoneCodeSchema, verifyPhoneCodeSchema, phoneLoginRequestSchema, phoneLoginVerifySchema } from './auth.validation.js'
import * as controller from './auth.controller.js'

const router = Router()

// strictLimiter (20 req/15min per IP) is applied PER-ROUTE, on the password /
// account-guessing and email-sending surfaces only — NOT on the whole router.
// It used to blanket-cover /auth (index.js), which meant the automated,
// legitimate calls (/me on every page load, /refresh on token rotation) shared
// the tiny 20-req anti-brute-force bucket; a burst drained it and then real
// logins 429'd — and a 429 on /me logged the user out. Those endpoints now ride
// the global defaultLimiter (600/15min) instead.
router.post('/register',        strictLimiter, validate(registerSchema),       controller.register)
router.post('/login',           strictLimiter, validate(loginSchema),          controller.login)
router.post('/forgot-password', strictLimiter, validate(forgotPasswordSchema), controller.forgotPassword)
router.post('/reset-password',  strictLimiter, validate(resetPasswordSchema),  controller.resetPassword)
router.post('/verify-email',    validate(verifyEmailSchema),    controller.verifyEmail)

// Passwordless login. strictLimiter here is per-IP; the per-EMAIL cooldown and
// daily cap live in the service, because an IP limit alone doesn't stop a
// distributed caller from draining the shared SMTP quota.
router.post('/otp/request', strictLimiter, validate(requestOtpSchema), controller.requestOtp)
router.post('/otp/verify',  strictLimiter, validate(verifyOtpSchema),  controller.verifyOtp)

// Sends an email → keep it on the tight bucket to protect the mail quota.
router.post('/send-verification', strictLimiter, authMiddleware, controller.sendVerification)

// Phone verification. Authenticated, so there is no account-enumeration angle —
// but the DESTINATION is caller-supplied, which the email flows never are, so
// strictLimiter guards the spend and phone.service.js adds a per-user cooldown,
// a per-user daily cap AND a per-destination daily cap. The last one is what
// stops this being an on-demand way to text a number you don't own.
router.post('/phone/request', strictLimiter, authMiddleware, validate(requestPhoneCodeSchema), controller.requestPhoneCode)
router.post('/phone/verify',  strictLimiter, authMiddleware, validate(verifyPhoneCodeSchema),  controller.verifyPhoneCode)

// Signing IN by SMS. PUBLIC, unlike the two above — there is no session yet.
// strictLimiter plus phone.service.js's cooldown and two daily caps; and the
// service will only ever text a number somebody has already VERIFIED, so this
// cannot be used to send a message to an arbitrary phone.
router.post('/phone/login/request', strictLimiter, validate(phoneLoginRequestSchema), controller.requestPhoneLoginCode)
router.post('/phone/login/verify',  strictLimiter, validate(phoneLoginVerifySchema),  controller.verifyPhoneLoginCode)

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
