/**
 * validate() middleware
 *
 * Guards the Express 5 regression found in production 2026-07-17: req.query is
 * a getter-only property in Express 5, so the middleware's `req.query = parsed`
 * threw "Cannot set property query of #<IncomingMessage> which has only a
 * getter" — a 500 on EVERY query-validated route (/properties, /properties/pins,
 * /properties/count, chat message search). It shipped unnoticed in the Express
 * 4 -> 5 bump and took the map down in prod.
 *
 * The getter simulation below is the whole point: a plain object would let a
 * naive assignment pass and the test would prove nothing.
 */
import { describe, it, expect } from 'vitest'
import { z } from 'zod'
import { validate } from '../src/middlewares/validate.middleware.js'

const schema = z.object({ swLat: z.coerce.number(), type: z.string().optional() })

// Mimics Express 5's IncomingMessage: query is defined with ONLY a getter, so
// `req.query = x` throws in strict mode exactly as it does in production.
function makeReq(query) {
  const req = {}
  Object.defineProperty(req, 'query', { get: () => query, configurable: true })
  return req
}

function run(req, target = 'query') {
  let nexted = false
  const res = { status(c) { this._c = c; return this }, json(b) { this._b = b; return this } }
  validate(schema, target)(req, res, () => { nexted = true })
  return { nexted, status: res._c, body: res._b }
}

describe('validate() against an Express 5 getter-only req.query', () => {
  it('does not throw when writing validated data back', () => {
    const req = makeReq({ swLat: '12.8' })
    expect(() => run(req)).not.toThrow()
  })

  it('calls next() and exposes the parsed value on req.query', () => {
    const req = makeReq({ swLat: '12.8' })
    const { nexted } = run(req)
    expect(nexted).toBe(true)
    // Coerced to a number — proves the parsed data replaced the raw query,
    // which is what every downstream controller reads.
    expect(req.query.swLat).toBe(12.8)
    expect(typeof req.query.swLat).toBe('number')
  })

  it('preserves optional fields so filters still reach the service', () => {
    const req = makeReq({ swLat: '12.8', type: 'PG' })
    run(req)
    expect(req.query.type).toBe('PG')
  })

  it('still 400s on invalid input rather than silently passing', () => {
    const req = makeReq({ swLat: 'abc' })
    const { nexted, status, body } = run(req)
    expect(nexted).toBe(false)
    expect(status).toBe(400)
    expect(body.error).toBe('VALIDATION_ERROR')
  })

  it('works for a plain writable target (body) too', () => {
    const req = { body: { swLat: '9' } }
    const { nexted } = run(req, 'body')
    expect(nexted).toBe(true)
    expect(req.body.swLat).toBe(9)
  })
})
