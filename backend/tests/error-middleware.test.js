/**
 * Global error handler
 *
 * Guards the production sanitisation rule (.claude/security.md): 5xx must never
 * leak internals to clients in prod. `err.expose` is a deliberate opt-out for
 * messages WE authored — added 2026-07-17 after a live production probe showed
 * the OTP 503 reaching users as "Internal server error" instead of telling them
 * their password still works.
 *
 * The risk of an opt-out is that it quietly becomes the default, so these tests
 * pin both directions: expose shows, absence of expose still hides.
 *
 * NOTE: error.middleware.js resolves `isProd` once at module scope, so setting
 * process.env.NODE_ENV inside a test does nothing on its own — the module must
 * be re-imported after the env changes. Hence loadMiddleware() below rather
 * than a plain top-level import.
 */
import { describe, it, expect, afterEach, vi } from 'vitest'

const ORIGINAL_ENV = process.env.NODE_ENV

async function loadMiddleware(nodeEnv) {
  process.env.NODE_ENV = nodeEnv
  vi.resetModules()
  const { errorMiddleware } = await import('../src/middlewares/error.middleware.js')
  return errorMiddleware
}

function run(mw, err) {
  const res = {
    status(c) { this._status = c; return this },
    json(b) { this._body = b; return this },
  }
  vi.spyOn(console, 'error').mockImplementation(() => {})
  mw(err, {}, res, () => {})
  return { status: res._status, body: res._body }
}

afterEach(() => {
  process.env.NODE_ENV = ORIGINAL_ENV
  vi.restoreAllMocks()
})

describe('errorMiddleware in production', () => {
  it('shows 4xx messages (validation/auth/not-found are safe)', async () => {
    const mw = await loadMiddleware('production')
    const { status, body } = run(mw, Object.assign(new Error('Invalid or expired code'), { statusCode: 401 }))
    expect(status).toBe(401)
    expect(body.message).toBe('Invalid or expired code')
  })

  it('hides an un-flagged 5xx message', async () => {
    // A caught DB/stack error must never reach the client.
    const mw = await loadMiddleware('production')
    const { status, body } = run(mw, Object.assign(new Error('connect ECONNREFUSED 10.0.0.3:5432'), { statusCode: 500 }))
    expect(status).toBe(500)
    expect(body.message).toBe('Internal server error')
    expect(body.message).not.toContain('ECONNREFUSED')
  })

  it('shows a 5xx message that is explicitly exposed', async () => {
    const mw = await loadMiddleware('production')
    const { status, body } = run(mw, Object.assign(
      new Error('Sign-in codes are temporarily unavailable. Please sign in with your password.'),
      { statusCode: 503, expose: true }
    ))
    expect(status).toBe(503)
    expect(body.message).toContain('sign in with your password')
  })

  it('expose is opt-IN — a bare 5xx is still sanitised', async () => {
    const mw = await loadMiddleware('production')
    const { body } = run(mw, Object.assign(new Error('secret internals'), { statusCode: 503 }))
    expect(body.message).toBe('Internal server error')
  })

  it('a falsy expose does not leak', async () => {
    const mw = await loadMiddleware('production')
    for (const expose of [false, undefined, null, 0, '']) {
      const { body } = run(mw, Object.assign(new Error('secret internals'), { statusCode: 500, expose }))
      expect(body.message).toBe('Internal server error')
    }
  })

  it('defaults to 500 when no status is set', async () => {
    const mw = await loadMiddleware('production')
    const { status, body } = run(mw, new Error('boom'))
    expect(status).toBe(500)
    expect(body.message).toBe('Internal server error')
  })

  it('hides err.code on an un-flagged 5xx — an uncaught Prisma error must not disclose the ORM', async () => {
    const mw = await loadMiddleware('production')
    const { body } = run(mw, Object.assign(new Error('Record not found'), { statusCode: 500, code: 'P2025' }))
    expect(body.error).toBe('INTERNAL_ERROR')
  })

  it('keeps err.code on 4xx (machine-readable codes like ACCOUNT_BLOCKED are the contract)', async () => {
    const mw = await loadMiddleware('production')
    const { body } = run(mw, Object.assign(new Error('Blocked'), { statusCode: 403, code: 'ACCOUNT_BLOCKED' }))
    expect(body.error).toBe('ACCOUNT_BLOCKED')
  })

  it('keeps err.code on a 5xx that is explicitly exposed', async () => {
    const mw = await loadMiddleware('production')
    const { body } = run(mw, Object.assign(new Error('Sign-in codes unavailable'), { statusCode: 503, expose: true, code: 'OTP_UNAVAILABLE' }))
    expect(body.error).toBe('OTP_UNAVAILABLE')
  })
})

describe('errorMiddleware outside production', () => {
  it('shows 5xx detail for debugging', async () => {
    const mw = await loadMiddleware('development')
    const { body } = run(mw, Object.assign(new Error('connect ECONNREFUSED'), { statusCode: 500 }))
    expect(body.message).toBe('connect ECONNREFUSED')
  })

  it('shows err.code on 5xx for debugging', async () => {
    const mw = await loadMiddleware('development')
    const { body } = run(mw, Object.assign(new Error('Record not found'), { statusCode: 500, code: 'P2025' }))
    expect(body.error).toBe('P2025')
  })
})
