import { prisma } from '../../lib/prisma.js'

export async function getSavedByUser(userId) {
  return prisma.savedListing.findMany({
    where: { userId },
    include: {
      property: {
        include: {
          amenities: { include: { amenity: true } },
          trustScore: true,
          images: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  })
}

export async function saveProperty(userId, propertyId) {
  return prisma.savedListing.upsert({
    where: { userId_propertyId: { userId, propertyId } },
    create: { userId, propertyId },
    update: {},
  })
}

export async function unsaveProperty(userId, propertyId) {
  return prisma.savedListing.delete({
    where: { userId_propertyId: { userId, propertyId } },
  })
}
