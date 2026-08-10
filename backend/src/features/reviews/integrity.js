// Review integrity — four deterministic checks, no vendor, no model, no cost.
//
// Auto-approval (see reviews.service.js) publishes anything averaging above
// 2.5, which is correct for the honest majority and exactly wrong for the fake
// that matters: a planted or paid review is uniformly glowing, so it clears the
// rating threshold by design. These checks are the other half of that decision.
//
// A signal HOLDS a review for a moderator — it never rejects one. Every check
// here has a legitimate explanation (a delighted tenant really does give twelve
// 5s), so the output is "a human should read this", never a verdict.
import { prisma } from '../../lib/prisma.js'
import { RATING_FIELDS } from './rating.js'

export const REVIEW_SIGNALS = {
  UNIFORM_RATINGS: 'Every category rated identically',
  RUSHED:          'Submitted faster than the form can be read',
  NEW_ACCOUNT:     'Account created hours before the review',
  OWNER_CLUSTER:   'Reviewer has reviewed several listings by this owner',
  // Not a finding — the absence of one. See the fail-closed note below.
  CHECK_FAILED:    'Integrity checks could not run',
}

// Twelve categories to consider and a body to write. Under this is a paste or a
// script, not a considered opinion — and the threshold is deliberately far
// below a plausible honest time so a slow reader is never caught by it.
export const MIN_COMPOSE_MS = 25_000

// An account is "new" for its first day. Someone who signed up to say one thing
// about one listing is the shape of a planted review; someone who signed up
// last week and reviewed the flat they left is not.
export const NEW_ACCOUNT_MS = 24 * 60 * 60 * 1000

// Two is a person who rented one home from a landlord and viewed another.
// Three is a pattern, and it is the one that catches a paid review ring —
// rings are cheap to run precisely because one account serves one owner
// repeatedly.
export const OWNER_CLUSTER_MIN = 3

// Pure: every rating identical. The web and mobile forms both DEFAULT all
// twelve sliders to 3, so this also catches the review where nobody touched
// them — "didn't actually rate anything" reaching the listing as a flat 3.0,
// which clears the auto-approval threshold on its own.
export function hasUniformRatings(data) {
  const values = RATING_FIELDS.map((f) => data?.[f]).filter((v) => typeof v === 'number')
  if (values.length < RATING_FIELDS.length) return false
  return values.every((v) => v === values[0])
}

/**
 * Signals for one submission. Returns an array of REVIEW_SIGNALS keys, empty
 * when nothing looks off.
 *
 * `composeMs` is the ONE client-supplied input here, and it is treated
 * accordingly: a small value ADDS a signal, and a missing, malformed or large
 * one is simply no evidence. It can never clear a review. That asymmetry is the
 * whole safety property — a bot that omits the field loses us a signal, which
 * is a miss; a bot that could claim "I took five minutes" and thereby skip
 * moderation would be a hole. This is also why it is advisory input to a HOLD
 * and never input to a publish.
 *
 * Never throws. Three of the four checks hit the database, and a submission
 * must not be lost to a blip — but it must not be PUBLISHED by one either, so
 * the failure path returns CHECK_FAILED, which holds the review and says why.
 * An empty array has to keep meaning "checked, nothing off".
 */
export async function checkReviewIntegrity({ reviewerId, propertyId, data, composeMs }) {
  const signals = []

  // Pure, so it survives a database failure and is worth doing first.
  if (hasUniformRatings(data)) signals.push('UNIFORM_RATINGS')
  if (typeof composeMs === 'number' && composeMs >= 0 && composeMs < MIN_COMPOSE_MS) {
    signals.push('RUSHED')
  }

  try {
    const [reviewer, property] = await Promise.all([
      prisma.user.findUnique({ where: { id: reviewerId }, select: { createdAt: true } }),
      prisma.property.findUnique({ where: { id: propertyId }, select: { ownerId: true } }),
    ])

    if (reviewer?.createdAt && Date.now() - new Date(reviewer.createdAt).getTime() < NEW_ACCOUNT_MS) {
      signals.push('NEW_ACCOUNT')
    }

    if (property?.ownerId) {
      // Their OTHER reviews of this owner's listings — this one is excluded, so
      // the count answers "how many times before", and the threshold reads the
      // same whether the review is new or an edit of an existing one.
      const others = await prisma.communityReview.count({
        where: { reviewerId, propertyId: { not: propertyId }, property: { ownerId: property.ownerId } },
      })
      if (others + 1 >= OWNER_CLUSTER_MIN) signals.push('OWNER_CLUSTER')
    }
  } catch {
    signals.push('CHECK_FAILED')
  }

  return signals
}
