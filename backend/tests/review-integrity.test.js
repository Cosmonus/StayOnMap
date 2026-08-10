/**
 * Review integrity — the four deterministic checks that decide whether a review
 * a human should read gets published without one.
 *
 * The threshold in reviews.service.js publishes anything averaging above 2.5.
 * That is right for the honest majority and exactly wrong for the fake that
 * matters: a planted or paid review is uniformly glowing, so it clears the
 * rating gate on its way in. These checks are the other half of that decision,
 * and every one of them fails silently if it breaks — a signal that stops
 * firing just means more fakes go live, with nothing anywhere saying so.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { prismaMock } from './mocks/prisma.js'

const {
  checkReviewIntegrity, hasUniformRatings, REVIEW_SIGNALS,
  MIN_COMPOSE_MS, NEW_ACCOUNT_MS, OWNER_CLUSTER_MIN,
} = await import('../src/features/reviews/integrity.js')
const { RATING_FIELDS } = await import('../src/features/reviews/rating.js')

const VARIED = Object.fromEntries(RATING_FIELDS.map((f, i) => [f, (i % 3) + 2]))
const uniform = (v) => Object.fromEntries(RATING_FIELDS.map((f) => [f, v]))

const check = (over = {}) =>
  checkReviewIntegrity({ reviewerId: 'user-9', propertyId: 'prop-1', data: VARIED, ...over })

beforeEach(() => {
  vi.clearAllMocks()
  // The clean baseline: settled account, no other reviews of this owner.
  prismaMock.user.findUnique.mockResolvedValue({ createdAt: new Date('2020-01-01') })
  prismaMock.property.findUnique.mockResolvedValue({ ownerId: 'owner-1' })
  prismaMock.communityReview.count.mockResolvedValue(0)
})

describe('a clean review', () => {
  it('raises nothing', async () => {
    expect(await check()).toEqual([])
  })

  it('and an empty array is a real result, not a missing one', async () => {
    // The admin panel renders [] and null differently on purpose: a review that
    // was never examined is not a review that passed.
    expect(Array.isArray(await check())).toBe(true)
  })
})

describe('uniform ratings', () => {
  it('flags twelve identical scores', async () => {
    expect(hasUniformRatings(uniform(5))).toBe(true)
    expect(await check({ data: uniform(5) })).toContain('UNIFORM_RATINGS')
  })

  it('flags the untouched form, which both clients default to a flat 3', async () => {
    // 3.0 averages ABOVE the auto-approval threshold, so without this check
    // "didn't rate anything" publishes itself.
    expect(await check({ data: uniform(3) })).toContain('UNIFORM_RATINGS')
  })

  it('does not flag a review that actually varies', () => {
    expect(hasUniformRatings(VARIED)).toBe(false)
  })

  it('does not flag a partial rating set as uniform', () => {
    // Fewer than 12 present is a malformed payload, not agreement across 12.
    expect(hasUniformRatings({ ratingsSafety: 4, ratingsClean: 4 })).toBe(false)
  })
})

describe('time to write', () => {
  it('flags a submission faster than the form can be read', async () => {
    expect(await check({ composeMs: 3_000 })).toContain('RUSHED')
  })

  it('accepts a considered one', async () => {
    expect(await check({ composeMs: MIN_COMPOSE_MS + 1 })).not.toContain('RUSHED')
  })

  // The safety property of the one client-supplied input on the platform's
  // integrity path: it can only ever ADD suspicion. A bot omitting it costs us
  // a signal; a bot able to claim "I took five minutes" and skip moderation
  // would be a hole, so absent and absurd values must both be no evidence —
  // never a pass.
  for (const [name, value] of [
    ['absent', undefined], ['null', null], ['a string', '999999'],
    ['negative', -1], ['NaN', Number.NaN],
  ]) {
    it(`treats ${name} as no evidence rather than as a pass`, async () => {
      expect(await check({ composeMs: value })).not.toContain('RUSHED')
    })
  }
})

describe('account age', () => {
  it('flags an account created hours before the review', async () => {
    prismaMock.user.findUnique.mockResolvedValue({ createdAt: new Date(Date.now() - 60_000) })
    expect(await check()).toContain('NEW_ACCOUNT')
  })

  it('does not flag one created before the window', async () => {
    prismaMock.user.findUnique.mockResolvedValue({ createdAt: new Date(Date.now() - NEW_ACCOUNT_MS - 60_000) })
    expect(await check()).not.toContain('NEW_ACCOUNT')
  })
})

describe('reviewer → owner clustering', () => {
  it('flags the third review of one owner', async () => {
    // The count excludes this review, so the threshold is reached at N-1 prior.
    prismaMock.communityReview.count.mockResolvedValue(OWNER_CLUSTER_MIN - 1)
    expect(await check()).toContain('OWNER_CLUSTER')
  })

  it('leaves the second alone — one landlord, two homes is a real tenant', async () => {
    prismaMock.communityReview.count.mockResolvedValue(OWNER_CLUSTER_MIN - 2)
    expect(await check()).not.toContain('OWNER_CLUSTER')
  })

  it('counts across the owner, not the listing', async () => {
    await check()
    expect(prismaMock.communityReview.count).toHaveBeenCalledWith({
      where: {
        reviewerId: 'user-9',
        propertyId: { not: 'prop-1' },
        property: { ownerId: 'owner-1' },
      },
    })
  })
})

describe('when the checks cannot run', () => {
  it('holds the review and says so, rather than losing it or publishing it', async () => {
    prismaMock.user.findUnique.mockRejectedValue(new Error('db down'))
    const signals = await check()
    expect(signals).toContain('CHECK_FAILED')
  })

  it('keeps the pure checks that do not need the database', async () => {
    prismaMock.property.findUnique.mockRejectedValue(new Error('db down'))
    const signals = await check({ data: uniform(5), composeMs: 1_000 })
    expect(signals).toEqual(expect.arrayContaining(['UNIFORM_RATINGS', 'RUSHED', 'CHECK_FAILED']))
  })
})

describe('every signal has a label', () => {
  // The admin panel resolves labels server-side from this table. A key with no
  // entry there renders as the raw key — our internal vocabulary shown to
  // whoever is moderating.
  it('covers every key the checker can emit', () => {
    const emitted = ['UNIFORM_RATINGS', 'RUSHED', 'NEW_ACCOUNT', 'OWNER_CLUSTER', 'CHECK_FAILED']
    for (const key of emitted) expect(REVIEW_SIGNALS[key]).toBeTruthy()
    expect(Object.keys(REVIEW_SIGNALS).sort()).toEqual(emitted.sort())
  })
})
