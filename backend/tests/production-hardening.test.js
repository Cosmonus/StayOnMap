// Guards for the 2026-07-30 production-readiness pass.
//
// Each block below pins one fix from that audit. They are grouped in one file
// because they share a theme — "the server behaves correctly when something is
// wrong" — not because they share a module.
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { errorMiddleware } from '../src/middlewares/error.middleware.js'
import { updateProfileSchema } from '../src/features/users/users.validation.js'
import { markAllReadQuerySchema, NOTIFICATION_TYPES } from '../src/features/notifications/notifications.validation.js'
import { expoTokenSchema, webPushSubscribeSchema } from '../src/features/push/push.validation.js'
import { voteSchema } from '../src/features/reviews/reviews.validation.js'

const REPO = resolve(import.meta.dirname, '../..')

function runError(err) {
  const res = {
    statusCode: null,
    payload: null,
    status(code) { this.statusCode = code; return this },
    json(body) { this.payload = body; return this },
  }
  errorMiddleware(err, {}, res, () => {})
  return res
}

// ── Prisma errors that are really client errors ──────────────────────────────
describe('Prisma error mapping', () => {
  it('maps P2025 (record vanished) to 404, not 500', () => {
    const res = runError(Object.assign(new Error('Record to update not found.'), { code: 'P2025' }))
    expect(res.statusCode).toBe(404)
  })

  it('maps P2002 (unique constraint) to 409', () => {
    expect(runError(Object.assign(new Error('Unique failed'), { code: 'P2002' })).statusCode).toBe(409)
  })

  it('maps P2003 (foreign key) to 400', () => {
    expect(runError(Object.assign(new Error('FK failed'), { code: 'P2003' })).statusCode).toBe(400)
  })

  it('does NOT override an explicit statusCode a service already chose', () => {
    // A service that catches P2025 itself and throws a 403 must keep its 403 —
    // the middleware is a floor, not an override.
    const res = runError(Object.assign(new Error('Not yours'), { code: 'P2025', statusCode: 403 }))
    expect(res.statusCode).toBe(403)
  })

  it('leaves an unrecognised Prisma error as a 500', () => {
    // P1001 is "cannot reach database" — ours, not the caller's.
    expect(runError(Object.assign(new Error('unreachable'), { code: 'P1001' })).statusCode).toBe(500)
  })
})

// ── PUT /users/profile ───────────────────────────────────────────────────────
describe('profile update validation', () => {
  it('rejects an unbounded bio', () => {
    expect(updateProfileSchema.safeParse({ bio: 'x'.repeat(5000) }).success).toBe(false)
  })

  it('rejects an unbounded name', () => {
    expect(updateProfileSchema.safeParse({ name: 'x'.repeat(500) }).success).toBe(false)
  })

  it('rejects a non-http avatarUrl', () => {
    // The reason this matters: every viewer's browser fetches this URL.
    for (const bad of ['javascript:alert(1)', 'data:text/html,<script>', 'ftp://x.com/a.png', 'not a url']) {
      expect(updateProfileSchema.safeParse({ avatarUrl: bad }).success, bad).toBe(false)
    }
  })

  it('accepts a normal https avatar', () => {
    expect(updateProfileSchema.safeParse({ avatarUrl: 'https://cdn.example.com/a.png' }).success).toBe(true)
  })

  it('enforces the Indian mobile format', () => {
    expect(updateProfileSchema.safeParse({ phone: '9876543210' }).success).toBe(true)
    expect(updateProfileSchema.safeParse({ phone: '1234567890' }).success).toBe(false) // must start 6-9
    expect(updateProfileSchema.safeParse({ phone: '98765' }).success).toBe(false)
  })

  it('still accepts the blank fields both clients actually send', () => {
    // Web posts the whole form with `settings.phone ?? ''`; mobile sends
    // `phone: ''` once cleared. Rejecting these would 400 every save by a user
    // with no phone number — most of them. This is the regression guard.
    const asClientsSendIt = {
      name: 'Asha', phone: '', city: '', bio: '',
      socialLinks: {}, listingVisibility: 'PUBLIC', contactVisibility: 'LOGGED_IN',
      showExactLocation: true, emailNotifs: true, pushNotifs: true,
    }
    const parsed = updateProfileSchema.safeParse(asClientsSendIt)
    expect(parsed.success, JSON.stringify(parsed.error?.issues)).toBe(true)
  })

  it('cannot be used to escalate privileges', () => {
    // Defence in depth — users.service.js's ALLOWED_FIELDS is the real gate,
    // but the schema must not hand those keys through either.
    const parsed = updateProfileSchema.parse({ name: 'A', role: 'OWNER', isBusiness: true, isVerified: true })
    expect(parsed).not.toHaveProperty('role')
    expect(parsed).not.toHaveProperty('isBusiness')
    expect(parsed).not.toHaveProperty('isVerified')
  })
})

// ── Notification type filter ─────────────────────────────────────────────────
describe('mark-all-read type filter', () => {
  it('rejects an unknown type instead of widening the write', () => {
    // Silently ignoring this would turn "mark MESSAGE read" into "mark
    // everything read", with no undo.
    expect(markAllReadQuerySchema.safeParse({ type: 'BOGUS' }).success).toBe(false)
  })

  it('accepts a real type and no type at all', () => {
    expect(markAllReadQuerySchema.safeParse({ type: 'MESSAGE' }).success).toBe(true)
    expect(markAllReadQuerySchema.safeParse({}).success).toBe(true)
  })

  it('stays in sync with the Prisma enum', () => {
    // The amenities lesson: a vocabulary duplicated across files drifts
    // silently. Compare against schema.prisma itself, not a second hand-copy.
    const schema = readFileSync(resolve(REPO, 'backend/prisma/schema.prisma'), 'utf8')
    const block = schema.match(/enum NotificationType \{([^}]*)\}/)[1]
    const fromPrisma = block.split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('//'))
    expect([...NOTIFICATION_TYPES].sort()).toEqual([...fromPrisma].sort())
  })
})

// ── Push registration ────────────────────────────────────────────────────────
describe('push validation', () => {
  it('rejects junk where an Expo token belongs', () => {
    expect(expoTokenSchema.safeParse({ token: 'lol' }).success).toBe(false)
    expect(expoTokenSchema.safeParse({}).success).toBe(false)
    expect(expoTokenSchema.safeParse({ token: 'ExponentPushToken[abc123]' }).success).toBe(true)
  })

  it('requires a full web-push subscription but passes unknown keys through', () => {
    expect(webPushSubscribeSchema.safeParse({ endpoint: 'https://x/y' }).success).toBe(false) // no keys
    const full = {
      endpoint: 'https://fcm.googleapis.com/fcm/send/abc',
      keys: { p256dh: 'k', auth: 'a' },
      someFutureUAField: 'keep me',
    }
    const parsed = webPushSubscribeSchema.safeParse(full)
    expect(parsed.success).toBe(true)
    // web-push consumes the whole object; stripping would break delivery on a
    // UA that adds a field.
    expect(parsed.data.someFutureUAField).toBe('keep me')
  })
})

describe('review vote validation', () => {
  it('requires a boolean', () => {
    expect(voteSchema.safeParse({}).success).toBe(false)
    expect(voteSchema.safeParse({ recommend: 'yes' }).success).toBe(false)
    expect(voteSchema.safeParse({ recommend: true }).success).toBe(true)
  })
})

// ── Shutdown + readiness + rate-limit identity ───────────────────────────────
// These three are wiring rather than pure functions — asserting on the source
// is what's available without standing up a server and a Redis. Narrow, but it
// catches the regression that matters: someone deleting the handler.
describe('operational wiring', () => {
  const index = readFileSync(resolve(REPO, 'backend/src/index.js'), 'utf8')

  it('handles SIGTERM, because every deploy sends one', () => {
    expect(index).toMatch(/process\.on\(\s*'SIGTERM'/)
  })

  it('drains the http server and the DB pool on shutdown', () => {
    expect(index).toMatch(/httpServer\.close/)
    expect(index).toMatch(/prisma\.\$disconnect/)
  })

  it('bounds the drain so a stuck request cannot hold a deploy open', () => {
    expect(index).toMatch(/SHUTDOWN_TIMEOUT_MS/)
  })

  it('exposes a readiness probe that actually touches the database', () => {
    expect(index).toMatch(/\/health\/ready/)
    expect(index).toMatch(/SELECT 1/)
  })

  it('keeps /health dependency-free so a DB blip cannot cause a restart loop', () => {
    const liveness = index.match(/app\.get\('\/health',[^\n]*\n?/)[0]
    expect(liveness).not.toMatch(/prisma|SELECT/)
  })

  it('keys rate limits by verified user, not just IP (carrier-grade NAT)', () => {
    const rl = readFileSync(resolve(REPO, 'backend/src/middlewares/rateLimit.middleware.js'), 'utf8')
    expect(rl).toMatch(/keyGenerator/)
    expect(rl).toMatch(/jwt\.verify/)
    // An unverified `sub` would let anyone mint unlimited buckets.
    expect(rl).not.toMatch(/jwt\.decode/)
  })
})
