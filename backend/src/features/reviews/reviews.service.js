import { prisma } from '../../lib/prisma.js'
import { recalculateTrustScore } from '../trust/trust.service.js'
import { awardPoints } from '../points/points.service.js'
import { averageRating } from './rating.js'
import { checkReviewIntegrity } from './integrity.js'

// Every review used to queue for a moderator, which made moderation a tax on
// the good ones — the overwhelming majority — and buried the few worth reading.
// A review averaging ABOVE this publishes itself; at or below it, a human looks
// first. The line sits on the negative side on purpose: a complaint is what
// carries a defamation, a rival's smear or a grudge, and it is also the review
// whose accuracy matters most to the person about to sign a lease.
export const AUTO_APPROVE_ABOVE = 2.5

// A moderator's REJECTED/FLAGGED verdict is not undone by an edit. Without
// this, changing one word on a rejected 5-star review would auto-publish it
// straight back onto the listing.
const MODERATED_OUT = ['REJECTED', 'FLAGGED']

function nextStatus(data, previousStatus, signals) {
  if (MODERATED_OUT.includes(previousStatus)) return 'PENDING'
  // A signal outranks the rating, and that ordering is the point: the fake
  // worth catching is a glowing one, so it passes the threshold on its way in.
  if (signals.length > 0) return 'PENDING'
  const avg = averageRating(data)
  // No ratings at all is not a good review — it is an unrated one.
  return avg !== null && avg > AUTO_APPROVE_ABOVE ? 'APPROVED' : 'PENDING'
}

export async function submitReview(reviewerId, propertyId, payload) {
  // `composeMs` is measurement, not review content — it must never reach the
  // model. Splitting it off here is what keeps `...data` safe to spread into
  // Prisma, which is how the whole write has always been shaped.
  const { composeMs, ...data } = payload

  const [existing, signals] = await Promise.all([
    prisma.communityReview.findUnique({
      where: { reviewerId_propertyId: { reviewerId, propertyId } },
      select: { status: true },
    }),
    checkReviewIntegrity({ reviewerId, propertyId, data, composeMs }),
  ])
  const status = nextStatus(data, existing?.status, signals)

  const review = await prisma.communityReview.upsert({
    where: { reviewerId_propertyId: { reviewerId, propertyId } },
    create: { ...data, reviewerId, propertyId, status, integritySignals: signals },
    update: { ...data, status, integritySignals: signals },
  })

  // What admin.service.js's moderateReview already does on APPROVED. Skipping
  // it here would leave an auto-published review invisible to the trust score,
  // and would pay points only for reviews bad enough to reach a moderator.
  if (review.status === 'APPROVED') {
    await recalculateTrustScore(propertyId).catch(() => {})
    awardPoints(reviewerId, 'REVIEW_APPROVED', review.id).catch(() => {})
  }
  return review
}

export async function getPropertyReviews(propertyId) {
  return prisma.communityReview.findMany({ where: { propertyId, status: 'APPROVED' }, include: { reviewer: { select: { id: true, name: true, avatarUrl: true } } }, orderBy: { createdAt: 'desc' } })
}

export async function respondToReview(ownerId, propertyId, reviewId, response) {
  const property = await prisma.property.findUnique({ where: { id: propertyId }, select: { ownerId: true } })
  if (!property) throw Object.assign(new Error('Property not found'), { statusCode: 404 })
  if (property.ownerId !== ownerId) throw Object.assign(new Error('Only the property owner can respond'), { statusCode: 403 })
  const review = await prisma.communityReview.findFirst({ where: { id: reviewId, propertyId } })
  if (!review) throw Object.assign(new Error('Review not found'), { statusCode: 404 })
  return prisma.communityReview.update({ where: { id: reviewId }, data: { ownerResponse: response || null } })
}

export async function voteRecommendation(userId, propertyId, recommend) {
  const vote = await prisma.recommendationVote.upsert({
    where: { propertyId_userId: { propertyId, userId } },
    create: { propertyId, userId, recommend },
    update: { recommend },
  })
  await recalculateTrustScore(propertyId)
  return vote
}
