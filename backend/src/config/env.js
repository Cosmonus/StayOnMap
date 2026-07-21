// Validated environment config — fail fast if required vars are missing
//
// Scalability env vars (optional — safe to omit in dev):
//   REDIS_URL             → enables pin caching (30s TTL), admin analytics cache (60s),
//                           and Socket.io Redis adapter for multi-process support
//   DATABASE_URL          → append ?connection_limit=25&pool_timeout=20 for prod pool tuning
//                           Enable Supabase PgBouncer (transaction mode) for 500+ concurrent users
//   PM2                   → run `npm run start:prod` to launch cluster mode (one worker per CPU core)

const required = [
  'DATABASE_URL',
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'ADMIN_JWT_SECRET',
  'JWT_SECRET',
]

for (const key of required) {
  if (!process.env[key]) throw new Error(`Missing required env var: ${key}`)
}

// Presence alone isn't enough for the signing keys. A placeholder copied from
// .env.example is a non-empty string, so it passes the check above while being
// a publicly-known signing key — and both placeholders were once the *same*
// string, which silently collapses the user/admin separation (a user token
// would verify as an admin token). Fail at boot instead of in production.
const MIN_SECRET_LENGTH = 32

for (const key of ['JWT_SECRET', 'ADMIN_JWT_SECRET']) {
  const value = process.env[key]
  if (value.length < MIN_SECRET_LENGTH) {
    throw new Error(`${key} must be at least ${MIN_SECRET_LENGTH} characters — generate one with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`)
  }
  if (/CHANGE_ME|change_this_to_a_long_random_string/i.test(value)) {
    throw new Error(`${key} is still set to the .env.example placeholder — generate a real secret`)
  }
}

if (process.env.JWT_SECRET === process.env.ADMIN_JWT_SECRET) {
  throw new Error('JWT_SECRET and ADMIN_JWT_SECRET must be different — a shared secret makes any user token valid as an admin token')
}

export const env = {
  port: Number(process.env.PORT) || 4000,
  nodeEnv: process.env.NODE_ENV || 'development',
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',
  jwtSecret: process.env.JWT_SECRET,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  aiProvider: process.env.AI_PROVIDER || 'stub',
  anthropicApiKey: process.env.ANTHROPIC_API_KEY || null,
  // Mailer (lib/mailer.js) — two delivery paths, same interface.
  //   MAIL_PROVIDER=smtp  (default) → nodemailer to any SMTP endpoint. Works
  //     locally and on hosts that allow outbound SMTP.
  //   MAIL_PROVIDER=brevo           → Brevo's REST API over HTTPS (plain
  //     fetch, no SDK). Required on Railway below the Pro plan, which blocks
  //     outbound SMTP ports (25/465/587/2525) outright — SMTP there fails no
  //     matter how it's configured. See docs/production-readiness.md.
  // Unset/unconfigured → email is a logged no-op (same as before).
  mailProvider: process.env.MAIL_PROVIDER || 'smtp',
  brevoApiKey: process.env.BREVO_API_KEY || null,
  mailFrom: process.env.MAIL_FROM || process.env.SMTP_USER || 'StayOnMap <noreply@stayonmap.com>',
  smtpHost: process.env.SMTP_HOST || null,
  smtpPort: Number(process.env.SMTP_PORT) || 465,
  smtpUser: process.env.SMTP_USER || null,
  smtpPass: process.env.SMTP_PASS || null,
  // Default matches Gmail's ~500/day. Brevo's free tier is 300/day — set
  // MAIL_DAILY_CAP=300 when MAIL_PROVIDER=brevo. SMTP_DAILY_CAP is still read
  // for backwards compatibility with existing deploys.
  mailDailyCap: Number(process.env.MAIL_DAILY_CAP) || Number(process.env.SMTP_DAILY_CAP) || 450,
  vapidPublicKey:  process.env.VAPID_PUBLIC_KEY  || null,
  vapidPrivateKey: process.env.VAPID_PRIVATE_KEY || null,
  vapidSubject:    process.env.VAPID_SUBJECT     || 'mailto:hello@stayonmap.com',
  googleMapsKey:   process.env.GOOGLE_MAPS_KEY   || null,
  // Hard daily ceiling on billed Google calls made by the spatial
  // intelligence layer (features/spatial/providers.js). Materialising one
  // ~153m cell costs a handful of requests, and the number of cells is driven
  // by where owners list — i.e. not by us. When the ceiling trips the layer
  // serves whatever it already has and reports the rest as missing; it never
  // blanks a page and never runs up a surprise bill.
  // Enforced only when REDIS_URL is set (the counter is shared state).
  spatialDailyApiBudget: Number(process.env.SPATIAL_DAILY_API_BUDGET) || 2000,
  // Self-hosted OSRM routing server (infra/routing/) — measured walking
  // distances. Absent is a supported state: every consumer falls back to
  // haversine, so this can never break a page, only improve it.
  routingUrl: (process.env.ROUTING_URL || '').replace(/\/$/, '') || null,
  // data.gov.in — CPCB ground-station air quality. Free, registration only.
  // Absent is a supported state, not a misconfiguration: the environment module
  // declares `cpcb_station` as an input and leaves it absent, which holds its
  // confidence down honestly rather than passing model output off as measured.
  dataGovApiKey: process.env.DATA_GOV_API_KEY || null,
  // Error monitoring — entirely optional, lib/sentry.js no-ops without it
  sentryDsn:       process.env.SENTRY_DSN        || null,
  // The backend's own public origin — OAuth providers redirect back to
  // `${apiPublicUrl}/api/v1/auth/oauth/<provider>/callback`, so it must be the
  // address a browser can reach, not an internal hostname.
  apiPublicUrl: process.env.API_PUBLIC_URL || `http://localhost:${Number(process.env.PORT) || 4000}`,
  // Social login — each provider activates only when BOTH its vars are set;
  // unset providers simply don't appear in GET /auth/oauth/providers, so the
  // UI never shows a dead button. Creating these apps is operator work:
  // docs/auth-providers-setup.md.
  oauth: {
    google: { clientId: process.env.GOOGLE_OAUTH_CLIENT_ID || null, clientSecret: process.env.GOOGLE_OAUTH_CLIENT_SECRET || null },
  },
}
