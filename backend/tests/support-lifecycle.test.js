/**
 * The case lifecycle, as a closed machine.
 *
 * A status is not decoration. RESOLVED stamps `resolvedAt`, which every SLA
 * number is computed from, and CLOSED is meant to be final — so a service that
 * accepted any status from a request body would let a caller reopen a closed
 * case, un-resolve a resolved one, or quietly rewrite the timings a support
 * team is measured on.
 */
import { describe, it, expect } from 'vitest'
import {
  STATUS, TRANSITIONS, canTransition, assertTransition,
  transitionStamps, statusAfterReply,
} from '../src/features/support/lifecycle.js'

const ALL = Object.values(STATUS)

describe('the table is complete', () => {
  it('gives every status an entry — a missing one silently means "no moves"', () => {
    for (const s of ALL) expect(TRANSITIONS[s], s).toBeDefined()
  })

  it('never lists a destination that is not a real status', () => {
    for (const [from, tos] of Object.entries(TRANSITIONS)) {
      for (const to of tos) expect(ALL, `${from} → ${to}`).toContain(to)
    }
  })

  it('never lists a status as its own destination', () => {
    for (const [from, tos] of Object.entries(TRANSITIONS)) expect(tos).not.toContain(from)
  })
})

describe('CLOSED is the only final state', () => {
  it('goes nowhere', () => {
    expect(TRANSITIONS[STATUS.CLOSED]).toEqual([])
    for (const to of ALL) expect(canTransition(STATUS.CLOSED, to)).toBe(false)
  })

  it('explains itself rather than saying "invalid transition"', () => {
    // The one people hit: a closed case looks like every other case in a list.
    expect(() => assertTransition(STATUS.CLOSED, STATUS.IN_PROGRESS))
      .toThrow(/closed/i)
  })

  it('is reachable from everywhere else, so nothing can get stuck', () => {
    for (const from of ALL.filter((s) => s !== STATUS.CLOSED)) {
      expect(canTransition(from, STATUS.CLOSED), from).toBe(true)
    }
  })
})

describe('RESOLVED can be disagreed with', () => {
  it('reopens to IN_PROGRESS', () => {
    // "We think this is fixed" is a claim the other person may reject, and
    // forcing a new case loses the history that explains the bad fix.
    expect(canTransition(STATUS.RESOLVED, STATUS.IN_PROGRESS)).toBe(true)
  })

  it('does not go back to triage — a reopened case is being worked on', () => {
    expect(canTransition(STATUS.RESOLVED, STATUS.TRIAGED)).toBe(false)
    expect(canTransition(STATUS.RESOLVED, STATUS.OPEN)).toBe(false)
  })
})

describe('the working states reach each other', () => {
  // Support is not a pipeline. A case waiting on an owner returns to
  // IN_PROGRESS the moment they answer, and pretending otherwise only makes
  // people set the wrong status.
  const WORKING = [STATUS.TRIAGED, STATUS.IN_PROGRESS, STATUS.WAITING_FOR_USER, STATUS.WAITING_FOR_OWNER, STATUS.ESCALATED]

  it.each(WORKING)('%s reaches every other working state', (from) => {
    for (const to of WORKING.filter((s) => s !== from)) {
      expect(canTransition(from, to), `${from} → ${to}`).toBe(true)
    }
  })
})

describe('assertTransition', () => {
  it('rejects a no-op with a sentence a person can read', () => {
    expect(() => assertTransition(STATUS.OPEN, STATUS.OPEN)).toThrow(/already/i)
  })

  it('marks its errors 400 and exposed, so the message survives production', () => {
    // error.middleware.js sanitises 5xx in production; these are the caller's
    // mistake and must say so.
    try {
      assertTransition(STATUS.CLOSED, STATUS.OPEN)
      throw new Error('should have thrown')
    } catch (err) {
      expect(err.statusCode).toBe(400)
      expect(err.expose).toBe(true)
    }
  })

  it('throws rather than returning false', () => {
    // A boolean here fails silently when a caller forgets to check it, and the
    // failure mode is applying an illegal transition.
    expect(assertTransition(STATUS.OPEN, STATUS.IN_PROGRESS)).toBeUndefined()
  })
})

describe('what a transition stamps', () => {
  it('stamps resolvedAt on RESOLVED', () => {
    expect(transitionStamps(STATUS.RESOLVED, {}).resolvedAt).toBeInstanceOf(Date)
  })

  it('never re-stamps resolvedAt on a case that already had one', () => {
    // Reopening and re-resolving must not overwrite the FIRST resolution — the
    // SLA question is how fast support answered, not how many attempts it took.
    const first = new Date('2026-08-01T10:00:00Z')
    expect(transitionStamps(STATUS.RESOLVED, { resolvedAt: first }).resolvedAt).toBeUndefined()
  })

  it('stamps both when a case is closed without ever being resolved', () => {
    // A case closed as spam was never "resolved", but resolution metrics that
    // silently exclude it would overstate how much really got fixed.
    const stamps = transitionStamps(STATUS.CLOSED, {})
    expect(stamps.closedAt).toBeInstanceOf(Date)
    expect(stamps.resolvedAt).toBeInstanceOf(Date)
  })

  it('leaves an already-resolved case’s resolvedAt alone when closing', () => {
    const first = new Date('2026-08-01T10:00:00Z')
    const stamps = transitionStamps(STATUS.CLOSED, { resolvedAt: first })
    expect(stamps.resolvedAt).toBeUndefined()
    expect(stamps.closedAt).toBeInstanceOf(Date)
  })

  it('stamps nothing for the working states', () => {
    for (const s of [STATUS.TRIAGED, STATUS.IN_PROGRESS, STATUS.ESCALATED]) {
      expect(transitionStamps(s, {})).toEqual({})
    }
  })
})

describe('statusAfterReply', () => {
  it('moves a waiting case forward when the party it waited on answers', () => {
    // The most common event in any support system, and leaving it WAITING is
    // how a queue fills with cases that are actually waiting on staff.
    expect(statusAfterReply(STATUS.WAITING_FOR_USER, 'TENANT')).toBe(STATUS.IN_PROGRESS)
    expect(statusAfterReply(STATUS.WAITING_FOR_OWNER, 'OWNER')).toBe(STATUS.IN_PROGRESS)
  })

  it('does not move it when the OTHER party speaks', () => {
    expect(statusAfterReply(STATUS.WAITING_FOR_OWNER, 'TENANT')).toBeNull()
    expect(statusAfterReply(STATUS.WAITING_FOR_USER, 'OWNER')).toBeNull()
  })

  it('picks up a brand-new case when staff reply', () => {
    expect(statusAfterReply(STATUS.OPEN, 'ADMIN')).toBe(STATUS.IN_PROGRESS)
    expect(statusAfterReply(STATUS.OPEN, 'SUPPORT_AGENT')).toBe(STATUS.IN_PROGRESS)
  })

  it('never resurrects a finished case through a reply', () => {
    // Reopening is an explicit act, not a side effect of somebody typing.
    for (const role of ['TENANT', 'OWNER', 'ADMIN']) {
      expect(statusAfterReply(STATUS.CLOSED, role)).toBeNull()
      expect(statusAfterReply(STATUS.RESOLVED, role)).toBeNull()
    }
  })
})
