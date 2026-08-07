/**
 * Owner responsiveness — the metric that used to measure agreement.
 *
 * Until 2026-08-07 `responseRate` was `accepted / (accepted + rejected)`, and
 * it was printed to renters on the mobile owner card as "N% response rate".
 * The first test below is the one that matters: it is the exact scenario the
 * old formula got backwards, and it fails against that formula.
 *
 * These are pure-function tests because the maths lives in its own module —
 * tests/setup.js mocks the whole of trust.service.js, so anything exported
 * from there cannot be unit-tested at all.
 */
import { describe, it, expect } from 'vitest'
import { ownerResponsiveness, speedFactor, GRACE_HOURS, NEUTRAL_RATE } from '../src/features/trust/responsiveness.js'

const HOUR = 60 * 60 * 1000
const NOW = new Date('2026-08-07T12:00:00.000Z')
const hoursAgo = (h) => new Date(NOW.getTime() - h * HOUR)

// A request the owner answered `afterHours` after it arrived.
const answered = (status, ageHours, afterHours) => ({
  status,
  createdAt: hoursAgo(ageHours),
  updatedAt: hoursAgo(ageHours - afterHours),
  respondedAt: hoursAgo(ageHours - afterHours),
})

const pending = (ageHours) => ({
  status: 'PENDING',
  createdAt: hoursAgo(ageHours),
  updatedAt: hoursAgo(ageHours),
  respondedAt: null,
})

describe('declining promptly counts as responding', () => {
  it('scores an owner who answers everything at 100, however often they decline', () => {
    const decliner = [
      answered('REJECTED', 100, 1),
      answered('REJECTED', 90, 1),
      answered('REJECTED', 80, 1),
      answered('ACCEPTED', 70, 1),
    ]
    // The old formula gave this owner 25 — it read three honest, one-hour
    // declines as three failures to respond.
    expect(ownerResponsiveness(decliner, NOW).responseRate).toBe(100)
  })

  it('scores an owner who ignores half of them at 50', () => {
    const ignorer = [
      answered('ACCEPTED', 100, 1),
      answered('ACCEPTED', 90, 1),
      pending(100),
      pending(90),
    ]
    expect(ownerResponsiveness(ignorer, NOW).responseRate).toBe(50)
  })

  it('ranks the prompt decliner above the half-ignorer — the whole point', () => {
    const decliner = ownerResponsiveness([answered('REJECTED', 100, 1), answered('REJECTED', 90, 1)], NOW)
    const ignorer  = ownerResponsiveness([answered('ACCEPTED', 100, 1), pending(100)], NOW)
    expect(decliner.responseRate).toBeGreaterThan(ignorer.responseRate)
  })
})

describe('silence is in the denominator', () => {
  it('counts a PENDING request older than the grace window as unanswered', () => {
    const r = ownerResponsiveness([pending(GRACE_HOURS + 1)], NOW)
    expect(r.ignored).toBe(1)
    expect(r.responseRate).toBe(0)
  })

  it('does not count a request still inside the grace window', () => {
    const r = ownerResponsiveness([pending(GRACE_HOURS - 1)], NOW)
    expect(r.ignored).toBe(0)
    // Nothing judged at all — neutral, not zero. A burst of fresh requests
    // must never dent the score of an owner who is simply asleep.
    expect(r.responseRate).toBe(NEUTRAL_RATE)
  })

  it('counts a renter who waited past the window and gave up', () => {
    const abandoned = { status: 'CANCELLED', createdAt: hoursAgo(100), updatedAt: hoursAgo(20), respondedAt: null }
    expect(ownerResponsiveness([abandoned], NOW).ignored).toBe(1)
  })

  it('does not count a renter who changed their own mind quickly', () => {
    const quickCancel = { status: 'CANCELLED', createdAt: hoursAgo(100), updatedAt: hoursAgo(99), respondedAt: null }
    const r = ownerResponsiveness([quickCancel], NOW)
    expect(r.ignored).toBe(0)
    expect(r.answered).toBe(0)
  })

  it('counts a cancellation the owner HAD answered as answered', () => {
    const answeredThenCancelled = { status: 'CANCELLED', createdAt: hoursAgo(100), updatedAt: hoursAgo(10), respondedAt: hoursAgo(99) }
    expect(ownerResponsiveness([answeredThenCancelled], NOW).answered).toBe(1)
  })
})

describe('speed', () => {
  it('is a multiplier, never its own additive term', () => {
    // A slow owner who answers everything must still outrank a fast one who
    // answers half — otherwise the fast-and-selective owner wins again, which
    // is the acceptance-rate bug in a new costume.
    const slowButReliable = ownerResponsiveness([answered('ACCEPTED', 200, 96), answered('REJECTED', 190, 96)], NOW)
    const fastButAbsent   = ownerResponsiveness([answered('ACCEPTED', 200, 1), pending(200)], NOW)
    expect(slowButReliable.responseRate * slowButReliable.speedFactor)
      .toBeGreaterThan(fastButAbsent.responseRate * fastButAbsent.speedFactor)
  })

  it('reads the median, so one slow reply does not define an owner', () => {
    const rows = [answered('ACCEPTED', 100, 1), answered('ACCEPTED', 90, 2), answered('ACCEPTED', 80, 200)]
    expect(ownerResponsiveness(rows, NOW).medianHours).toBe(2)
  })

  it('treats an unmeasurable history as neutral, not slow', () => {
    // Rows written before respondedAt existed. Their status says the owner
    // answered; nothing says when, and inventing a duration is exactly what
    // the migration refused to do.
    const legacy = [{ status: 'ACCEPTED', createdAt: hoursAgo(500), updatedAt: hoursAgo(400), respondedAt: null }]
    const r = ownerResponsiveness(legacy, NOW)
    expect(r.answered).toBe(1)
    expect(r.medianHours).toBeNull()
    expect(r.speedFactor).toBe(1)
  })

  it('never rewards slowness with a bonus', () => {
    for (const h of [0, 6, 24, 72, 500]) expect(speedFactor(h)).toBeLessThanOrEqual(1)
  })
})

describe('no history', () => {
  it('is neutral rather than zero or perfect', () => {
    // Zero would rank every brand-new owner below one who ignores people;
    // 100 would make silence profitable until the first request lands.
    expect(ownerResponsiveness([], NOW).responseRate).toBe(NEUTRAL_RATE)
  })
})
