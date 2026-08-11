// The double-blind rules, PURE — no Prisma, no req. Same reasoning as
// support/visibility.js: every mistake in this file is a fairness or privacy
// failure rather than an error (a review shown early converts the second
// review into a negotiation; an unconfirmed tenancy counted converts an
// owner's assertion into a stranger's history), so the whole decision lives
// where a test can walk every case.

/** Days after WRITING that a lone review becomes visible anyway. */
export const REVEAL_WINDOW_DAYS = 14

/** How old a tenancy must be before either side may review the other. */
export const MIN_TENANCY_DAYS = 60

const DAY_MS = 24 * 60 * 60 * 1000

/**
 * May the OTHER party (and the public résumé) see this review?
 *
 * Visible when the counterpart review exists — both are in, nothing left to
 * negotiate — or when this review has waited out the window alone: the
 * counterpart forfeited their say, and holding an honest review hostage to a
 * party who never writes would let silence suppress criticism forever.
 *
 * The AUTHOR always sees their own review; this function answers for everyone
 * else.
 */
export function isRevealed(review, counterpart, now = new Date()) {
  if (counterpart) return true
  return now.getTime() - new Date(review.createdAt).getTime() >= REVEAL_WINDOW_DAYS * DAY_MS
}

/**
 * May `authorId` review this tenancy? Returns { ok } or { ok: false, reason }
 * with a sentence a client can show verbatim.
 *
 * The gates, each one an abuse it closes:
 *  - party-only: a review right must come from having lived the tenancy
 *  - confirmed-only: an owner's unconfirmed assertion buys no review of the
 *    person it names
 *  - 60 days or ended: a review written in week one is first impressions
 *    wearing a tenancy's authority — and drive-by "tenancies" would be free
 *    credibility farming
 */
export function canReview(tenancy, authorId, now = new Date()) {
  if (authorId !== tenancy.ownerId && authorId !== tenancy.tenantId) {
    return { ok: false, reason: 'Only the owner and the tenant of this tenancy can review it' }
  }
  if (!tenancy.confirmedAt) {
    return { ok: false, reason: 'This tenancy has not been confirmed by the tenant yet' }
  }
  const oldEnough = now.getTime() - new Date(tenancy.startedAt).getTime() >= MIN_TENANCY_DAYS * DAY_MS
  if (!tenancy.endedAt && !oldEnough) {
    return { ok: false, reason: `Reviews open ${MIN_TENANCY_DAYS} days into a tenancy, or when it ends` }
  }
  return { ok: true }
}

/** Whole months a tenancy has run — floor, never rounded up: a résumé must not inflate. */
export function tenancyMonths(tenancy, now = new Date()) {
  const end = tenancy.endedAt ? new Date(tenancy.endedAt) : now
  const ms = end.getTime() - new Date(tenancy.startedAt).getTime()
  return Math.max(0, Math.floor(ms / (30 * DAY_MS)))
}
