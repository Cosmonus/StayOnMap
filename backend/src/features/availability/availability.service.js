import { prisma } from '../../lib/prisma.js'

export async function getAvailability(ownerId, propertyId) {
  const property = await prisma.property.findUnique({ where: { id: propertyId, ownerId } })
  if (!property) throw Object.assign(new Error('Property not found or access denied'), { statusCode: 404 })
  return prisma.availabilityBlock.findMany({ where: { propertyId }, orderBy: { date: 'asc' } })
}

// Bulk-replace: clears every existing block for this property and recreates
// from the submitted array — simpler and safer than granular per-date
// upsert/delete for a first pass.
export async function setAvailability(ownerId, propertyId, dates) {
  const property = await prisma.property.findUnique({ where: { id: propertyId, ownerId } })
  if (!property) throw Object.assign(new Error('Property not found or access denied'), { statusCode: 404 })

  return prisma.$transaction(async (tx) => {
    await tx.availabilityBlock.deleteMany({ where: { propertyId } })
    if (dates.length > 0) {
      await tx.availabilityBlock.createMany({
        data: dates.map((d) => ({ propertyId, date: new Date(d.date), isBlocked: d.isBlocked })),
      })
    }
    return tx.availabilityBlock.findMany({ where: { propertyId }, orderBy: { date: 'asc' } })
  })
}
