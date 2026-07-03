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
  },
}))

// ── Email — best-effort side effect, never awaited for correctness ─────────
vi.mock('../src/services/email.service.js', () => ({
  sendEmail: vi.fn().mockResolvedValue(null),
  passwordResetEmail: vi.fn().mockReturnValue({ subject: 'test', html: 'test' }),
}))
