// The tenancy record and its double-blind reviews.
//
// Like the saved-search suite, most assertions are about REFUSING: an
// unconfirmed tenancy that counted, a review shown early, a résumé served to
// a stranger — each is a fairness or privacy failure that would arrive
// without an error message.
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { prismaMock } from './mocks/prisma.js'

const notifyUser = vi.fn().mockResolvedValue({})
vi.mock('../src/features/notifications/notifications.service.js', () => ({
  notifyUser: (...a) => notifyUser(...a),
}))

const { isRevealed, canReview, tenancyMonths, REVEAL_WINDOW_DAYS, MIN_TENANCY_DAYS } =
  await import('../src/features/tenancies/reveal.js')
const {
  confirmTenancy, declineTenancy, addReview, listMyTenancies, tenantResume,
  ownerReviewsForProperty,
} = await import('../src/features/tenancies/tenancy.service.js')

const DAY = 24 * 60 * 60 * 1000
const NOW = new Date('2026-08-12T12:00:00Z')
const daysAgo = (n) => new Date(NOW.getTime() - n * DAY)

const tenancy = (over = {}) => ({
  id: 'tn-1', propertyId: 'p1', ownerId: 'owner-1', tenantId: 'renter-1',
  source: 'MARKED', leaseId: null,
  startedAt: daysAgo(90), endedAt: null, confirmedAt: daysAgo(89),
  ...over,
})
const review = (over = {}) => ({
  id: 'rv-1', tenancyId: 'tn-1', authorId: 'owner-1', targetId: 'renter-1',
  rating: 5, content: 'Paid on time, left it spotless.', createdAt: daysAgo(1),
  ...over,
})

beforeEach(() => {
  vi.clearAllMocks()
  prismaMock.tenancy.findMany.mockResolvedValue([])
  prismaMock.tenancy.findUnique.mockResolvedValue(null)
  prismaMock.tenancy.findFirst.mockResolvedValue(null)
  prismaMock.tenancy.updateMany.mockResolvedValue({ count: 0 })
  prismaMock.tenancyReview.findFirst.mockResolvedValue(null)
  prismaMock.conversation.count.mockResolvedValue(0)
  prismaMock.appointment.count.mockResolvedValue(0)
})

describe('reveal.js — the pure rules', () => {
  it('reveals when both reviews exist, whatever their age', () => {
    expect(isRevealed(review({ createdAt: NOW }), review(), NOW)).toBe(true)
  })

  it('holds a lone review for the window, then reveals it', () => {
    // Holding forever would let silence suppress criticism; revealing early
    // would turn the second review into a negotiation. 14 days is the line.
    const lone = review({ createdAt: daysAgo(REVEAL_WINDOW_DAYS - 1) })
    expect(isRevealed(lone, null, NOW)).toBe(false)
    const waited = review({ createdAt: daysAgo(REVEAL_WINDOW_DAYS) })
    expect(isRevealed(waited, null, NOW)).toBe(true)
  })

  it('lets nobody outside the tenancy review it', () => {
    expect(canReview(tenancy(), 'stranger', NOW).ok).toBe(false)
  })

  it('gives an UNCONFIRMED tenancy no review rights at all', () => {
    // An owner's assertion must not buy a review of the person it names.
    expect(canReview(tenancy({ confirmedAt: null }), 'owner-1', NOW).ok).toBe(false)
    expect(canReview(tenancy({ confirmedAt: null }), 'renter-1', NOW).ok).toBe(false)
  })

  it('opens reviews at 60 days in, or when the tenancy ends', () => {
    const young = tenancy({ startedAt: daysAgo(MIN_TENANCY_DAYS - 5) })
    expect(canReview(young, 'renter-1', NOW).ok).toBe(false)
    // Ending unlocks it regardless of age — a real one-month tenancy that
    // ended is a tenancy, not a farming attempt.
    expect(canReview({ ...young, endedAt: daysAgo(1) }, 'renter-1', NOW).ok).toBe(true)
    expect(canReview(tenancy({ startedAt: daysAgo(MIN_TENANCY_DAYS) }), 'owner-1', NOW).ok).toBe(true)
  })

  it('floors months — a résumé must never inflate', () => {
    expect(tenancyMonths(tenancy({ startedAt: daysAgo(59) }), NOW)).toBe(1)
    expect(tenancyMonths(tenancy({ startedAt: daysAgo(29) }), NOW)).toBe(0)
  })
})

describe('confirm / decline — the tenant’s word', () => {
  it('confirm is scoped to the tenant, and a stranger gets 404', async () => {
    await expect(confirmTenancy('tn-1', 'stranger')).rejects.toMatchObject({ statusCode: 404 })
    expect(prismaMock.tenancy.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'tn-1', tenantId: 'stranger', confirmedAt: null },
      data: expect.objectContaining({ confirmedAt: expect.any(Date) }),
    }))
  })

  it('confirm tells the owner, addressed to the OWNER hat', async () => {
    prismaMock.tenancy.updateMany.mockResolvedValue({ count: 1 })
    prismaMock.tenancy.findUnique.mockResolvedValue({ ...tenancy(), property: { title: 'Sunny 2BHK' } })
    await confirmTenancy('tn-1', 'renter-1')
    expect(notifyUser).toHaveBeenCalledWith('owner-1', expect.objectContaining({
      type: 'TENANCY_UPDATE', audience: 'OWNER',
    }))
  })

  it('decline DELETES the row — unconfirmed still names somebody', async () => {
    prismaMock.tenancy.findFirst.mockResolvedValue({ ...tenancy({ confirmedAt: null }), property: { title: 'Sunny 2BHK' } })
    await declineTenancy('tn-1', 'renter-1')
    expect(prismaMock.tenancy.delete).toHaveBeenCalledWith({ where: { id: 'tn-1' } })
  })

  it('a CONFIRMED tenancy cannot be declined away', async () => {
    // findFirst filters confirmedAt: null, so a confirmed row is not found.
    await expect(declineTenancy('tn-1', 'renter-1')).rejects.toMatchObject({ statusCode: 404 })
  })
})

describe('addReview — who may write, and who is told what', () => {
  it('a non-party gets 404 — a tenancy id must not prove a tenancy exists', async () => {
    prismaMock.tenancy.findUnique.mockResolvedValue(tenancy())
    await expect(addReview('tn-1', 'stranger', { rating: 5, content: 'ten chars ok' }))
      .rejects.toMatchObject({ statusCode: 404 })
  })

  it('an unconfirmed tenancy refuses with the reason', async () => {
    prismaMock.tenancy.findUnique.mockResolvedValue(tenancy({ confirmedAt: null }))
    await expect(addReview('tn-1', 'owner-1', { rating: 5, content: 'ten chars ok' }))
      .rejects.toMatchObject({ statusCode: 400 })
  })

  it('a second review from the same side is 409, not a duplicate row', async () => {
    prismaMock.tenancy.findUnique.mockResolvedValue(tenancy())
    prismaMock.tenancyReview.create.mockRejectedValue(Object.assign(new Error('dup'), { code: 'P2002' }))
    await expect(addReview('tn-1', 'owner-1', { rating: 4, content: 'ten chars ok' }))
      .rejects.toMatchObject({ statusCode: 409 })
  })

  it('the FIRST review tells the target one is waiting — without showing it', async () => {
    prismaMock.tenancy.findUnique.mockResolvedValue(tenancy())
    prismaMock.tenancyReview.create.mockResolvedValue(review())
    prismaMock.tenancyReview.findFirst.mockResolvedValue(null)
    await addReview('tn-1', 'owner-1', { rating: 5, content: 'ten chars ok' })
    expect(notifyUser).toHaveBeenCalledTimes(1)
    expect(notifyUser).toHaveBeenCalledWith('renter-1', expect.objectContaining({
      audience: 'TENANT', type: 'TENANCY_UPDATE',
    }))
  })

  it('the SECOND review lifts the blind and tells BOTH', async () => {
    prismaMock.tenancy.findUnique.mockResolvedValue(tenancy())
    prismaMock.tenancyReview.create.mockResolvedValue(review({ authorId: 'renter-1', targetId: 'owner-1' }))
    prismaMock.tenancyReview.findFirst.mockResolvedValue(review())
    await addReview('tn-1', 'renter-1', { rating: 4, content: 'ten chars ok' })
    expect(notifyUser).toHaveBeenCalledTimes(2)
  })
})

describe('listMyTenancies — what each side may see', () => {
  it('holds the other side’s fresh review but SAYS one is pending', async () => {
    // Hiding its existence makes the reveal an ambush; showing its text
    // breaks the blind. theirReviewPending is the honest middle.
    prismaMock.tenancy.findMany.mockResolvedValue([{
      ...tenancy(),
      property: { id: 'p1', title: 'Sunny 2BHK', city: 'Chennai', type: 'APARTMENT' },
      reviews: [review({ createdAt: new Date() })], // owner's, fresh
    }])
    const [row] = await listMyTenancies('renter-1', 'tenant')
    expect(row.theirReview).toBeNull()
    expect(row.theirReviewPending).toBe(true)
    expect(row.canReview).toBe(true)
  })

  it('shows both once both exist', async () => {
    prismaMock.tenancy.findMany.mockResolvedValue([{
      ...tenancy(),
      property: { id: 'p1', title: 'Sunny 2BHK', city: 'Chennai', type: 'APARTMENT' },
      reviews: [
        review({ createdAt: new Date() }),
        review({ id: 'rv-2', authorId: 'renter-1', targetId: 'owner-1', createdAt: new Date() }),
      ],
    }])
    const [row] = await listMyTenancies('renter-1', 'tenant')
    expect(row.myReview.id).toBe('rv-2')
    expect(row.theirReview.id).toBe('rv-1')
    expect(row.canReview).toBe(false)
  })
})

describe('tenantResume — the contact gate and what it strips', () => {
  it('is 404 with no conversation and no visit — never 403', async () => {
    await expect(tenantResume('owner-9', 'renter-1')).rejects.toMatchObject({ statusCode: 404 })
    expect(prismaMock.tenancy.findMany).not.toHaveBeenCalled()
  })

  it('serves only CONFIRMED tenancies, city and type only, reveal-filtered', async () => {
    prismaMock.conversation.count.mockResolvedValue(1)
    prismaMock.tenancy.findMany.mockResolvedValue([{
      ...tenancy(),
      property: { city: 'Chennai', type: 'APARTMENT' },
      reviews: [review({ createdAt: new Date() })], // owner's review, fresh, tenant silent
    }])
    const resume = await tenantResume('owner-9', 'renter-1')
    // The where itself must demand confirmation — an assertion is not history.
    expect(prismaMock.tenancy.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ confirmedAt: { not: null } }),
    }))
    expect(resume.count).toBe(1)
    const [entry] = resume.tenancies
    expect(entry.city).toBe('Chennai')
    expect(entry).not.toHaveProperty('title')
    expect(entry).not.toHaveProperty('address')
    // Fresh + unanswered = still blind, even on the résumé.
    expect(entry.review).toBeNull()
    expect(resume.averageRating).toBeNull()
  })
})

describe('ownerReviewsForProperty — the public half', () => {
  it('shows a revealed tenant review with a first name, never the full one', async () => {
    prismaMock.property.findUnique.mockResolvedValue({ ownerId: 'owner-1' })
    prismaMock.tenancy.findMany.mockResolvedValue([{
      ...tenancy(),
      property: { city: 'Chennai', type: 'APARTMENT' },
      tenant: { name: 'Asha Venkatesan' },
      reviews: [review({ authorId: 'renter-1', targetId: 'owner-1', createdAt: daysAgo(REVEAL_WINDOW_DAYS + 1) })],
    }])
    const reviews = await ownerReviewsForProperty('p1')
    expect(reviews).toHaveLength(1)
    expect(reviews[0].reviewerFirstName).toBe('Asha')
    expect(JSON.stringify(reviews)).not.toContain('Venkatesan')
    expect(JSON.stringify(reviews)).not.toContain('owner-1')
  })

  it('holds a fresh unanswered tenant review off the public page too', async () => {
    prismaMock.property.findUnique.mockResolvedValue({ ownerId: 'owner-1' })
    prismaMock.tenancy.findMany.mockResolvedValue([{
      ...tenancy(),
      property: { city: 'Chennai', type: 'APARTMENT' },
      tenant: { name: 'Asha' },
      reviews: [review({ authorId: 'renter-1', targetId: 'owner-1', createdAt: new Date() })],
    }])
    expect(await ownerReviewsForProperty('p1')).toHaveLength(0)
  })
})
