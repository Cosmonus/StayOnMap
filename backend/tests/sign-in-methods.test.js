// GET /auth/methods — what this deployment can actually offer.
//
// It exists for one button. SMS costs money per message and needs TRAI DLT
// registration, so most deployments (production included, by decision on
// 2026-08-09) have no provider — and the login screen is unauthenticated, so it
// cannot read the authed settings payload that gates every other SMS surface.
// Without this the screen drew a "Text me a sign-in code" button that could only
// ever answer 503.
import { describe, it, expect, vi, beforeEach } from 'vitest'

const smsConfigured = vi.fn()
vi.mock('../src/lib/smsSender.js', () => ({
  sendSms: vi.fn(),
  canSendSms: vi.fn(),
  smsConfigured: (...a) => smsConfigured(...a),
  smsStatus: vi.fn(),
}))

const controller = await import('../src/features/auth/auth.controller.js')

const runIt = () => {
  const res = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() }
  controller.signInMethods({}, res)
  return res.json.mock.calls[0][0]
}

beforeEach(() => smsConfigured.mockReset())

describe('GET /auth/methods', () => {
  it('reports SMS as unavailable when no provider is configured', () => {
    smsConfigured.mockReturnValue(false)
    expect(runIt()).toMatchObject({ success: true, data: { sms: false } })
  })

  it('reports SMS as available once a provider is configured', () => {
    smsConfigured.mockReturnValue(true)
    expect(runIt()).toMatchObject({ success: true, data: { sms: true } })
  })

  it('says nothing about anything else', () => {
    // Deliberately not a capability dump. Password and email always work, and
    // OAuth has had its own list since it shipped — widening this into a
    // second, competing answer to "what can I sign in with" is how the two
    // drift.
    smsConfigured.mockReturnValue(false)
    expect(Object.keys(runIt().data)).toEqual(['sms'])
  })
})
