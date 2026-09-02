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
  // Where `vite build` wrote the SPA shell. The API reads index.html from here
  // to inject per-listing <head> tags (features/seo/prerender.service.js).
  // Default is the repo layout, which is also the layout on the prod VM
  // (/srv/stayonmap/{backend,frontend}). An unreadable path is a SUPPORTED
  // state: nginx falls back to serving the plain shell.
  frontendDist: process.env.FRONTEND_DIST || '../frontend/dist',
  jwtSecret: process.env.JWT_SECRET,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  aiProvider: process.env.AI_PROVIDER || 'stub',
  anthropicApiKey: process.env.ANTHROPIC_API_KEY || null,
  // Mailer (lib/mailer.js) — four delivery paths, same interface.
  //   MAIL_PROVIDER=smtp  (default) → nodemailer to any SMTP endpoint. Works
  //     locally and on hosts that allow outbound SMTP.
  //   MAIL_PROVIDER=zeptomail       → Zoho ZeptoMail's REST API over HTTPS
  //     (plain fetch, no SDK). The chosen production path (decision
  //     2026-07-21, superseding Resend the same day) — the previous host
  //     blocked outbound SMTP ports (25/465/587/2525) outright, so an HTTPS API
  //     was the only way to send; kept as the default. Transactional-only by
  //     Zoho's terms — never marketing mail, which this app doesn't send.
  //   MAIL_PROVIDER=resend / brevo  → same shape, kept as alternatives.
  // Unset/unconfigured → email is a logged no-op (same as before).
  mailProvider: process.env.MAIL_PROVIDER || 'smtp',
  // The send-mail token from ZeptoMail's Mail Agent (starts "Zoho-enczapikey"
  // in their docs — store ONLY the key part, the header prefix is added in
  // the mailer). API URL differs by data centre: .in accounts vs .com.
  zeptomailToken: process.env.ZEPTOMAIL_TOKEN || null,
  zeptomailApiUrl: process.env.ZEPTOMAIL_API_URL || 'https://api.zeptomail.in/v1.1/email',
  resendApiKey: process.env.RESEND_API_KEY || null,
  brevoApiKey: process.env.BREVO_API_KEY || null,
  mailFrom: process.env.MAIL_FROM || process.env.SMTP_USER || 'StayOnMap <noreply@stayonmap.com>',
  // Where the public contact form delivers (features/contact). Defaulted rather
  // than required because the address is already published in three places on
  // /contact itself — an unset env must not turn the form back into the silent
  // no-op it was until 2026-08-10.
  supportEmail: process.env.SUPPORT_EMAIL || 'hello@cosmonus.com',
  smtpHost: process.env.SMTP_HOST || null,
  smtpPort: Number(process.env.SMTP_PORT) || 465,
  smtpUser: process.env.SMTP_USER || null,
  smtpPass: process.env.SMTP_PASS || null,
  // Default matches Gmail's ~500/day. Resend's free tier is 100/day (3,000/mo)
  // — set MAIL_DAILY_CAP=100 when MAIL_PROVIDER=resend. Brevo's free tier is
  // 300/day. SMTP_DAILY_CAP is still read for backwards compatibility.
  mailDailyCap: Number(process.env.MAIL_DAILY_CAP) || Number(process.env.SMTP_DAILY_CAP) || 450,
  // SMS (lib/smsSender.js) — phone verification codes, and nothing else.
  //   SMS_PROVIDER=msg91 (default) → MSG91's OTP API. Needs MSG91_AUTH_KEY and
  //     MSG91_TEMPLATE_ID (a DLT-approved template — the message text lives in
  //     their console, not in this repo).
  //   SMS_PROVIDER=fast2sms        → same shape, one key.
  // Unset in development → codes print to the server console (dev-echo), so the
  // flow works on a fresh checkout. Unset in production → phone verification is
  // unavailable and the UI hides it rather than offering a button that 503s.
  //   SMS_PROVIDER=whatsapp        → the code goes out as a WhatsApp
  //     AUTHENTICATION template through the same Cloud API the listing bot
  //     uses (features/whatsapp/client.js). Needs WHATSAPP_OTP_TEMPLATE, an
  //     approved authentication-category template. Cheaper than SMS in India
  //     and no DLT registration, but NOT free — Meta bills per conversation.
  smsProvider:     process.env.SMS_PROVIDER      || 'msg91',
  msg91AuthKey:    process.env.MSG91_AUTH_KEY    || null,
  msg91TemplateId: process.env.MSG91_TEMPLATE_ID || null,
  fast2smsApiKey:  process.env.FAST2SMS_API_KEY  || null,
  // A runaway guard, not a plan: at ~₹0.20 per SMS this caps a bad day at
  // ~₹40. The per-user and per-destination limits in phone.service.js are what
  // actually stop abuse; this is the backstop behind them.
  smsDailyCap:     Number(process.env.SMS_DAILY_CAP) || 200,
  // WhatsApp Cloud API (features/whatsapp/) — an owner lists a property by
  // chatting with the StayOnMap number. All five are set together or the
  // feature is inert: the webhook answers 503 on POST, whatsappConfigured() is
  // false, and nothing else in the app changes. Absent is a supported state,
  // like mail and SMS. Created in Meta Business → WhatsApp → API setup; see
  // docs/operator-actions.md §1.6k for the walk-through.
  whatsapp: {
    accessToken:       process.env.WHATSAPP_ACCESS_TOKEN        || null,
    phoneNumberId:     process.env.WHATSAPP_PHONE_NUMBER_ID     || null,
    businessAccountId: process.env.WHATSAPP_BUSINESS_ACCOUNT_ID || null,
    // What Meta sends back on the GET verification handshake. Any long random
    // string; it is compared, never used to sign anything.
    verifyToken:       process.env.WHATSAPP_VERIFY_TOKEN        || null,
    // The App Secret from Meta → App settings → Basic. Signs every webhook POST
    // (X-Hub-Signature-256); a POST that does not verify is dropped unread.
    appSecret:         process.env.WHATSAPP_APP_SECRET          || null,
    apiVersion:        process.env.WHATSAPP_API_VERSION         || 'v21.0',
    // Message templates (approved in Meta's console). Outside the 24-hour
    // customer-service window Meta only delivers templates, and "your listing
    // is live" arrives days after the last message — so it MUST be one.
    // Unset = the go-live message is attempted as plain text and may be
    // refused by Meta; the attempt is logged either way.
    listingLiveTemplate: process.env.WHATSAPP_LISTING_LIVE_TEMPLATE || null,
    // "You have {{1}} on StayOnMap for {{2}}. Respond here: {{3}}" — sent to an
    // owner who listed over WhatsApp when a renter asks for a visit or writes
    // in chat. Days after their last message, so a template like the one above.
    ownerAlertTemplate:  process.env.WHATSAPP_OWNER_ALERT_TEMPLATE   || null,
    otpTemplate:         process.env.WHATSAPP_OTP_TEMPLATE          || null,
    templateLanguage:    process.env.WHATSAPP_TEMPLATE_LANGUAGE     || 'en',
  },
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
  // The POI intelligence layer's BACKGROUND half — entity conflation into
  // Place/PlaceSource, attribute confidence and TrustScore recomputation.
  //
  // Default OFF, and what that gates is narrower than the name suggests. The
  // parts that are pure data hygiene — marking absent POIs instead of deleting
  // them, recording conflicts, validating coordinates — are NOT behind this
  // flag and never will be: they run inside a manual seeder an operator invokes
  // deliberately, they cannot change what a user sees, and gating a fix that
  // stops losing data behind an opt-in means the data goes on being lost.
  //
  // What IS gated is the scheduled work: a recurring job that reads the whole
  // POI table. That is a cost and a load, so it stays opt-in until shadow
  // validation (scripts/poi-shadow-report.mjs) says the new numbers agree with
  // the old ones. Absent is a supported state, like routing and CPCB — the
  // serving path is untouched either way.
  poiIntelligenceEnabled: process.env.POI_INTELLIGENCE_ENABLED === 'true',
  // data.gov.in — CPCB ground-station air quality. Free, registration only.
  // Absent is a supported state, not a misconfiguration: the environment module
  // declares `cpcb_station` as an input and leaves it absent, which holds its
  // confidence down honestly rather than passing model output off as measured.
  dataGovApiKey: process.env.DATA_GOV_API_KEY || null,
  // Error monitoring — entirely optional, lib/sentry.js no-ops without it
  sentryDsn:       process.env.SENTRY_DSN        || null,
  // GA4 Measurement Protocol — forwards the MOBILE APP's funnel events, and
  // ONLY the app's. The website briefly carried a gtag on 2026-08-07 and no
  // longer does (operator decision — it set `_ga` cookies, which was the only
  // thing this product needed a cookie policy for). /privacy now states that
  // the website sends Google nothing, so do not "complete" this by mirroring
  // web events server-side: that is the same disclosure with a different
  // transport. Absent is a supported state and the
  // forwarder no-ops, exactly like mail and SMS — a deployment without them
  // still records everything to our own Postgres, which stays the source of
  // truth. The API secret is created in GA4 → Admin → Data streams → your
  // stream → Measurement Protocol API secrets, and is NOT the measurement id.
  ga4MeasurementId: process.env.GA4_MEASUREMENT_ID || null,
  ga4ApiSecret:     process.env.GA4_API_SECRET     || null,
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
