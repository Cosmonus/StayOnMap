import { prisma } from '../../lib/prisma.js'
import { recalculateRiskScore } from '../trust/trust.service.js'
import { notifyUser } from '../notifications/notifications.service.js'

export async function submitVerification(ownerId, propertyId) {
  const property = await prisma.property.findUnique({ where: { id: propertyId, ownerId } })
  if (!property) throw Object.assign(new Error('Property not found or access denied'), { statusCode: 404 })
  return prisma.ownershipVerification.upsert({
    where: { propertyId },
    create: { propertyId, ownerId, status: 'PENDING' },
    update: { status: 'PENDING', adminNote: null },
  })
}

export async function addDocument(ownerId, propertyId, data) {
  const verification = await prisma.ownershipVerification.findUnique({ where: { propertyId } })
  if (!verification || verification.ownerId !== ownerId) throw Object.assign(new Error('No verification request found'), { statusCode: 404 })
  return prisma.verificationDocument.create({ data: { ...data, verificationId: verification.id } })
}

export async function getVerificationStatus(ownerId, propertyId) {
  const v = await prisma.ownershipVerification.findUnique({ where: { propertyId }, include: { documents: true } })
  if (!v || v.ownerId !== ownerId) throw Object.assign(new Error('Not found'), { statusCode: 404 })
  return v
}

export async function adminListVerifications({ status, page = 1, limit = 20 }) {
  const where = status ? { status } : {}
  const skip = (page - 1) * limit
  const [verifications, total] = await Promise.all([
    prisma.ownershipVerification.findMany({ where, skip, take: limit, orderBy: { createdAt: 'desc' }, include: { property: { select: { id: true, title: true, city: true } }, documents: true } }),
    prisma.ownershipVerification.count({ where }),
  ])
  return { verifications, total, page, limit }
}

export async function adminReviewVerification(verificationId, adminId, { status, adminNote }) {
  const verification = await prisma.ownershipVerification.update({ where: { id: verificationId }, data: { status, adminNote, reviewedAt: new Date(), reviewedBy: adminId } })
  await recalculateRiskScore(verification.propertyId)
  if (status === 'VERIFIED') {
    const property = await prisma.property.findUnique({ where: { id: verification.propertyId } })
    if (property && property.status === 'PENDING') {
      await prisma.property.update({ where: { id: verification.propertyId }, data: { status: 'ACTIVE' } })
    }
  }
  const property = await prisma.property.findUnique({ where: { id: verification.propertyId }, select: { title: true } })
  await notifyUser(verification.ownerId, { type: 'VERIFICATION_UPDATE', title: `Verification ${status.toLowerCase()}`, body: adminNote ?? `Your ownership verification has been ${status.toLowerCase()}.`, referenceId: verification.id, referenceType: 'OwnershipVerification', emailMeta: { propertyTitle: property?.title ?? 'your property', status, adminNote } })
  return verification
}
