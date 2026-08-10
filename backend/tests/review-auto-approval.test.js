/**
 * Review auto-approval — every review used to queue for a moderator, which made
 * moderation a tax on the good ones and buried the few worth reading. A review
 * averaging ABOVE 2.5 publishes itself; at or below it, a human looks first.
 *
 * Three things here fail silently if they break, which is why they are pinned:
 * the threshold itself (a review that should have been read gets published),
 * the moderated-out guard (a rejected review is laundered back onto a listing
 * by editing one word), and the two side effects approval has always carried —
 * without them an auto-published review is invisible to the trust score, and
 * points are paid only for reviews bad enough to reach a moderator.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { prismaMock } from './mocks/prisma.js'

vi.mock('../src/features/trust/trust.service.js', () => ({
  recalculateTrustScore: vi.fn().mockResolvedValue(null),
}))
vi.mock('../src/features/notifications/notifications.service.js', () => ({
  notifyUser: vi.fn().mockResolvedValue(null),
}))

const { submitReview, AUTO_APPROVE_ABOVE } = await import('../src/features/reviews/reviews.service.js')
const { recalculateTrustScore } = await import('../src/features/trust/trust.service.js')
const { RATING_FIELDS, averageRating } = await import('../src/features/reviews/rating.js')

// Ratings that straddle `value` WITHOUT being identical. Twelve of the same
// number is itself an integrity signal (integrity.js), so a uniform fixture
// would exercise the hold path and quietly stop testing the threshold at all.
const reviewAt = (value) => {
  const low = Math.max(1, value - 1)
  const high = Math.min(5, value + 1)
  return {
    reviewerType: 'TENANT',
    recommend: value > 2.5,
    body: 'x'.repeat(20),
    ...Object.fromEntries(RATING_FIELDS.map((f, i) => [f, i % 2 === 0 ? low : high])),
  }
}

// The upsert echoes back the status the service decided, as Prisma would.
const echoStatus = () =>
  prismaMock.communityReview.upsert.mockImplementation(({ create }) =>
    Promise.resolve({ id: 'rev-1', propertyId: 'prop-1', reviewerId: 'user-9', ...create }),
  )

beforeEach(() => {
  vi.clearAllMocks()
  prismaMock.communityReview.findUnique.mockResolvedValue(null)
  // A clean reviewer: settled account, no other reviews of this owner. Set
  // explicitly rather than left to the mock's defaults, because every integrity
  // signal HOLDS a review — a test asserting APPROVED would otherwise pass or
  // fail on whichever way an unmocked call happened to resolve.
  prismaMock.user.findUnique.mockResolvedValue({ createdAt: new Date('2020-01-01') })
  prismaMock.property.findUnique.mockResolvedValue({ ownerId: 'owner-1' })
  prismaMock.communityReview.count.mockResolvedValue(0)
  prismaMock.pointsLedger = {
    create:    vi.fn().mockResolvedValue({ id: 'pl-1', points: 80 }),
    aggregate: vi.fn().mockResolvedValue({ _sum: { points: 80 } }),
    findMany:  vi.fn().mockResolvedValue([]),
  }
  echoStatus()
})

const statusFor = async (value) => {
  const review = await submitReview('user-9', 'prop-1', reviewAt(value))
  return review.status
}

describe('the threshold', () => {
  it('publishes a review averaging above 2.5', async () => {
    expect(await statusFor(3)).toBe('APPROVED')
    expect(await statusFor(5)).toBe('APPROVED')
  })

  it('sends 2.5 itself to a moderator — "2.5 and below", not "below 2.5"', async () => {
    // 12 ratings: six 2s and six 3s average to exactly 2.5, the boundary case
    // an inequality is easiest to get wrong on.
    const half = { ...reviewAt(2), ...Object.fromEntries(RATING_FIELDS.slice(6).map((f) => [f, 3])) }
    expect(averageRating(half)).toBe(2.5)
    const review = await submitReview('user-9', 'prop-1', half)
    expect(review.status).toBe('PENDING')
  })

  it('sends anything below it to a moderator', async () => {
    expect(await statusFor(1)).toBe('PENDING')
    expect(await statusFor(2)).toBe('PENDING')
  })

  it('is 2.5, and moving it is a product decision rather than a refactor', () => {
    expect(AUTO_APPROVE_ABOVE).toBe(2.5)
  })
})

describe('a moderator verdict survives an edit', () => {
  for (const previous of ['REJECTED', 'FLAGGED']) {
    it(`re-queues a ${previous} review however high the new ratings are`, async () => {
      prismaMock.communityReview.findUnique.mockResolvedValue({ status: previous })
      expect(await statusFor(5)).toBe('PENDING')
    })
  }

  it('does not re-queue an edit of an already-approved review', async () => {
    prismaMock.communityReview.findUnique.mockResolvedValue({ status: 'APPROVED' })
    expect(await statusFor(4)).toBe('APPROVED')
  })
})

describe('an integrity signal outranks the rating', () => {
  it('holds a glowing review whose author signed up an hour ago', async () => {
    prismaMock.user.findUnique.mockResolvedValue({ createdAt: new Date(Date.now() - 3_600_000) })
    expect(await statusFor(5)).toBe('PENDING')
  })

  it('records WHY, so a moderator is not left guessing at a 5-star review', async () => {
    prismaMock.user.findUnique.mockResolvedValue({ createdAt: new Date(Date.now() - 3_600_000) })
    const review = await submitReview('user-9', 'prop-1', reviewAt(5))
    expect(review.integritySignals).toContain('NEW_ACCOUNT')
  })

  it('stores an empty array when nothing fired — "checked" is not "never checked"', async () => {
    const review = await submitReview('user-9', 'prop-1', reviewAt(4))
    expect(review.integritySignals).toEqual([])
  })
})

describe('composeMs is measurement, not review content', () => {
  it('never reaches the write', async () => {
    await submitReview('user-9', 'prop-1', { ...reviewAt(4), composeMs: 90_000 })
    const { create, update } = prismaMock.communityReview.upsert.mock.calls[0][0]
    expect(create).not.toHaveProperty('composeMs')
    expect(update).not.toHaveProperty('composeMs')
  })

  it('still counts against the review — a rushed one is held', async () => {
    const review = await submitReview('user-9', 'prop-1', { ...reviewAt(5), composeMs: 1_000 })
    expect(review.status).toBe('PENDING')
    expect(review.integritySignals).toContain('RUSHED')
  })
})

describe('what auto-approval must carry with it', () => {
  it('recalculates the trust score and pays the reviewer', async () => {
    await submitReview('user-9', 'prop-1', reviewAt(4))
    await new Promise((r) => setImmediate(r))

    expect(recalculateTrustScore).toHaveBeenCalledWith('prop-1')
    expect(prismaMock.pointsLedger.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ userId: 'user-9', action: 'REVIEW_APPROVED', referenceId: 'rev-1' }),
      }),
    )
  })

  it('does neither while the review is still waiting for a moderator', async () => {
    await submitReview('user-9', 'prop-1', reviewAt(2))
    await new Promise((r) => setImmediate(r))

    expect(recalculateTrustScore).not.toHaveBeenCalled()
    expect(prismaMock.pointsLedger.create).not.toHaveBeenCalled()
  })
})
