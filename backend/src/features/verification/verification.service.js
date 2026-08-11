import { prisma } from '../../lib/prisma.js'
import { recalculateRiskScore } from '../trust/trust.service.js'
import { notifyUser } from '../notifications/notifications.service.js'
import { compareAddresses } from './addressMatch.js'
import { firstPublishStamp } from '../properties/publishedAt.js'
import { matchNewSupply } from '../savedSearches/savedSearch.service.js'
import { recordStatusChange } from '../properties/statusEvents.js'

export async function submitVerification(ownerId, propertyId, { documentAddress } = {}) {
  const property = await prisma.property.findUnique({ where: { id: propertyId, ownerId } })
  if (!property) throw Object.assign(new Error('Property not found or access denied'), { statusCode: 404 })

  const verification = await prisma.ownershipVerification.upsert({
    where: { propertyId },
    create: { propertyId, ownerId, status: 'PENDING', documentAddress: documentAddress ?? null },
    update: { status: 'PENDING', adminNote: null, ...(documentAddress !== undefined && { documentAddress }) },
  })

  // Computed and RETURNED, not stored: the owner sees a pincode contradiction
  // in the submit response — while they can still fix the listing or pick the
  // right document — instead of discovering it as a rejection days later. Not
  // persisted because the listing address can change after submission, and a
  // stored verdict would then describe an address that no longer exists.
  const addressMatch = await compareAddresses(property, documentAddress).catch(() => null)
  return { ...verification, addressMatch }
}

export async function addDocument(ownerId, propertyId, data) {
  const verification = await prisma.ownershipVerification.findUnique({ where: { propertyId } })
  if (!verification || verification.ownerId !== ownerId) throw Object.assign(new Error('No verification request found'), { statusCode: 404 })
  return prisma.verificationDocument.create({ data: { ...data, verificationId: verification.id } })
}

export async function getVerificationStatus(ownerId, propertyId) {
  const v = await prisma.ownershipVerification.findUnique({ where: { propertyId }, include: { documents: true, property: { select: { address: true, pincode: true, city: true } } } })
  if (!v || v.ownerId !== ownerId) throw Object.assign(new Error('Not found'), { statusCode: 404 })
  const { property, ...rest } = v
  // Fresh against the CURRENT listing address — see submitVerification.
  const addressMatch = await compareAddresses(property, v.documentAddress).catch(() => null)
  return { ...rest, addressMatch }
}

export async function adminListVerifications({ status, page = 1, limit = 20 }) {
  const where = status ? { status } : {}
  const skip = (page - 1) * limit
  const [verifications, total] = await Promise.all([
    // address + pincode included so the reviewer sees the listing's claim next
    // to the owner's declaration — the whole point of collecting it.
    prisma.ownershipVerification.findMany({ where, skip, take: limit, orderBy: { createdAt: 'desc' }, include: { property: { select: { id: true, title: true, city: true, address: true, pincode: true } }, documents: true } }),
    prisma.ownershipVerification.count({ where }),
  ])
  // Verification is admin judgement by design (docs/verification.md). The
  // comparison upgrades the evidence on the table, never the decision: the
  // reviewer gets listing address, declared document address, and a
  // deterministic verdict side by side, and still reads the document.
  // OwnershipVerification carries a raw ownerId (no relation) — one batched
  // lookup names the owners for the admin list instead of showing cuids.
  const owners = await prisma.user.findMany({
    where: { id: { in: [...new Set(verifications.map((v) => v.ownerId))] } },
    select: { id: true, name: true, email: true },
  })
  const ownerById = new Map(owners.map((o) => [o.id, o]))

  const withMatch = await Promise.all(verifications.map(async (v) => ({
    ...v,
    owner: ownerById.get(v.ownerId) ?? null,
    addressMatch: await compareAddresses(v.property, v.documentAddress).catch(() => null),
  })))
  return { verifications: withMatch, total, page, limit }
}

export async function adminReviewVerification(verificationId, adminId, { status, adminNote }) {
  const verification = await prisma.ownershipVerification.update({ where: { id: verificationId }, data: { status, adminNote, reviewedAt: new Date(), reviewedBy: adminId } })
  await recalculateRiskScore(verification.propertyId)
  if (status === 'VERIFIED') {
    const property = await prisma.property.findUnique({ where: { id: verification.propertyId } })
    if (property && property.status === 'PENDING') {
      // The second door into ACTIVE, and it must stamp the same way the admin
      // one does — see features/properties/publishedAt.js.
      const stamp = firstPublishStamp(property, 'ACTIVE')
      await prisma.property.update({
        where: { id: verification.propertyId },
        data: { status: 'ACTIVE', ...stamp },
      })
      recordStatusChange({ propertyId: verification.propertyId, from: property.status, to: 'ACTIVE', actor: 'admin' })
      // New supply only, same test as admin.service.js — the stamp decides.
      if (stamp.publishedAt) matchNewSupply(verification.propertyId).catch(() => {})
    }
  }
  const property = await prisma.property.findUnique({ where: { id: verification.propertyId }, select: { title: true } })
  await notifyUser(verification.ownerId, { type: 'VERIFICATION_UPDATE', title: `Verification ${status.toLowerCase()}`, body: adminNote ?? `Your ownership verification has been ${status.toLowerCase()}.`, referenceId: verification.id, referenceType: 'OwnershipVerification', audience: 'OWNER', emailMeta: { propertyTitle: property?.title ?? 'your property', status, adminNote } })
  return verification
}
