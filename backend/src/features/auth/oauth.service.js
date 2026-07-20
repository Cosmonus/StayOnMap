// Social login — one generic OAuth 2.0 / OIDC flow over oauth.providers.js.
//
// The rules that keep this from creating duplicate or stolen accounts:
//
//   1. Identity is (provider, providerUserId), never the email. An email is
//      only used ONCE — to attach a first-time social login onto an existing
//      account — and only when the provider asserts it verified that email.
//      Auto-linking on an UNVERIFIED provider email would let anyone who can
//      type a victim's address into a provider signup take the account over.
//   2. A provider that shares no email (X, phone-only Facebook) can sign in
//      to an account it is already linked to, but can never START one:
//      no email means no dedupe key, which means guaranteed duplicates.
//   3. A brand-new social user does NOT get an account straight from the
//      callback — they get a short-lived signed "pending signup" token and
//      pick their city first, because signup is city-gated (waitlist) and
//      social login must not become a side door around it.
import crypto from 'crypto'
import jwt from 'jsonwebtoken'
import { prisma } from '../../lib/prisma.js'
import { env } from '../../config/env.js'
import { cacheGet, cacheSet, cacheDel, redis } from '../../lib/redis.js'
import { generateUserDisplayId } from '../../utils/idGenerator.js'
import { sendEmail, accountLinkedEmail } from '../../services/email.service.js'
import { SUPPORTED_CITIES } from '../../config/cities.js'
import { getProvider, PROVIDERS } from './oauth.providers.js'
import { signUserToken, stripPasswordHash } from './tokens.js'
import { issueSession } from './session.service.js'

// Derived secret: a pending-signup token must never verify as a login token.
const PENDING_SIGNUP_SECRET = `${env.jwtSecret}:oauth-pending-signup`
const STATE_TTL_S = 10 * 60

const badRequest = (message) => Object.assign(new Error(message), { statusCode: 400 })

const callbackUrl = (provider) =>
  `${env.apiPublicUrl}/api/v1/auth/oauth/${provider.key}/callback`

// ── State store — Redis when available (multi-instance safe), in-memory Map
// otherwise (dev runs without Redis by design). Single-use either way.
const memStates = new Map()

async function putState(nonce, data) {
  if (redis) return cacheSet(`oauth:state:${nonce}`, data, STATE_TTL_S)
  memStates.set(nonce, { data, expiresAt: Date.now() + STATE_TTL_S * 1000 })
  // Opportunistic sweep so an abandoned dev process doesn't accumulate entries.
  if (memStates.size > 1000) {
    for (const [k, v] of memStates) if (v.expiresAt < Date.now()) memStates.delete(k)
  }
}

async function popState(nonce) {
  if (redis) {
    const data = await cacheGet(`oauth:state:${nonce}`)
    if (data) await cacheDel(`oauth:state:${nonce}`)
    return data
  }
  const entry = memStates.get(nonce)
  memStates.delete(nonce)
  return entry && entry.expiresAt > Date.now() ? entry.data : null
}

// ── Begin: build the provider redirect ──────────────────────────────────────

/**
 * @param {string} providerKey
 * @param {{ purpose: 'login'|'link', userId?: string, platform?: 'web'|'mobile' }} opts —
 *   `link` carries the already-authenticated user the callback should attach
 *   to; `platform` picks where the callback lands the result (the web app or
 *   the mobile deep link). It rides in the SIGNED state, never as a
 *   client-supplied redirect URL — both destinations are hardcoded server-side.
 */
export async function beginOAuth(providerKey, { purpose = 'login', userId = null, platform = 'web' } = {}) {
  const provider = getProvider(providerKey)
  if (!provider) throw badRequest('This sign-in method is not available')

  const nonce = crypto.randomBytes(24).toString('hex')
  const state = { provider: provider.key, purpose, userId, platform: platform === 'mobile' ? 'mobile' : 'web' }

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: provider.clientId,
    redirect_uri: callbackUrl(provider),
    scope: provider.scope,
    state: nonce,
  })

  if (provider.pkce) {
    const verifier = crypto.randomBytes(32).toString('base64url')
    const challenge = crypto.createHash('sha256').update(verifier).digest('base64url')
    params.set('code_challenge', challenge)
    params.set('code_challenge_method', 'S256')
    state.verifier = verifier
  }

  await putState(nonce, state)
  return { redirectUrl: `${provider.authUrl}?${params.toString()}` }
}

// ── Token + profile exchange ────────────────────────────────────────────────

async function exchangeCode(provider, code, verifier) {
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: callbackUrl(provider),
    client_id: provider.clientId,
  })
  if (verifier) body.set('code_verifier', verifier)

  const headers = { 'Content-Type': 'application/x-www-form-urlencoded' }
  if (provider.basicAuth) {
    headers.Authorization =
      'Basic ' + Buffer.from(`${provider.clientId}:${provider.clientSecret}`).toString('base64')
  } else {
    body.set('client_secret', provider.clientSecret)
  }

  const res = await fetch(provider.tokenUrl, { method: 'POST', headers, body })
  const data = await res.json().catch(() => ({}))
  if (!res.ok || !data.access_token) {
    throw badRequest('Sign-in was not completed. Please try again.')
  }
  return data.access_token
}

async function fetchProfile(provider, accessToken) {
  const res = await fetch(provider.userinfoUrl, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw badRequest('Sign-in was not completed. Please try again.')

  const profile = provider.profile(data)
  if (!profile.id) throw badRequest('Sign-in was not completed. Please try again.')
  return profile
}

// ── Callback ────────────────────────────────────────────────────────────────

async function loginExistingUser(user, ctx) {
  if (user.isBlocked) {
    throw Object.assign(new Error('This account has been blocked'), { statusCode: 403 })
  }
  const refreshToken = await issueSession(user.id, ctx)
  return { token: signUserToken(user), refreshToken, user: stripPasswordHash(user) }
}

/**
 * Handle the provider redirect. Returns one of:
 *   { login: { token, refreshToken, user } }  — signed in
 *   { linked: providerLabel }                 — provider attached to userId
 *   { pending: jwt, name }                    — new user, needs the city step
 */
export async function handleCallback(providerKey, { code, state: nonce }, ctx = {}) {
  const provider = getProvider(providerKey)
  if (!provider) throw badRequest('This sign-in method is not available')
  if (!code || !nonce) throw badRequest('Sign-in was cancelled')

  const state = await popState(String(nonce))
  if (!state || state.provider !== provider.key) {
    throw badRequest('This sign-in attempt expired — please try again')
  }
  const platform = state.platform ?? 'web'

  try {
    return { platform, ...(await resolveCallback(provider, state, code, ctx)) }
  } catch (err) {
    // The controller needs the platform even on failure — a mobile user's
    // error must land back in the app, not on the web page.
    err.oauthPlatform = platform
    throw err
  }
}

async function resolveCallback(provider, state, code, ctx) {
  const accessToken = await exchangeCode(provider, String(code), state.verifier)
  const profile = await fetchProfile(provider, accessToken)

  const linked = await prisma.socialAccount.findUnique({
    where: { provider_providerUserId: { provider: provider.enum, providerUserId: profile.id } },
    include: { user: true },
  })

  if (state.purpose === 'link') {
    return { linked: await linkToUser(provider, profile, state.userId, linked) }
  }

  // Already linked → plain login.
  if (linked) return { login: await loginExistingUser(linked.user, ctx) }

  // First time we see this identity. A provider-verified email may attach it
  // to the existing account with that address (this is what makes "signed up
  // with Google, later clicked LinkedIn" one account, not two).
  if (profile.email) {
    const existing = await prisma.user.findUnique({ where: { email: profile.email } })
    if (existing) {
      if (!profile.emailVerified) {
        throw badRequest(
          `An account with this email already exists. Sign in to it, then connect ${provider.label} under Settings → Linked accounts.`
        )
      }
      await prisma.socialAccount.create({
        data: {
          userId: existing.id,
          provider: provider.enum,
          providerUserId: profile.id,
          providerEmail: profile.email,
          avatarUrl: profile.avatarUrl,
        },
      })
      sendEmail({ to: existing.email, ...accountLinkedEmail({ name: existing.name, providerLabel: provider.label }) })
      return { login: await loginExistingUser(existing, ctx) }
    }
  }

  // Genuinely new person. No email → no dedupe key → refuse to start an
  // account (rule 2 above) rather than mint a duplicate-prone one.
  if (!profile.email) {
    throw badRequest(
      `${provider.label} did not share an email address. Sign up with email or Google first, then connect ${provider.label} under Settings → Linked accounts.`
    )
  }

  const pending = jwt.sign(
    {
      purpose: 'oauth_signup',
      provider: provider.enum,
      providerUserId: profile.id,
      email: profile.email,
      emailVerified: profile.emailVerified,
      name: profile.name,
      avatarUrl: profile.avatarUrl,
    },
    PENDING_SIGNUP_SECRET,
    { expiresIn: '15m' }
  )
  return { pending, name: profile.name }
}

async function linkToUser(provider, profile, userId, existingLink) {
  if (!userId) throw badRequest('This sign-in attempt expired — please try again')

  if (existingLink) {
    if (existingLink.userId === userId) return provider.label // idempotent
    throw Object.assign(
      new Error(`That ${provider.label} account is already connected to a different StayOnMap account`),
      { statusCode: 409 }
    )
  }

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true, name: true } })
  if (!user) throw badRequest('This sign-in attempt expired — please try again')

  await prisma.socialAccount.create({
    data: {
      userId,
      provider: provider.enum,
      providerUserId: profile.id,
      providerEmail: profile.email,
      avatarUrl: profile.avatarUrl,
    },
  })
  sendEmail({ to: user.email, ...accountLinkedEmail({ name: user.name, providerLabel: provider.label }) })
  return provider.label
}

// ── Complete a social signup (the city step) ────────────────────────────────

export async function completeOAuthSignup(pendingToken, city, ctx = {}) {
  let payload
  try {
    payload = jwt.verify(pendingToken, PENDING_SIGNUP_SECRET)
  } catch {
    throw badRequest('This sign-up session expired — please sign in again')
  }
  if (payload.purpose !== 'oauth_signup') throw badRequest('This sign-up session expired — please sign in again')

  // Same gate as password signup: unsupported city → waitlist, no account.
  if (!SUPPORTED_CITIES.includes(city)) {
    await prisma.waitlistEntry.create({
      data: { name: payload.name ?? payload.email, email: payload.email, city },
    })
    return { waitlisted: true }
  }

  // The identity or email may have been claimed between callback and now
  // (double-submit, second tab) — re-check both and fall through to login
  // where that's the honest answer.
  const claimed = await prisma.socialAccount.findUnique({
    where: { provider_providerUserId: { provider: payload.provider, providerUserId: payload.providerUserId } },
    include: { user: true },
  })
  if (claimed) return { login: await loginExistingUser(claimed.user, ctx) }

  const emailTaken = await prisma.user.findUnique({ where: { email: payload.email } })
  if (emailTaken) {
    throw badRequest('An account with this email already exists — sign in to it instead.')
  }

  const user = await prisma.user.create({
    data: {
      displayId: generateUserDisplayId(payload.name ?? payload.email, payload.email),
      email: payload.email,
      name: payload.name ?? payload.email.split('@')[0],
      city,
      passwordHash: null, // social-only — the password-reset flow can set one later
      avatarUrl: payload.avatarUrl,
      isVerified: Boolean(payload.emailVerified), // the provider vouched for the inbox
      socialAccounts: {
        create: {
          provider: payload.provider,
          providerUserId: payload.providerUserId,
          providerEmail: payload.email,
          avatarUrl: payload.avatarUrl,
        },
      },
    },
  })

  return { login: await loginExistingUser(user, ctx) }
}

// ── Linked-accounts management ──────────────────────────────────────────────

export async function listLinkedAccounts(userId) {
  const [accounts, user] = await Promise.all([
    prisma.socialAccount.findMany({
      where: { userId },
      select: { provider: true, providerEmail: true, linkedAt: true },
    }),
    prisma.user.findUnique({ where: { id: userId }, select: { passwordHash: true } }),
  ])
  return {
    accounts,
    hasPassword: Boolean(user?.passwordHash),
  }
}

export async function unlinkProvider(userId, providerKey) {
  // PROVIDERS, not getProvider(): disconnecting must keep working even if the
  // provider's credentials are later removed from the environment.
  const providerEnum = PROVIDERS[providerKey]?.enum
  if (!providerEnum) throw badRequest('Unknown provider')

  const [user, socialCount] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { passwordHash: true } }),
    prisma.socialAccount.count({ where: { userId } }),
  ])

  // The guard this whole feature hangs on: never remove the last way in.
  const methodsAfterUnlink = (user?.passwordHash ? 1 : 0) + socialCount - 1
  if (methodsAfterUnlink < 1) {
    throw badRequest(
      'This is your only way to sign in. Set a password first (use "Forgot password" from the login screen), then disconnect it.'
    )
  }

  const { count } = await prisma.socialAccount.deleteMany({
    where: { userId, provider: providerEnum },
  })
  if (count === 0) throw Object.assign(new Error('Not linked'), { statusCode: 404 })
}
