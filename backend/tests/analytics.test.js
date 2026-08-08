/**
 * Product telemetry — 2026-08-07.
 *
 * Before this, zero telemetry existed anywhere in the product, so every
 * decision was made on intuition. The point of the feature is that the numbers
 * it produces can be trusted enough to decide on, which makes these the
 * load-bearing properties:
 *
 *   1. The funnel counts SESSIONS, not events. One restless visitor tapping
 *      forty pins must not read as forty people reaching step two — that is
 *      how an instrumented product ends up more confident and less correct
 *      than an uninstrumented one.
 *   2. Recording can never break the thing being recorded. A failed insert
 *      loses a data point; a thrown one loses the user's action.
 *   3. `userId` comes from the token, never the body, and the event vocabulary
 *      is closed — a public write endpoint with an open name field and a
 *      caller-supplied user id is a free database.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { prismaMock } from './mocks/prisma.js'
import {
  recordEvents, record, getFunnel, getTimeToPublish, pruneOldEvents,
} from '../src/features/analytics/analytics.service.js'
import { FUNNEL, ENTRY, CLIENT_EVENTS, EVENT_NAMES, RETENTION_DAYS } from '../src/features/analytics/events.js'
import { ingestSchema } from '../src/features/analytics/analytics.validation.js'

const SESSION = 'sess_abcdef123456'

beforeEach(() => {
  vi.clearAllMocks()
  prismaMock.analyticsEvent.createMany.mockResolvedValue({ count: 1 })
  prismaMock.analyticsEvent.groupBy.mockResolvedValue([])
  prismaMock.analyticsEvent.findMany.mockResolvedValue([])
  prismaMock.analyticsEvent.deleteMany.mockResolvedValue({ count: 0 })
})

describe('the event vocabulary is closed', () => {
  it('accepts the funnel plus the entry marker from clients, and nothing else', () => {
    // Was `toEqual(FUNNEL)` until 2026-08-08, when `seo_landing_view` was added
    // — a thing only the client can witness, like the five funnel steps, but
    // deliberately NOT one of them: it is a segment ("of those who landed from
    // search…"), and putting it above `map_view` would make every session that
    // opened straight onto the map read as a drop-off from a page it never saw.
    expect(CLIENT_EVENTS).toEqual([...FUNNEL, ...ENTRY])

    // The property that actually matters, and the reason this test exists: the
    // client-sendable set is the two witness-able groups and NOTHING server-
    // side. Asserted as a rule rather than a list, so adding a group without
    // thinking about it fails here.
    expect(CLIENT_EVENTS).not.toContain('listing_publish_completed')
    expect(CLIENT_EVENTS.every((n) => EVENT_NAMES.includes(n))).toBe(true)
  })

  it('rejects an unknown event name rather than storing it', () => {
    const bad = ingestSchema.safeParse({
      events: [{ name: 'property_viewed', sessionId: SESSION }], // note the typo
    })
    expect(bad.success).toBe(false)
  })

  it('refuses server-only events from a client', () => {
    // Otherwise anyone could POST a publish with a two-second duration and
    // move the median that decides whether the wizard needs work.
    expect(EVENT_NAMES).toContain('listing_publish_completed')
    const parsed = ingestSchema.safeParse({
      events: [{ name: 'listing_publish_completed', sessionId: SESSION }],
    })
    expect(parsed.success).toBe(false)
  })

  it('caps prop values so an event cannot carry a payload', () => {
    const parsed = ingestSchema.safeParse({
      events: [{ name: 'map_view', sessionId: SESSION, props: { note: 'x'.repeat(500) } }],
    })
    expect(parsed.success).toBe(false)
  })

  it('bounds a single batch', () => {
    const events = Array.from({ length: 51 }, () => ({ name: 'map_view', sessionId: SESSION }))
    expect(ingestSchema.safeParse({ events }).success).toBe(false)
  })
})

describe('recording never breaks the caller', () => {
  it('swallows a database failure and reports nothing stored', async () => {
    prismaMock.analyticsEvent.createMany.mockRejectedValue(new Error('db down'))
    await expect(recordEvents([{ name: 'map_view', sessionId: SESSION }])).resolves.toBe(0)
  })

  it('does not throw from the fire-and-forget path', async () => {
    prismaMock.analyticsEvent.createMany.mockRejectedValue(new Error('db down'))
    expect(() => record('map_view', { userId: 'u1' })).not.toThrow()
    // Let the floated promise settle so a rejection would surface here.
    await new Promise((r) => setTimeout(r, 0))
  })

  it('writes nothing for an empty batch', async () => {
    await expect(recordEvents([])).resolves.toBe(0)
    expect(prismaMock.analyticsEvent.createMany).not.toHaveBeenCalled()
  })

  it('keys a server-side event to the user, not to one shared blank session', async () => {
    record('listing_publish_completed', { userId: 'u1' })
    await new Promise((r) => setTimeout(r, 0))
    const [row] = prismaMock.analyticsEvent.createMany.mock.calls.at(-1)[0].data
    expect(row.sessionId).toBe('server:u1')
  })
})

describe('the funnel counts sessions, not events', () => {
  // groupBy(['name','sessionId']) returns one row per (step, session) pair, so
  // a session that tapped forty pins appears once. These fixtures encode that.
  const rows = (pairs) => pairs.map(([name, sessionId]) => ({ name, sessionId }))

  it('counts one restless visitor once per step', async () => {
    prismaMock.analyticsEvent.groupBy.mockResolvedValue(rows([
      ['map_view', 's1'],
      ['pin_tap', 's1'],   // s1 tapped many pins; groupBy collapses them
      ['property_view', 's1'],
    ]))

    const { steps } = await getFunnel()
    expect(steps.find((s) => s.name === 'pin_tap').sessions).toBe(1)
  })

  it('quotes every rate against the TOP of the funnel, not the previous step', async () => {
    prismaMock.analyticsEvent.groupBy.mockResolvedValue(rows([
      ['map_view', 's1'], ['map_view', 's2'], ['map_view', 's3'], ['map_view', 's4'],
      ['pin_tap', 's1'], ['pin_tap', 's2'],
      ['property_view', 's1'],
    ]))

    const { steps } = await getFunnel()
    // 1 of 4 reached property_view = 25%, NOT 50% of the 2 who tapped a pin.
    expect(steps.find((s) => s.name === 'property_view').pctOfTop).toBe(25)
  })

  it('reports every step, including the ones nobody reached', async () => {
    prismaMock.analyticsEvent.groupBy.mockResolvedValue(rows([['map_view', 's1']]))
    const { steps } = await getFunnel()
    expect(steps.map((s) => s.name)).toEqual(FUNNEL)
    expect(steps.find((s) => s.name === 'appointment_created').sessions).toBe(0)
  })

  it('says "no data" rather than "0% convert" when nobody has visited', async () => {
    const { steps } = await getFunnel()
    // A 0 here would read as a catastrophic conversion rate; null reads as
    // what it is — nothing to divide by.
    expect(steps[0].pctOfTop).toBeNull()
  })
})

describe('time to publish', () => {
  const publishes = (...mins) =>
    mins.map((m) => ({ props: { msSinceDraftStart: m * 60_000 } }))

  it('reports the median, not the mean', async () => {
    // One owner left a draft open for a day. A mean would report ~5 hours and
    // send someone off to rebuild a wizard that takes six minutes.
    prismaMock.analyticsEvent.findMany.mockResolvedValue(publishes(5, 6, 7, 1440))
    const { medianMinutes } = await getTimeToPublish()
    expect(medianMinutes).toBe(7) // (6 + 7) / 2 = 6.5 → 7
  })

  it('carries the sample size, because five listings is not a trend', async () => {
    prismaMock.analyticsEvent.findMany.mockResolvedValue(publishes(4, 9))
    expect(await getTimeToPublish()).toMatchObject({ samples: 2 })
  })

  it('returns null rather than a number invented from nothing', async () => {
    expect(await getTimeToPublish()).toMatchObject({ samples: 0, medianMinutes: null })
  })

  it('ignores rows with a missing or nonsense duration', async () => {
    prismaMock.analyticsEvent.findMany.mockResolvedValue([
      { props: null },
      { props: { msSinceDraftStart: -5 } },
      { props: { msSinceDraftStart: 600_000 } },
    ])
    expect(await getTimeToPublish()).toMatchObject({ samples: 1, medianMinutes: 10 })
  })
})

describe('the publish emitter cannot break a publish', () => {
  // Found by the existing publish tests going red on a TypeError: the first
  // version used .then().catch(), which catches a rejection but not a
  // synchronous throw from the lookup itself. An owner would have lost their
  // publish over a telemetry read.
  it('survives a lookup that throws synchronously', async () => {
    const { publishProperty } = await import('../src/features/properties/properties.service.js')

    prismaMock.property.findUnique.mockResolvedValue({ id: 'p1', ownerId: 'u1', status: 'DRAFT', city: 'Chennai' })
    prismaMock.property.update.mockResolvedValue({ id: 'p1', status: 'PENDING' })
    prismaMock.listingDraft.findUnique.mockImplementation(() => { throw new Error('boom') })

    await expect(publishProperty('p1', 'u1')).resolves.toMatchObject({ status: 'PENDING' })
  })
})

describe('retention', () => {
  it('deletes past the retention window and nothing inside it', async () => {
    const now = new Date('2026-08-07T00:00:00Z')
    await pruneOldEvents(now)

    const { where } = prismaMock.analyticsEvent.deleteMany.mock.calls[0][0]
    const cutoff = where.createdAt.lt
    const daysBack = Math.round((now - cutoff) / 86_400_000)
    expect(daysBack).toBe(RETENTION_DAYS)
  })
})

/**
 * Segmenting the funnel by how the session arrived — 2026-08-08.
 *
 * `seo_landing_view` was collected from the day it shipped and nothing read it,
 * which is a table rather than instrumentation. The trap this closes: the
 * sitewide funnel's denominator is `map_view`, and a session that landed on
 * /rent/chennai and clicked straight to a listing may never fire it.
 */
describe('the SEO segment is measured against its own arrival, not the map', () => {
  const rows = (pairs) => pairs.map(([name, sessionId]) => ({ name, sessionId }))

  it('counts only sessions that landed on a search page', async () => {
    prismaMock.analyticsEvent.groupBy.mockResolvedValue(rows([
      ['seo_landing_view', 's1'],
      ['property_view', 's1'],
      ['map_view', 's2'],        // arrived on the map — not in the segment
      ['property_view', 's2'],
    ]))

    const { steps, top } = await getFunnel({ segment: 'seo' })
    expect(top).toBe(1)
    expect(steps.find((s) => s.name === 'property_view').sessions).toBe(1)
  })

  it('never reports a rate above 100% for a session that skipped the map', async () => {
    // The whole reason the denominator changes. Three landed from search and
    // reached a listing; NONE saw the map. Against `map_view` that is 3/0.
    prismaMock.analyticsEvent.groupBy.mockResolvedValue(rows([
      ['seo_landing_view', 's1'], ['property_view', 's1'],
      ['seo_landing_view', 's2'], ['property_view', 's2'],
      ['seo_landing_view', 's3'], ['property_view', 's3'],
    ]))

    const { steps, top, topLabel } = await getFunnel({ segment: 'seo' })
    expect(top).toBe(3)
    expect(topLabel).toBe('landed from search')
    expect(steps.find((s) => s.name === 'property_view').pctOfTop).toBe(100)
    expect(steps.every((s) => s.pctOfTop === null || s.pctOfTop <= 100)).toBe(true)
  })

  it('leaves the sitewide funnel measured against map_view', async () => {
    prismaMock.analyticsEvent.groupBy.mockResolvedValue(rows([
      ['seo_landing_view', 's1'], ['property_view', 's1'],
      ['map_view', 's2'], ['map_view', 's3'],
    ]))

    const { top, topLabel, steps } = await getFunnel()
    expect(top).toBe(2)
    expect(topLabel).toBe('map_view')
    // s1 never saw the map but still opened a listing — it counts sitewide.
    expect(steps.find((s) => s.name === 'property_view').sessions).toBe(1)
  })

  it('says "nothing to divide by" rather than 0% when nobody landed from search', async () => {
    prismaMock.analyticsEvent.groupBy.mockResolvedValue(rows([['map_view', 's1']]))
    const { top, steps } = await getFunnel({ segment: 'seo' })
    expect(top).toBe(0)
    expect(steps[0].pctOfTop).toBeNull()
  })
})
