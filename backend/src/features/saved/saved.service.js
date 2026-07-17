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

// deleteMany, not delete: unsaving something already unsaved is a no-op, not an
// error. `delete` threw P2025 → an uncaught 500 on the second of two clicks, or
// on a retry over a flaky connection.
export async function unsaveProperty(userId, propertyId) {
  await prisma.savedListing.deleteMany({ where: { userId, propertyId } })
}
