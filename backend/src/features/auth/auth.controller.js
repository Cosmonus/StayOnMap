import * as service from './auth.service.js'
import * as phone from './phone.service.js'
import * as sessions from './session.service.js'
import * as oauth from './oauth.service.js'
import { enabledProviders } from './oauth.providers.js'
import { env } from '../../config/env.js'
import { ok, created } from '../../utils/response.js'
import { missingProfileFields } from '../../middlewares/requireCompleteProfile.middleware.js'

// Where sessions are born, the request's device fingerprint comes along.
const loginCtx = (req) => ({ userAgent: req.headers['user-agent'], ip: req.ip })

export async function register(req, res, next) {
  try {
    const result = await service.registerUser(req.body, loginCtx(req))
    if (result.waitlisted) {
      return ok(res, result, "You're on the waitlist — we'll email you when StayOnMap launches in your city.")
    }
    created(res, result)
  } catch (err) { next(err) }
}

export async function login(req, res, next) {
  try {
    const result = await service.loginUser(req.body.email, req.body.password, loginCtx(req))
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
    const result = await service.verifyLoginOtp(req.body.email, req.body.code, loginCtx(req))
    ok(res, result)
  } catch (err) { next(err) }
}

// ── Phone verification (authenticated — you verify your own number) ─────────

export async function requestPhoneCode(req, res, next) {
  try {
    ok(res, await phone.requestPhoneOtp(req.user.id, req.body.phone))
  } catch (err) { next(err) }
}

export async function verifyPhoneCode(req, res, next) {
  try {
    ok(res, await phone.verifyPhoneOtp(req.user.id, req.body.code))
  } catch (err) { next(err) }
}

// ── Sessions / refresh ──────────────────────────────────────────────────────

export async function refresh(req, res, next) {
  try {
    ok(res, await sessions.refreshSession(req.body.refreshToken))
  } catch (err) { next(err) }
}

export async function logout(req, res, next) {
  try {
    if (req.body.refreshToken) await sessions.revokeSessionByToken(req.body.refreshToken)
    ok(res, { loggedOut: true }) // best-effort — the client drops its copy regardless
  } catch (err) { next(err) }
}

export async function logoutAll(req, res, next) {
  try {
    await sessions.revokeAllSessions(req.user.id)
    ok(res, { loggedOut: true })
  } catch (err) { next(err) }
}

export async function listSessions(req, res, next) {
  try {
    ok(res, await sessions.listSessions(req.user.id))
  } catch (err) { next(err) }
}

export async function revokeSession(req, res, next) {
  try {
    await sessions.revokeSessionById(req.user.id, req.params.id)
    ok(res, { revoked: true })
  } catch (err) { next(err) }
}

// ── Social login ────────────────────────────────────────────────────────────

export function oauthProviders(req, res) {
  ok(res, enabledProviders())
}

export async function oauthStart(req, res, next) {
  try {
    const { redirectUrl } = await oauth.beginOAuth(req.params.provider, {
      purpose: 'login',
      // ?platform=mobile → the callback lands in the app's deep link instead
      // of the web page. Only the flag travels — both destinations are
      // hardcoded server-side, never a client-supplied URL.
      platform: req.query.platform === 'mobile' ? 'mobile' : 'web',
    })
    res.redirect(redirectUrl)
  } catch (err) { next(err) }
}

// Link begins as a POST (it needs the Authorization header, which a browser
// navigation can't carry) and returns the provider URL for the client to visit.
export async function oauthLinkStart(req, res, next) {
  try {
    const { redirectUrl } = await oauth.beginOAuth(req.params.provider, {
      purpose: 'link',
      userId: req.user.id,
      platform: (req.body?.platform ?? req.query.platform) === 'mobile' ? 'mobile' : 'web',
    })
    ok(res, { redirectUrl })
  } catch (err) { next(err) }
}

// The provider lands the browser here. Results travel in the URL FRAGMENT —
// fragments never reach server logs or Referer headers. Where they land is
// decided by the platform flag signed into the state at begin time: the web
// page, or the mobile app's deep link.
const MOBILE_OAUTH_TARGET = 'stayonmap://oauth-complete'

export async function oauthCallback(req, res) {
  const targetFor = (platform) =>
    platform === 'mobile' ? MOBILE_OAUTH_TARGET : `${env.frontendUrl}/oauth-complete`
  try {
    const result = await oauth.handleCallback(req.params.provider, req.query, loginCtx(req))
    const target = targetFor(result.platform)
    if (result.login) {
      const { token, refreshToken } = result.login
      return res.redirect(`${target}#token=${encodeURIComponent(token)}&refresh=${encodeURIComponent(refreshToken)}`)
    }
    if (result.linked) {
      return res.redirect(`${target}#linked=${encodeURIComponent(result.linked)}`)
    }
    return res.redirect(`${target}#pending=${encodeURIComponent(result.pending)}&name=${encodeURIComponent(result.name ?? '')}`)
  } catch (err) {
    const message = err.statusCode && err.statusCode < 500 ? err.message : 'Sign-in was not completed. Please try again.'
    return res.redirect(`${targetFor(err.oauthPlatform)}#error=${encodeURIComponent(message)}`)
  }
}

export async function oauthComplete(req, res, next) {
  try {
    const result = await oauth.completeOAuthSignup(req.body.token, req.body.city, loginCtx(req))
    if (result.waitlisted) {
      return ok(res, result, "You're on the waitlist — we'll email you when StayOnMap launches in your city.")
    }
    ok(res, result.login)
  } catch (err) { next(err) }
}

export async function linkedAccounts(req, res, next) {
  try {
    ok(res, await oauth.listLinkedAccounts(req.user.id))
  } catch (err) { next(err) }
}

export async function unlinkProvider(req, res, next) {
  try {
    await oauth.unlinkProvider(req.user.id, req.params.provider)
    ok(res, { unlinked: true })
  } catch (err) { next(err) }
}

export async function getMe(req, res, next) {
  try {
    const user = await service.getUserById(req.user.id)
    if (!user) return res.status(404).json({ success: false, error: 'NOT_FOUND', message: 'User not found' })
    // `profileComplete` / `missingProfileFields` mirror the requireCompleteProfile
    // middleware that gates POST /properties, computed from the same function so
    // the two can't disagree. The client needs this BEFORE the wizard, not as a
    // 403 after someone has filled in an entire listing.
    const missing = missingProfileFields(user)
    ok(res, { ...user, profileComplete: missing.length === 0, missingProfileFields: missing })
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
