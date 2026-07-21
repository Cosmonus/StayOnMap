/**
 * Tenant points & levels — 2026-07-17
 *
 * The load-bearing property: points must be UNFARMABLE. Every award is
 * idempotent via PointsLedger's unique (userId, action, referenceId), and the
 * two awards worth the most (REVIEW_APPROVED, REPORT_UPHELD) fire only on a
 * moderator's decision, never on submit. Get that wrong and the feature funds
 * exactly the review spam and false reporting the trust scores are vulnerable
 * to — `severity` on a report is client-supplied.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { prismaMock } from './mocks/prisma.js'
import { awardPoints, getPointsSummary, levelFor, POINTS, LEVELS } from '../src/features/points/points.service.js'

vi.mock('../src/features/notifications/notifications.service.js', () => ({
  notifyUser: vi.fn().mockResolvedValue(null),
}))

beforeEach(() => {
  vi.clearAllMocks()
  prismaMock.pointsLedger = {
    create: vi.fn(),
    aggregate: vi.fn().mockResolvedValue({ _sum: { points: 0 } }),
    findMany: vi.fn().mockResolvedValue([]),
  }
})

describe('levelFor', () => {
  it('starts everyone at level 1, not level 0', () => {
    expect(levelFor(0).level).toBe(1)
    expect(levelFor(0).name).toBe('New here')
  })

  it('picks the highest band the score clears', () => {
    expect(levelFor(99).level).toBe(1)
    expect(levelFor(100).level).toBe(2)
    expect(levelFor(300).level).toBe(3)
    expect(levelFor(5000).level).toBe(LEVELS.at(-1).level)
  })

  it('reports progress within the current band, so a full bar means level-up', () => {
    expect(levelFor(100).progress).toBe(0)    // just entered Neighbour
    expect(levelFor(200).progress).toBe(50)   // halfway to Local Guide
    expect(levelFor(300).progress).toBe(0)    // just entered Local Guide
  })

  it('has no next level at the top', () => {
    const top = levelFor(99999)
    expect(top.nextLevel).toBeNull()
    expect(top.pointsToNext).toBeNull()
    expect(top.progress).toBe(100)
  })
})

describe('awardPoints', () => {
  it('writes a ledger row with the configured value', async () => {
    prismaMock.pointsLedger.create.mockResolvedValue({ id: 'p1' })
    prismaMock.pointsLedger.aggregate.mockResolvedValue({ _sum: { points: 80 } })

    await awardPoints('u1', 'REVIEW_APPROVED', 'rev1')

    expect(prismaMock.pointsLedger.create).toHaveBeenCalledWith({
      data: { userId: 'u1', action: 'REVIEW_APPROVED', points: POINTS.REVIEW_APPROVED, referenceId: 'rev1' },
    })
  })

  // This is the anti-farming guarantee. A re-approved review, a re-resolved
  // report, a retried request — all must be no-ops, not second payouts.
  it('is a silent no-op when already awarded (unique violation)', async () => {
    prismaMock.pointsLedger.create.mockRejectedValue({ code: 'P2002' })
    await expect(awardPoints('u1', 'REVIEW_APPROVED', 'rev1')).resolves.toBeNull()
  })

  it('rethrows real database errors instead of swallowing them', async () => {
    prismaMock.pointsLedger.create.mockRejectedValue({ code: 'P1001', message: 'db down' })
    await expect(awardPoints('u1', 'REVIEW_APPROVED', 'rev1')).rejects.toBeTruthy()
  })

  it('refuses unknown actions and missing users', async () => {
    await expect(awardPoints('u1', 'NOT_A_REAL_ACTION')).resolves.toBeNull()
    await expect(awardPoints(null, 'REVIEW_APPROVED')).resolves.toBeNull()
    expect(prismaMock.pointsLedger.create).not.toHaveBeenCalled()
  })

  it('defaults referenceId to "" so one-time actions can only ever pay once', async () => {
    prismaMock.pointsLedger.create.mockResolvedValue({ id: 'p1' })
    prismaMock.pointsLedger.aggregate.mockResolvedValue({ _sum: { points: 50 } })

    await awardPoints('u1', 'EMAIL_VERIFIED')

    expect(prismaMock.pointsLedger.create).toHaveBeenCalledWith({
      data: { userId: 'u1', action: 'EMAIL_VERIFIED', points: 50, referenceId: '' },
    })
  })

  it('notifies only when the award crosses a level boundary', async () => {
    const { notifyUser } = await import('../src/features/notifications/notifications.service.js')
    prismaMock.pointsLedger.create.mockResolvedValue({ id: 'p1' })

    // 50 → 100 crosses into Neighbour
    prismaMock.pointsLedger.aggregate.mockResolvedValue({ _sum: { points: 100 } })
    await awardPoints('u1', 'EMAIL_VERIFIED')
    expect(notifyUser).toHaveBeenCalledTimes(1)

    vi.clearAllMocks()
    // 100 → 150 stays in Neighbour: no interruption for a mid-band award
    prismaMock.pointsLedger.aggregate.mockResolvedValue({ _sum: { points: 150 } })
    await awardPoints('u1', 'PHONE_VERIFIED')
    expect(notifyUser).not.toHaveBeenCalled()
  })
})

describe('rewards help others more than they help you', () => {
  it('pays more for an approved review than for verifying your own phone', () => {
    expect(POINTS.REVIEW_APPROVED).toBeGreaterThan(POINTS.PHONE_VERIFIED)
  })

  it('pays the most for an upheld report — it protects people from fraud', () => {
    const oneOff = [POINTS.EMAIL_VERIFIED, POINTS.PHONE_VERIFIED, POINTS.PROFILE_COMPLETED]
    expect(POINTS.REPORT_UPHELD).toBeGreaterThan(Math.max(...oneOff))
  })

  it('has no action that rewards mere activity', () => {
    const names = Object.keys(POINTS).join(' ')
    expect(names).not.toMatch(/LOGIN|STREAK|VISIT|BROWSE|SEARCH/i)
  })
})

describe('getPointsSummary', () => {
  it('lists the one-time actions still available as a to-do', async () => {
    prismaMock.pointsLedger.aggregate.mockResolvedValue({ _sum: { points: 50 } })
    prismaMock.pointsLedger.findMany.mockResolvedValue([
      { id: 'p1', action: 'EMAIL_VERIFIED', points: 50, createdAt: new Date(0) },
    ])

    const s = await getPointsSummary('u1')

    expect(s.points).toBe(50)
    expect(s.level).toBe(1)
    // PHONE_VERIFIED is deliberately absent — no verification flow exists, so
    // advertising it would be a to-do nobody can complete (2026-07-21).
    expect(s.available.map((a) => a.action)).toEqual(['PROFILE_COMPLETED'])
    expect(s.available[0].points).toBe(POINTS.PROFILE_COMPLETED)
  })

  it('reports zero cleanly for a brand-new user', async () => {
    prismaMock.pointsLedger.aggregate.mockResolvedValue({ _sum: { points: null } })
    const s = await getPointsSummary('u1')
    expect(s.points).toBe(0)
    expect(s.level).toBe(1)
  })
})
