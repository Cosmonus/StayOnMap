import { prisma } from '../../lib/prisma.js'
import { recalculateTrustScore } from '../trust/trust.service.js'

export async function submitReview(reviewerId, propertyId, data) {
  const review = await prisma.communityReview.upsert({
    where: { reviewerId_propertyId: { reviewerId, propertyId } },
    create: { ...data, reviewerId, propertyId, status: 'PENDING' },
    update: { ...data, status: 'PENDING' },
  })
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
