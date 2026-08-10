/**
 * What an admin may do to a listing.
 *
 * Two failures this pins, both reported as "the buttons are just not there":
 *
 *   1. The table must AGREE WITH THE SERVER. `setPropertyStatus` refuses ACTIVE
 *      from anything but PENDING / SUSPENDED / REJECTED / ACTIVE, so a button
 *      offered outside that set is a 409 wearing a green fill — which reads as
 *      the panel being broken rather than the action being wrong.
 *   2. Every status must resolve to SOMETHING on screen: either actions or a
 *      sentence saying why there are none. A header showing a pill and nothing
 *      else is indistinguishable from a page that failed to load.
 *
 * The server rule is READ FROM admin.service.js rather than copied here. A
 * transcribed constant is the thing that drifts, and this file exists because
 * two hand-written copies of these rules already had.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  MODERATION_ACTIONS, ACTION_META, NO_ACTION_REASON, moderationActionsFor,
} from './moderationActions'

// Every value of the PropertyStatus enum, read from the schema so a new one
// cannot be added without this file noticing.
// process.cwd() is frontend/ under vitest. import.meta.url is not a file:
// URL after the transform, which is why this is not the usual new URL(...).
const repoFile = (p) => readFileSync(resolve(process.cwd(), '..', p), 'utf8')
const SCHEMA = repoFile('backend/prisma/schema.prisma')
const STATUSES = SCHEMA
  .slice(SCHEMA.indexOf('enum PropertyStatus'))
  .split('}')[0]
  .split('\n')
  .slice(1)
  .map((l) => l.trim())
  .filter((l) => /^[A-Z_]+$/.test(l))

describe('the vocabulary', () => {
  it('found the enum at all', () => {
    // If this ever reads zero, every other test below passes vacuously.
    expect(STATUSES.length).toBeGreaterThan(5)
    expect(STATUSES).toContain('ACTIVE')
  })

  it('covers every status the database can hold', () => {
    for (const status of STATUSES) {
      expect(MODERATION_ACTIONS, status).toHaveProperty(status)
    }
  })

  it('offers only actions it has a label and a target status for', () => {
    for (const keys of Object.values(MODERATION_ACTIONS)) {
      for (const key of keys) expect(ACTION_META, key).toHaveProperty(key)
    }
  })

  it('answers an unknown status with nothing, not everything', () => {
    // Fail closed: a status nobody has reasoned about is not one to offer
    // moderation on.
    expect(moderationActionsFor('WHATEVER')).toEqual([])
    expect(moderationActionsFor(undefined)).toEqual([])
  })
})

describe('agreeing with what the server will accept', () => {
  const SERVICE = repoFile('backend/src/features/admin/admin.service.js')

  // The guard reads: if (status === 'ACTIVE' && !['PENDING', …].includes(current.status))
  const guard = /status === 'ACTIVE' && !\[([^\]]+)\]\.includes\(current\.status\)/.exec(SERVICE)
  const CAN_BECOME_ACTIVE = (guard?.[1] ?? '').match(/'([A-Z_]+)'/g)?.map((s) => s.replace(/'/g, '')) ?? []

  it('read the server guard', () => {
    expect(CAN_BECOME_ACTIVE.length).toBeGreaterThan(2)
  })

  it('never offers approve or reinstate where the server would 409', () => {
    for (const [status, keys] of Object.entries(MODERATION_ACTIONS)) {
      const publishes = keys.filter((k) => ACTION_META[k].status === 'ACTIVE')
      if (publishes.length === 0) continue
      expect(CAN_BECOME_ACTIVE, `${status} offers ${publishes.join('/')}`).toContain(status)
    }
  })

  it('offers a way back for everything the server WILL let us publish', () => {
    // The half that was actually broken: REJECTED can become ACTIVE and the
    // detail view offered nothing, so a mistaken rejection could be undone from
    // the map and not from the page called Review Listings.
    for (const status of CAN_BECOME_ACTIVE) {
      if (status === 'ACTIVE') continue   // already live; nothing to undo
      const keys = moderationActionsFor(status)
      expect(keys.some((k) => ACTION_META[k].status === 'ACTIVE'), status).toBe(true)
    }
  })
})

describe('no status is a blank screen', () => {
  it('every status either offers actions or says why it does not', () => {
    for (const status of STATUSES) {
      const hasActions = moderationActionsFor(status).length > 0
      const hasReason = Boolean(NO_ACTION_REASON[status])
      expect(hasActions || hasReason, `${status} renders nothing at all`).toBe(true)
    }
  })

  it('does not put a reason beside buttons — it is the alternative to them', () => {
    for (const status of STATUSES) {
      if (moderationActionsFor(status).length > 0) {
        expect(NO_ACTION_REASON[status], status).toBeUndefined()
      }
    }
  })

  it("leaves the owner's own states alone", () => {
    // A DRAFT is unfinished work and INACTIVE is an owner's own pause. An admin
    // writing either would be overriding a decision that was never ours.
    expect(moderationActionsFor('DRAFT')).toEqual([])
    expect(moderationActionsFor('INACTIVE')).toEqual([])
  })
})

describe('the specific gaps this replaced', () => {
  it('can take a live listing down', () => {
    expect(moderationActionsFor('ACTIVE')).toContain('pause')
    expect(moderationActionsFor('ACTIVE')).toContain('reject')
  })

  it('can undo a rejection', () => {
    expect(moderationActionsFor('REJECTED')).toContain('reinstate')
  })

  it('calls undoing our own pause "Reinstate", not "Approve"', () => {
    // The listing was live once and we took it down. The honest verb is undoing
    // our own action, not blessing theirs.
    expect(moderationActionsFor('SUSPENDED')).toContain('reinstate')
    expect(ACTION_META.reinstate.label).toBe('Reinstate')
  })
})
