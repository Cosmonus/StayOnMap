// Tenant points & levels.
//
// The rule this whole feature is built on: you earn points for making the
// platform more useful to the NEXT renter — verifying who you are, reviewing a
// place you actually lived in, flagging a listing that turns out to be fake.
// Nothing here rewards showing up. No streaks, no login bonus, no leaderboard.
// Someone looking for a home is not a daily-habit user, and nudging them to
// return for points they don't need would be a dark pattern wearing a game hat.
//
// Every award is idempotent by construction — see PointsLedger's unique
// (userId, action, referenceId) in schema.prisma. Callers are fire-and-forget:
// a points failure must never break the action that earned them.
import { prisma } from '../../lib/prisma.js'
import { notifyUser } from '../notifications/notifications.service.js'

// Points are deliberately lopsided toward things that cost the user effort and
// help strangers. Verifying your own phone helps you; reviewing a flat you left
// helps everyone who looks at it next, forever — hence 80 vs 50.
export const POINTS = {
  EMAIL_VERIFIED:    50,
  PHONE_VERIFIED:    50,
  PROFILE_COMPLETED: 40,
  REVIEW_APPROVED:   80,
  INSIGHT_ADDED:     30,
  REPORT_UPHELD:    100, // highest: an upheld report protects people from fraud
  LEASE_SIGNED:     120,
}

// Names describe contribution, not status. Nobody is a "Bronze" person.
export const LEVELS = [
  { level: 1, name: 'New here',    min: 0 },
  { level: 2, name: 'Neighbour',   min: 100 },
  { level: 3, name: 'Local Guide', min: 300 },
  { level: 4, name: 'Area Expert', min: 600 },
  { level: 5, name: 'Trusted Voice', min: 1000 },
]

export function levelFor(points) {
  const current = [...LEVELS].reverse().find((l) => points >= l.min) ?? LEVELS[0]
  const next = LEVELS.find((l) => l.min > points) ?? null
  return {
    ...current,
    nextLevel: next?.level ?? null,
    nextName: next?.name ?? null,
    pointsToNext: next ? next.min - points : null,
    // Progress within the CURRENT band, so a full bar always means "levelled up"
    progress: next ? Math.round(((points - current.min) / (next.min - current.min)) * 100) : 100,
  }
}

/**
 * Award points once. Safe to call repeatedly — the unique constraint makes a
 * repeat a no-op rather than a second payout.
 *
 * @param userId      who earned it
 * @param action      a PointsAction
 * @param referenceId the Review/Report/Lease id this is for. Omit for
 *                    once-per-user actions (verification, profile).
 * @returns the created ledger row, or null if already awarded / failed
 */
export async function awardPoints(userId, action, referenceId = '') {
  const points = POINTS[action]
  if (!userId || !points) return null

  try {
    const row = await prisma.pointsLedger.create({
      data: { userId, action, points, referenceId },
    })

    // Only tell someone when they cross a level. A toast for every +30 is
    // noise; "you're an Area Expert now" is worth interrupting for.
    const total = await getPoints(userId)
    const before = levelFor(total - points)
    const after = levelFor(total)
    if (after.level > before.level) {
      notifyUser(userId, {
        type: 'SYSTEM',
        title: `You reached ${after.name}`,
        body: `${total} points — thanks for helping other renters find a home they can trust.`,
      }).catch(() => {})
    }

    return row
  } catch (err) {
    // P2002 = already awarded for this reference. Expected, not an error.
    if (err?.code === 'P2002') return null
    throw err
  }
}

export async function getPoints(userId) {
  const agg = await prisma.pointsLedger.aggregate({
    where: { userId },
    _sum: { points: true },
  })
  return agg._sum.points ?? 0
}

/** Everything the profile/points UI needs, in one call. */
export async function getPointsSummary(userId) {
  const [rows, total] = await Promise.all([
    prisma.pointsLedger.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: { id: true, action: true, points: true, createdAt: true },
    }),
    getPoints(userId),
  ])

  // Which one-time actions are still available — this is what makes the UI a
  // checklist ("verify your email → +50") instead of an opaque number.
  // PHONE_VERIFIED is deliberately NOT listed: the platform has no phone
  // verification flow (no SMS), so advertising it would be a checklist item
  // nobody can complete. The POINTS entry stays for when such a flow exists —
  // awarding it for merely typing a number would pay for unverified data.
  const earned = new Set(rows.map((r) => r.action))
  const available = ['EMAIL_VERIFIED', 'PROFILE_COMPLETED']
    .filter((a) => !earned.has(a))
    .map((a) => ({ action: a, points: POINTS[a] }))

  return { points: total, ...levelFor(total), history: rows, available }
}
