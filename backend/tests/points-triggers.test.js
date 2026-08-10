/**
 * Points triggers — 2026-07-21. The EMAIL_VERIFIED / PROFILE_COMPLETED awards
 * were designed with the ledger (docs/points-and-sharing.md) but nothing called
 * them until now. PHONE_VERIFIED stays deliberately unwired: the platform has
 * no phone verification flow, and paying for a merely-typed number would break
 * the feature's honesty rule — so it must also not be advertised as earnable.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { prismaMock } from './mocks/prisma.js'

vi.mock('../src/features/notifications/notifications.service.js', () => ({
  notifyUser: vi.fn().mockResolvedValue(null),
}))

const { isProfileComplete, updateUser } = await import('../src/features/users/users.service.js')
const { getPointsSummary } = await import('../src/features/points/points.service.js')

const COMPLETE = { name: 'A', phone: '9876543210', city: 'Chennai', avatarUrl: 'https://x/a.png' }

beforeEach(() => {
  vi.clearAllMocks()
  prismaMock.pointsLedger = {
    create: vi.fn().mockResolvedValue({ id: 'pl-1', points: 40 }),
    aggregate: vi.fn().mockResolvedValue({ _sum: { points: 40 } }),
    findMany: vi.fn().mockResolvedValue([]),
  }
})

describe('isProfileComplete', () => {
  it('requires name + phone + city + avatar (the doc contract, not the listing gate)', () => {
    expect(isProfileComplete(COMPLETE)).toBe(true)
    for (const field of ['name', 'phone', 'city', 'avatarUrl']) {
      expect(isProfileComplete({ ...COMPLETE, [field]: null })).toBe(false)
    }
    expect(isProfileComplete(null)).toBe(false)
  })
})

describe('updateUser → PROFILE_COMPLETED', () => {
  it('awards when the update makes the profile complete', async () => {
    prismaMock.user.update.mockResolvedValue({ id: 'u1', ...COMPLETE, passwordHash: 'x' })
    await updateUser('u1', { avatarUrl: COMPLETE.avatarUrl })
    // fire-and-forget: give the microtask queue one turn
    await new Promise((r) => setImmediate(r))
    expect(prismaMock.pointsLedger.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ userId: 'u1', action: 'PROFILE_COMPLETED' }) })
    )
  })

  it('does not award while any field is still missing', async () => {
    prismaMock.user.update.mockResolvedValue({ id: 'u1', ...COMPLETE, avatarUrl: null, passwordHash: 'x' })
    await updateUser('u1', { name: 'A' })
    await new Promise((r) => setImmediate(r))
    expect(prismaMock.pointsLedger.create).not.toHaveBeenCalled()
  })
})

describe('moderateReview → REVIEW_APPROVED', () => {
  // The largest award in the ledger, and it had NEVER been paid. The call
  // passed `review.authorId`; CommunityReview's column is `reviewerId`, so the
  // id was undefined, `awardPoints` no-opped on it, and the fire-and-forget
  // `.catch()` around the call meant nothing ever surfaced. `.claude/database.md`
  // documented the wrong name too — the doc drift and the bug were one mistake.
  //
  // Asserting on the ARGUMENT rather than the ledger row, because that is where
  // it went wrong: a mocked awardPoints would have accepted undefined happily.
  it('pays the reviewer, reading the field the model actually has', async () => {
    const { moderateReview } = await import('../src/features/admin/admin.service.js')

    prismaMock.communityReview.update.mockResolvedValue({
      id: 'rev-1', propertyId: 'prop-1', reviewerId: 'user-9', status: 'APPROVED',
    })
    prismaMock.activityLog.create.mockResolvedValue({})

    await moderateReview('rev-1', 'APPROVED', 'admin-1')
    await new Promise((r) => setImmediate(r))

    expect(prismaMock.pointsLedger.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ userId: 'user-9', action: 'REVIEW_APPROVED' }),
      })
    )
  })

  it('pays nothing on a rejection', async () => {
    const { moderateReview } = await import('../src/features/admin/admin.service.js')

    prismaMock.communityReview.update.mockResolvedValue({
      id: 'rev-2', propertyId: 'prop-1', reviewerId: 'user-9', status: 'REJECTED',
    })
    prismaMock.activityLog.create.mockResolvedValue({})

    await moderateReview('rev-2', 'REJECTED', 'admin-1')
    await new Promise((r) => setImmediate(r))

    expect(prismaMock.pointsLedger.create).not.toHaveBeenCalled()
  })
})

describe('getPointsSummary available-actions checklist', () => {
  it('never advertises PHONE_VERIFIED — there is no flow that can earn it', async () => {
    const summary = await getPointsSummary('u1')
    const actions = summary.available.map((a) => a.action)
    expect(actions).toContain('EMAIL_VERIFIED')
    expect(actions).toContain('PROFILE_COMPLETED')
    expect(actions).not.toContain('PHONE_VERIFIED')
  })
})
