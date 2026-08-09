// The supply-side and match metrics.
//
// What is worth testing here is not arithmetic — it is the four judgements the
// numbers encode, each of which produces a plausible, wrong, and much more
// flattering figure when broken:
//
//   an unanswered conversation must COUNT, not vanish
//   a vacancy is not new supply
//   a step's own date must not let it outgrow the step above it
//   a median must never be reported without its sample size
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { prismaMock } from './mocks/prisma.js'
import { firstPublishStamp } from '../src/features/properties/publishedAt.js'
import {
  getDraftFunnel,
  getOwnerResponsiveness,
  getMatchChain,
  getDeadInventory,
  getListingReadiness,
} from '../src/features/analytics/marketplace.service.js'

const HOUR = 60 * 60 * 1000
const ago = (ms) => new Date(Date.now() - ms)

beforeEach(() => {
  vi.clearAllMocks()
  prismaMock.listingDraft.findMany.mockResolvedValue([])
  prismaMock.$queryRaw.mockResolvedValue([])
  prismaMock.conversation.count.mockResolvedValue(0)
  prismaMock.appointment.count.mockResolvedValue(0)
  prismaMock.lease.count.mockResolvedValue(0)
  prismaMock.lease.findMany.mockResolvedValue([])
  prismaMock.property.findMany.mockResolvedValue([])
  prismaMock.propertyDailyView.groupBy.mockResolvedValue([])
  prismaMock.conversation.groupBy.mockResolvedValue([])
})

describe('getDraftFunnel', () => {
  it('groups stalled drafts by the step KEY, not the index', async () => {
    // Web runs six wizard steps and mobile seven, so index 4 is `photos` on one
    // and `features` on the other. Grouping by index would merge two different
    // questions into one bar and point supply work at the wrong screen.
    prismaMock.listingDraft.findMany.mockResolvedValue([
      { savedAt: ago(2 * HOUR), payload: { stepKey: 'photos', stepIdx: 4 } },
      { savedAt: ago(3 * HOUR), payload: { stepKey: 'photos', stepIdx: 3 } },
      { savedAt: ago(4 * HOUR), payload: { stepKey: 'price', stepIdx: 4 } },
    ])
    const { byStep } = await getDraftFunnel()
    expect(byStep[0]).toEqual({ stepKey: 'photos', count: 2 })
    expect(byStep).toContainEqual({ stepKey: 'price', count: 1 })
  })

  it('calls a draft with no step key unknown rather than guessing one', async () => {
    prismaMock.listingDraft.findMany.mockResolvedValue([{ savedAt: ago(HOUR), payload: {} }])
    const { byStep } = await getDraftFunnel()
    expect(byStep).toEqual([{ stepKey: 'unknown', count: 1 }])
  })

  it('counts drafts older than the stale window separately', async () => {
    prismaMock.listingDraft.findMany.mockResolvedValue([
      { savedAt: ago(HOUR), payload: { stepKey: 'basics' } },
      { savedAt: ago(30 * 24 * HOUR), payload: { stepKey: 'basics' } },
    ])
    const res = await getDraftFunnel()
    expect(res.open).toBe(2)
    expect(res.stale).toBe(1)
  })

  it('reports nothing rather than zero when there are no drafts', async () => {
    // A median of 0 hours would read as "everyone finishes instantly".
    const res = await getDraftFunnel()
    expect(res).toMatchObject({ open: 0, stale: 0, medianAgeHours: null, byStep: [] })
  })
})

describe('getOwnerResponsiveness', () => {
  const asked = ago(10 * HOUR)

  it('counts a conversation the owner never answered', async () => {
    // THE test in this file. Dropping unanswered rows would make the metric
    // improve every time an owner ignores somebody.
    prismaMock.$queryRaw.mockResolvedValue([
      { conversationId: 'c1', asked_at: asked, answered_at: new Date(asked.getTime() + 30 * 60000) },
      { conversationId: 'c2', asked_at: asked, answered_at: null },
    ])
    const res = await getOwnerResponsiveness()
    expect(res.conversations).toBe(2)
    expect(res.answered).toBe(1)
    expect(res.neverAnswered).toBe(1)
  })

  it('measures the wait in minutes from the ask to the first reply', async () => {
    prismaMock.$queryRaw.mockResolvedValue([
      { conversationId: 'c1', asked_at: asked, answered_at: new Date(asked.getTime() + 2 * HOUR) },
    ])
    expect((await getOwnerResponsiveness()).medianMinutes).toBe(120)
  })

  it('reports a null median when nobody has replied at all', async () => {
    prismaMock.$queryRaw.mockResolvedValue([{ conversationId: 'c1', asked_at: asked, answered_at: null }])
    const res = await getOwnerResponsiveness()
    expect(res.medianMinutes).toBeNull()
    expect(res.neverAnswered).toBe(1)
  })
})

describe('getMatchChain', () => {
  it('counts every step by when it STARTED, so no step can exceed the one above', async () => {
    prismaMock.conversation.count.mockResolvedValue(10)
    prismaMock.appointment.count.mockImplementation(({ where }) =>
      Promise.resolve(where.status === 'ACCEPTED' ? 4 : 6))
    prismaMock.lease.count.mockResolvedValue(2)
    prismaMock.lease.findMany.mockResolvedValue([])

    const { steps } = await getMatchChain()
    const counts = steps.map((s) => s.count)
    expect(counts).toEqual([10, 6, 4, 2, 0])
    for (let i = 1; i < counts.length; i++) expect(counts[i]).toBeLessThanOrEqual(counts[i - 1])
  })

  it('measures time-to-lease from the visit request, not the lease offer', async () => {
    const requested = ago(10 * 24 * HOUR)
    prismaMock.lease.findMany.mockResolvedValue([
      { createdAt: ago(2 * 24 * HOUR), signedAt: ago(0), appointment: { createdAt: requested } },
    ])
    const res = await getMatchChain()
    expect(res.medianDaysToLease).toBe(10)
    expect(res.samples).toBe(1)
  })

  it('excludes a lease with no appointment behind it from the duration', async () => {
    // An owner and renter who settled it in chat have no visit to measure from.
    // Falling back to the offer date would report a much shorter journey under
    // the same label.
    prismaMock.lease.findMany.mockResolvedValue([
      { createdAt: ago(2 * 24 * HOUR), signedAt: ago(0), appointment: null },
    ])
    const res = await getMatchChain()
    expect(res.medianDaysToLease).toBeNull()
    expect(res.samples).toBe(0)
  })
})

describe('firstPublishStamp', () => {
  it('stamps a listing going live for the first time', () => {
    expect(firstPublishStamp({ status: 'PENDING', publishedAt: null }, 'ACTIVE')).toHaveProperty('publishedAt')
  })

  it('never re-stamps a listing that was reinstated', () => {
    const already = new Date('2026-01-01')
    expect(firstPublishStamp({ status: 'SUSPENDED', publishedAt: already }, 'ACTIVE')).toEqual({})
  })

  it('refuses a vacancy — an ex-tenant leaving is not new supply', () => {
    expect(firstPublishStamp({ status: 'OCCUPIED', publishedAt: null }, 'ACTIVE')).toEqual({})
  })

  it('does nothing for any other status', () => {
    expect(firstPublishStamp({ status: 'PENDING', publishedAt: null }, 'REJECTED')).toEqual({})
  })
})

describe('getDeadInventory', () => {
  it('separates never-opened from opened-but-never-messaged', async () => {
    // Two different problems with two different fixes — a sum would hide which.
    prismaMock.property.findMany.mockResolvedValue([
      { id: 'p1', title: 'Unseen', city: 'Chennai', createdAt: new Date(), publishedAt: null },
      { id: 'p2', title: 'Seen',   city: 'Chennai', createdAt: new Date(), publishedAt: null },
    ])
    prismaMock.propertyDailyView.groupBy.mockResolvedValue([{ propertyId: 'p2', _sum: { count: 40 } }])
    prismaMock.conversation.groupBy.mockResolvedValue([])

    const res = await getDeadInventory()
    expect(res.unseen).toBe(1)
    expect(res.seenButUncontacted).toBe(1)
  })

  it('does not call a listing dead when somebody messaged about it', async () => {
    prismaMock.property.findMany.mockResolvedValue([
      { id: 'p1', title: 'Busy', city: 'Chennai', createdAt: new Date(), publishedAt: null },
    ])
    prismaMock.propertyDailyView.groupBy.mockResolvedValue([{ propertyId: 'p1', _sum: { count: 5 } }])
    prismaMock.conversation.groupBy.mockResolvedValue([{ propertyId: 'p1', _count: { _all: 2 } }])

    const res = await getDeadInventory()
    expect(res.seenButUncontacted).toBe(0)
    expect(res.worst).toHaveLength(0)
  })
})

describe('getListingReadiness', () => {
  it('buckets photo counts and flags thin descriptions', async () => {
    prismaMock.property.findMany.mockResolvedValue([
      { id: 'a', title: 'No photos', description: 'x'.repeat(200), _count: { images: 0 }, verification: null },
      { id: 'b', title: 'Two',       description: 'short',          _count: { images: 2 }, verification: null },
      { id: 'c', title: 'Good',      description: 'x'.repeat(200),  _count: { images: 6 }, verification: { status: 'VERIFIED' } },
    ])
    const res = await getListingReadiness()
    expect(res.photos).toEqual({ none: 1, few: 1, enough: 1 })
    expect(res.noDescription).toBe(1)
    expect(res.verified).toBe(1)
    // Only the two that need work, never the healthy one.
    expect(res.worst.map((p) => p.id)).toEqual(['a', 'b'])
  })
})
