// Social login providers, as data — oauth.service.js is one generic OIDC flow
// over this table.
//
// GOOGLE ONLY, by product decision (2026-07-20): the platform offers exactly
// three ways in — password, emailed sign-in code, and Google. Facebook/
// LinkedIn/X were built and then removed the same day; the AuthProvider enum
// keeps their values (enum removal is a hostile migration for zero gain) and
// the generic flow would take a new provider back as one config block here.
//
// `profile()` normalises userinfo into { id, email, emailVerified, name,
// avatarUrl } with two rules downstream code relies on:
//   - `id` is the provider's STABLE subject id, never an email.
//   - `emailVerified` is true only when the PROVIDER asserts it — auto-linking
//     onto an existing account by email is a takeover unless the provider
//     vouched for that email. (Google can omit email if the user denies the
//     scope — the no-email path in oauth.service.js stays load-bearing.)
import { env } from '../../config/env.js'

export const PROVIDERS = {
  google: {
    key: 'google',
    enum: 'GOOGLE',
    label: 'Google',
    authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    userinfoUrl: 'https://openidconnect.googleapis.com/v1/userinfo',
    scope: 'openid email profile',
    pkce: true,
    profile: (d) => ({
      id: d.sub,
      email: d.email ?? null,
      emailVerified: d.email_verified === true,
      name: d.name ?? null,
      avatarUrl: d.picture ?? null,
    }),
  },
}

export function getProvider(key) {
  const p = PROVIDERS[key]
  const creds = env.oauth[key]
  if (!p || !creds?.clientId || !creds?.clientSecret) return null
  return { ...p, clientId: creds.clientId, clientSecret: creds.clientSecret }
}

/** Providers with credentials configured — what the login UI may render. */
export function enabledProviders() {
  return Object.keys(PROVIDERS)
    .map((key) => getProvider(key))
    .filter(Boolean)
    .map((p) => ({ key: p.key, label: p.label, canSignup: p.signup !== false }))
}
