import { prisma } from '../../lib/prisma.js'
import { awardPoints } from '../points/points.service.js'

export async function addInsight(userId, propertyId, data) {
  const insight = await prisma.neighborhoodInsight.create({ data: { ...data, userId, propertyId } })
  // Insights aren't moderated, so this is the one award that pays on create.
  // The unique (userId, INSIGHT_ADDED, insightId) stops a replay, but nothing
  // stops someone posting ten insights on ten properties — that's why it's the
  // smallest award (30) and why insights feed AreaScore only as a ratio, never
  // a raw count. If this ever gets farmed, moderate insights; don't tune points.
  awardPoints(userId, 'INSIGHT_ADDED', insight.id).catch(() => {})
  return insight
}

export async function getInsights(propertyId) {
  return prisma.neighborhoodInsight.findMany({
    where: { propertyId },
    include: { user: { select: { id: true, name: true } } },
    orderBy: { createdAt: 'desc' },
  })
}
