import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { corsOriginHandler } from '../src/lib/corsOrigin.js'

// One shared handler gates BOTH Express and Socket.io (index.js + lib/socket.js).
// It had no tests, and the one production incident it exists to prevent —
// chat/notifications silently dead while REST works — recurred in dev on the
// Android emulator for the same reason: an origin that is neither `localhost`
// nor the configured FRONTEND_URL.

const allow = (origin) => {
  const cb = vi.fn()
  corsOriginHandler(origin, cb)
  return cb.mock.calls[0][1] === true
}

let warn
beforeEach(() => {
  warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
  process.env.FRONTEND_URL = 'http://localhost:5175'
})
afterEach(() => {
  warn.mockRestore()
  delete process.env.NODE_ENV
  delete process.env.FRONTEND_URL
})

describe('corsOriginHandler — production', () => {
  beforeEach(() => { process.env.NODE_ENV = 'production' })

  it('allows the configured FRONTEND_URL and both prod origins', () => {
    process.env.FRONTEND_URL = 'https://www.stayonmap.com'
    expect(allow('https://www.stayonmap.com')).toBe(true)
    expect(allow('https://stayonmap.com')).toBe(true)
  })

  it('allows a missing origin (server-to-server, mobile REST)', () => {
    expect(allow(undefined)).toBe(true)
  })

  // The whole point of gating the dev branch: a public deployment must not
  // trust a private-range Origin, which any client can simply assert.
  it('rejects loopback and private ranges in production', () => {
    // Point FRONTEND_URL at the real site: otherwise localhost is legitimately
    // the *configured* origin and would pass on that branch, not the dev one.
    process.env.FRONTEND_URL = 'https://www.stayonmap.com'
    for (const o of [
      'http://localhost:5175',
      'http://127.0.0.1:4000',
      'http://10.0.2.2:4000',
      'http://192.168.1.7:4000',
      'http://172.16.0.5:4000',
    ]) {
      expect(allow(o), o).toBe(false)
    }
  })

  it('rejects an unrelated origin', () => {
    expect(allow('https://evil.example.com')).toBe(false)
  })
})

describe('corsOriginHandler — development', () => {
  beforeEach(() => { process.env.NODE_ENV = 'development' })

  it('allows the Android emulator host (10.0.2.2) — the socket regression', () => {
    expect(allow('http://10.0.2.2:4000')).toBe(true)
  })

  it('allows a LAN address, for a physical device', () => {
    expect(allow('http://192.168.1.7:4000')).toBe(true)
    expect(allow('http://172.16.0.5:8081')).toBe(true)
  })

  it('allows loopback in any form, with or without a port', () => {
    for (const o of ['http://localhost:5175', 'http://127.0.0.1:4000', 'http://localhost', 'https://localhost:19006']) {
      expect(allow(o), o).toBe(true)
    }
  })

  it('still rejects a public origin in dev', () => {
    expect(allow('https://evil.example.com')).toBe(false)
    // 172.32 is outside the private 172.16–172.31 block.
    expect(allow('http://172.32.0.1:4000')).toBe(false)
    // A hostname that merely starts with an allowed one must not pass.
    expect(allow('http://localhost.evil.com')).toBe(false)
    expect(allow('http://10.0.2.2.evil.com')).toBe(false)
  })

  it('logs the rejected origin so a live incident is diagnosable', () => {
    allow('https://evil.example.com')
    expect(warn).toHaveBeenCalledOnce()
    expect(JSON.parse(warn.mock.calls[0][0])).toMatchObject({
      src: 'cors',
      event: 'origin_rejected',
      origin: 'https://evil.example.com',
    })
  })
})
