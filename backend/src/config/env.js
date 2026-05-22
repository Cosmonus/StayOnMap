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
]

for (const key of required) {
  if (!process.env[key]) throw new Error(`Missing required env var: ${key}`)
}

export const env = {
  port: Number(process.env.PORT) || 4000,
  nodeEnv: process.env.NODE_ENV || 'development',
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',
  jwtSecret: process.env.JWT_SECRET || 'dev-secret',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  anthropicApiKey: process.env.ANTHROPIC_API_KEY || null,
  resendApiKey: process.env.RESEND_API_KEY || null,
  resendFrom: process.env.RESEND_FROM_EMAIL || 'StayOnMap <noreply@stayonmap.in>',
  vapidPublicKey:  process.env.VAPID_PUBLIC_KEY  || null,
  vapidPrivateKey: process.env.VAPID_PRIVATE_KEY || null,
  vapidSubject:    process.env.VAPID_SUBJECT     || 'mailto:hello@stayonmap.in',
  googleMapsKey:   process.env.GOOGLE_MAPS_KEY   || null,
}
