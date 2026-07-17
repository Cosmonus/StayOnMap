import * as service from './auth.service.js'
import { ok, created } from '../../utils/response.js'

export async function register(req, res, next) {
  try {
    const result = await service.registerUser(req.body)
    if (result.waitlisted) {
      return ok(res, result, "You're on the waitlist — we'll email you when StayOnMap launches in your city.")
    }
    created(res, result)
  } catch (err) { next(err) }
}

export async function login(req, res, next) {
  try {
    const result = await service.loginUser(req.body.email, req.body.password)
    ok(res, result)
  } catch (err) { next(err) }
}

export async function forgotPassword(req, res, next) {
  try {
    await service.requestPasswordReset(req.body.email)
    ok(res, { sent: true })
  } catch (err) { next(err) }
}

export async function resetPassword(req, res, next) {
  try {
    await service.resetPassword(req.body.token, req.body.newPassword)
    ok(res, { reset: true })
  } catch (err) { next(err) }
}

export async function verifyEmail(req, res, next) {
  try {
    await service.verifyEmail(req.body.token)
    ok(res, { verified: true })
  } catch (err) { next(err) }
}

export async function sendVerification(req, res, next) {
  try {
    await service.resendVerificationEmail(req.user.id)
    ok(res, { sent: true })
  } catch (err) { next(err) }
}

export async function requestOtp(req, res, next) {
  try {
    await service.requestLoginOtp(req.body.email)
    // Always the same shape, even when no account exists — the service no-ops
    // silently for unknown emails so this response can't confirm registration.
    ok(res, { sent: true })
  } catch (err) { next(err) }
}

export async function verifyOtp(req, res, next) {
  try {
    const result = await service.verifyLoginOtp(req.body.email, req.body.code)
    ok(res, result)
  } catch (err) { next(err) }
}

export async function getMe(req, res, next) {
  try {
    const user = await service.getUserById(req.user.id)
    if (!user) return res.status(404).json({ success: false, error: 'NOT_FOUND', message: 'User not found' })
    ok(res, user)
  } catch (err) { next(err) }
}

export async function updateRole(req, res, next) {
  try {
    const user = await service.updateUserRole(req.user.id, req.body.role)
    ok(res, user)
  } catch (err) { next(err) }
}

export async function upgradeBusiness(req, res, next) {
  try {
    const user = await service.upgradeToBusiness(req.user.id)
    ok(res, user)
  } catch (err) { next(err) }
}
