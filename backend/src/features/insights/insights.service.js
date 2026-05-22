import { prisma } from '../../lib/prisma.js'

export async function addInsight(userId, propertyId, data) {
  return prisma.neighborhoodInsight.create({ data: { ...data, userId, propertyId } })
}

export async function getInsights(propertyId) {
  return prisma.neighborhoodInsight.findMany({
    where: { propertyId },
    include: { user: { select: { id: true, name: true } } },
    orderBy: { createdAt: 'desc' },
  })
}
