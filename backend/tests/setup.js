import { vi } from 'vitest'
import { prismaMock } from './mocks/prisma.js'

// ── Prisma singleton ────────────────────────────────────────────────────────
vi.mock('../src/lib/prisma.js', () => ({ prisma: prismaMock }))

// ── Redis — no-op in tests (REDIS_URL is unset) ─────────────────────────────
vi.mock('../src/lib/redis.js', () => ({
  redis: null,
  cacheGet: vi.fn().mockResolvedValue(null),
  cacheSet: vi.fn().mockResolvedValue(undefined),
  cacheDel: vi.fn().mockResolvedValue(undefined),
}))

// ── Trust / Risk recalculation — fire-and-forget side effects ───────────────
vi.mock('../src/features/trust/trust.service.js', () => ({
  recalculateTrustScore: vi.fn().mockResolvedValue(null),
  recalculateRiskScore:  vi.fn().mockResolvedValue(null),
}))

// ── AI fraud scan — stubbed out ─────────────────────────────────────────────
vi.mock('../src/features/ai/ai.service.js', () => ({
  runFraudScan: vi.fn().mockResolvedValue(null),
}))

// ── Intelligence layer — fire-and-forget side effects ──────────────────────
vi.mock('../src/services/intelligence.service.js', () => ({
  evaluateListing:  vi.fn().mockResolvedValue(undefined),
  getRentBenchmark: vi.fn().mockResolvedValue(null),
}))

// ── Spatial external providers — no network in tests ───────────────────────
// Every provider returns null, which is exactly the degraded path a fresh
// checkout (no GOOGLE_MAPS_KEY) and a spent API budget both hit — so the
// default suite proves the modules stay honest with no external data at all.
// Tests that need real values (spatial-environment.test.js) re-mock per file.
vi.mock('../src/features/spatial/providers.js', async (importOriginal) => ({
  // Keep the real source constants — they're plain data, and mocking them
  // would make the sources[] assertions test the mock instead of the module.
  ...(await importOriginal()),
  nearbyPlaces:   vi.fn().mockResolvedValue(null),
  nearbyCount:    vi.fn().mockResolvedValue(null),
  distanceMatrix: vi.fn().mockResolvedValue(null),
  airQuality:     vi.fn().mockResolvedValue(null),
}))

// WorldCover is a network provider too — landCover() range-reads a GeoTIFF
// from S3. It belongs in this no-network block and was missed when it landed on
// 2026-07-28, which made spatial-modules.test.js pass alone and fail in the
// suite depending on whether S3 answered in time. Mocking it per-file was the
// wrong fix; this is the right one.
vi.mock('../src/features/spatial/worldCoverProvider.js', async (importOriginal) => ({
  ...(await importOriginal()),
  landCover: vi.fn().mockResolvedValue(null),
}))

// ── Spatial context — fire-and-forget materialisation + read-path join ─────
// getContext returns null (cell not described yet), which is the normal
// cold-start path and must not break a property fetch.
vi.mock('../src/features/spatial/spatial.service.js', () => ({
  getContext: vi.fn().mockResolvedValue(null),
  materialize: vi.fn().mockResolvedValue(null),
  ensureContextForProperty: vi.fn().mockResolvedValue(undefined),
  // Real values, not stubs: refresher.js imports these and builds its due
  // query out of them. A mocked `undefined` here silently produces
  // `failCount: { lt: undefined }` rather than an error, which is how a
  // circuit breaker stops breaking without anything failing loudly.
  MAX_FAILURES: 5,
  STATUS_READY: 'ready',
  STATUS_PENDING: 'pending',
  STATUS_FAILED: 'failed',
}))

// ── Notifications / chat — fire-and-forget side effects across services ────
vi.mock('../src/features/notifications/notifications.service.js', () => ({
  notifyUser: vi.fn().mockResolvedValue(null),
}))
vi.mock('../src/features/chat/chat.service.js', () => ({
  getOrCreateConversation: vi.fn().mockResolvedValue({ id: 'convo-1' }),
  sendMessage: vi.fn().mockResolvedValue(null),
}))

// ── env config — minimal stubs so import doesn't throw ──────────────────────
vi.mock('../src/config/env.js', () => ({
  env: {
    port: 4000,
    nodeEnv: 'test',
    databaseUrl: 'postgresql://test',
    supabaseUrl: 'https://test.supabase.co',
    supabaseServiceRoleKey: 'test-key',
    adminJwtSecret: 'test-admin-secret',
    jwtSecret: 'test-jwt-secret',
    jwtExpiresIn: '7d',
    frontendUrl: 'http://localhost:5173',
    googleMapsKey: null,
    // Mail: mirrors an unconfigured deploy (no SMTP creds, no Brevo key) so
    // sendMail is a no-op by default. mailer.test.js overrides per-case.
    mailProvider: 'smtp',
    brevoApiKey: null,
    mailFrom: 'StayOnMap <no-reply@stayonmap.com>',
    mailDailyCap: 450,
    smtpHost: null,
    smtpPort: 465,
    smtpUser: null,
    smtpPass: null,
    spatialDailyApiBudget: 2000,
    apiPublicUrl: 'http://localhost:4000',
    // Google is the only social provider (product decision 2026-07-20).
    oauth: {
      google: { clientId: 'test-google-id', clientSecret: 'test-google-secret' },
    },
  },
}))

// ── Email — best-effort side effect, never awaited for correctness ─────────
// Exception: login OTP awaits sendEmail's boolean and canSend's pre-flight,
// so both default to "sent successfully" here; OTP tests override per-case.
vi.mock('../src/services/email.service.js', () => ({
  sendEmail: vi.fn().mockResolvedValue(true),
  canSend: vi.fn().mockResolvedValue(true),
  passwordResetEmail: vi.fn().mockReturnValue({ subject: 'test', html: 'test' }),
  emailVerificationEmail: vi.fn().mockReturnValue({ subject: 'test', html: 'test' }),
  loginOtpEmail: vi.fn().mockReturnValue({ subject: 'test', html: 'test' }),
  passwordChangedEmail: vi.fn().mockReturnValue({ subject: 'test', html: 'test' }),
  accountLinkedEmail: vi.fn().mockReturnValue({ subject: 'test', html: 'test' }),
}))
