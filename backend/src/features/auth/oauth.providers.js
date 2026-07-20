// The four social-login providers, as data. Everything provider-specific —
// endpoints, scopes, PKCE, how to read the profile — lives in this table so
// oauth.service.js is one generic OAuth 2.0 / OIDC flow, not four.
//
// `profile()` normalises each provider's userinfo into:
//   { id, email, emailVerified, name, avatarUrl }
// with two hard rules downstream code relies on:
//   - `id` is the provider's STABLE subject id, never an email.
//   - `emailVerified` is true only when the PROVIDER asserts it. Auto-linking
//     a social login onto an existing account by email is an account takeover
//     unless the provider vouched for that email.
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

  facebook: {
    key: 'facebook',
    enum: 'FACEBOOK',
    label: 'Facebook',
    authUrl: 'https://www.facebook.com/v19.0/dialog/oauth',
    tokenUrl: 'https://graph.facebook.com/v19.0/oauth/access_token',
    userinfoUrl: 'https://graph.facebook.com/v19.0/me?fields=id,name,email,picture.type(large)',
    scope: 'email public_profile',
    pkce: false,
    // Facebook only ever returns an email the user confirmed with them, and
    // omits the field entirely for phone-only accounts.
    profile: (d) => ({
      id: d.id,
      email: d.email ?? null,
      emailVerified: Boolean(d.email),
      name: d.name ?? null,
      avatarUrl: d.picture?.data?.url ?? null,
    }),
  },

  linkedin: {
    key: 'linkedin',
    enum: 'LINKEDIN',
    label: 'LinkedIn',
    // "Sign In with LinkedIn using OpenID Connect" — the product must be added
    // to the app in the LinkedIn developer portal or the scopes are refused.
    authUrl: 'https://www.linkedin.com/oauth/v2/authorization',
    tokenUrl: 'https://www.linkedin.com/oauth/v2/accessToken',
    userinfoUrl: 'https://api.linkedin.com/v2/userinfo',
    scope: 'openid profile email',
    pkce: false,
    profile: (d) => ({
      id: d.sub,
      email: d.email ?? null,
      emailVerified: d.email_verified === true || d.email_verified === 'true',
      name: d.name ?? null,
      avatarUrl: d.picture ?? null,
    }),
  },

  twitter: {
    key: 'twitter',
    enum: 'TWITTER',
    label: 'X',
    authUrl: 'https://twitter.com/i/oauth2/authorize',
    tokenUrl: 'https://api.twitter.com/2/oauth2/token',
    userinfoUrl: 'https://api.twitter.com/2/users/me?user.fields=profile_image_url',
    scope: 'users.read tweet.read',
    pkce: true, // X requires PKCE
    basicAuth: true, // X's token endpoint wants client_secret_basic
    // X does not share email addresses on the standard tier. That makes X
    // link-only: it can sign you IN to an account it's already linked to, but
    // can never START one (no email → no dedupe key → guaranteed duplicates).
    profile: (d) => ({
      id: d.data?.id,
      email: null,
      emailVerified: false,
      name: d.data?.name ?? null,
      avatarUrl: d.data?.profile_image_url ?? null,
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
    .map((p) => ({ key: p.key, label: p.label }))
}
