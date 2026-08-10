import { prisma } from '../../lib/prisma.js'
import { recordStatusChange } from '../properties/statusEvents.js'
import { notifyUser } from '../notifications/notifications.service.js'
import { awardPoints } from '../points/points.service.js'

const LEASE_INCLUDE = {
  // landmark feeds the "I'm home" share card's area line — area + city is all
  // the card may carry (docs/points-and-sharing.md §4)
  property: { select: { id: true, title: true, city: true, landmark: true, rent: true, images: { where: { isPrimary: true }, take: 1 } } },
  tenant:   { select: { id: true, name: true, email: true, avatarUrl: true } },
  owner:    { select: { id: true, name: true, email: true, avatarUrl: true } },
}

export async function createLease(ownerId, propertyId, data) {
  const property = await prisma.property.findUnique({ where: { id: propertyId, ownerId }, select: { id: true, title: true } })
  if (!property) throw Object.assign(new Error('Property not found or access denied'), { statusCode: 404 })

  const tenant = await prisma.user.findUnique({ where: { id: data.tenantId }, select: { id: true } })
  if (!tenant) throw Object.assign(new Error('Tenant not found'), { statusCode: 404 })

  if (data.tenantId === ownerId) throw Object.assign(new Error('Cannot create lease for yourself'), { statusCode: 400 })

  const start = new Date(data.startDate)
  const end   = new Date(data.endDate)
  const today = new Date(); today.setHours(0, 0, 0, 0)
  if (start < today) throw Object.assign(new Error('Start date cannot be in the past'), { statusCode: 400 })
  if (end <= start)  throw Object.assign(new Error('End date must be after start date'), { statusCode: 400 })

  const lease = await prisma.lease.create({
    data: {
      propertyId,
      tenantId:      data.tenantId,
      ownerId,
      startDate:     start,
      endDate:       end,
      rentAmount:    data.rentAmount,
      depositAmount: data.depositAmount,
      ownerNote:     data.ownerNote,
      status:        'OFFERED',
    },
    include: LEASE_INCLUDE,
  })

  await notifyUser(data.tenantId, {
    type:          'LEASE_OFFERED',
    title:         'New lease offer',
    body:          `${property.title} — review and sign your lease`,
    referenceId:   lease.id,
    referenceType: 'Lease',
    audience:      'TENANT',
  })

  return lease
}

export async function getMyLeases(userId) {
  const [asOwner, asTenant] = await Promise.all([
    prisma.lease.findMany({ where: { ownerId: userId }, include: LEASE_INCLUDE, orderBy: { createdAt: 'desc' } }),
    prisma.lease.findMany({ where: { tenantId: userId }, include: LEASE_INCLUDE, orderBy: { createdAt: 'desc' } }),
  ])
  return { asOwner, asTenant }
}

export async function getLeaseById(leaseId, userId) {
  const lease = await prisma.lease.findUnique({ where: { id: leaseId }, include: LEASE_INCLUDE })
  if (!lease) throw Object.assign(new Error('Lease not found'), { statusCode: 404 })
  if (lease.tenantId !== userId && lease.ownerId !== userId) throw Object.assign(new Error('Access denied'), { statusCode: 403 })
  return lease
}

export async function signLease(leaseId, tenantId, { tenantNote }) {
  const lease = await prisma.lease.findUnique({ where: { id: leaseId } })
  if (!lease) throw Object.assign(new Error('Lease not found'), { statusCode: 404 })
  if (lease.tenantId !== tenantId) throw Object.assign(new Error('Access denied'), { statusCode: 403 })
  if (lease.status !== 'OFFERED') throw Object.assign(new Error('Lease is no longer pending'), { statusCode: 400 })

  const [updated] = await prisma.$transaction([
    prisma.lease.update({
      where: { id: leaseId },
      data: { status: 'ACTIVE', signedAt: new Date(), tenantNote },
      include: LEASE_INCLUDE,
    }),
    prisma.property.update({
      where: { id: lease.propertyId },
      data: { status: 'OCCUPIED', currentTenantId: tenantId, occupiedSince: new Date() },
    }),
  ])

  // The most important churn event in the product: a signed lease is how a
  // listing actually leaves the market. Logged AFTER the transaction commits —
  // inside it, a metrics row that failed would roll back the tenancy.
  recordStatusChange({ propertyId: lease.propertyId, from: 'ACTIVE', to: 'OCCUPIED', actor: 'owner' })

  await notifyUser(lease.ownerId, {
    type:          'LEASE_SIGNED',
    title:         'Lease signed',
    body:          `Tenant has signed the lease for ${updated.property?.title ?? 'your property'}`,
    referenceId:   lease.id,
    referenceType: 'Lease',
    audience:      'OWNER',
  })

  // The tenant completed a tenancy through the platform — the moment the whole
  // product exists for, and what unlocks their "I'm home" share card.
  awardPoints(tenantId, 'LEASE_SIGNED', lease.id).catch(() => {})

  return updated
}

export async function rejectLease(leaseId, tenantId, { tenantNote }) {
  const lease = await prisma.lease.findUnique({ where: { id: leaseId } })
  if (!lease) throw Object.assign(new Error('Lease not found'), { statusCode: 404 })
  if (lease.tenantId !== tenantId) throw Object.assign(new Error('Access denied'), { statusCode: 403 })
  if (lease.status !== 'OFFERED') throw Object.assign(new Error('Lease is no longer pending'), { statusCode: 400 })

  const updated = await prisma.lease.update({
    where: { id: leaseId },
    data: { status: 'REJECTED', rejectedAt: new Date(), tenantNote },
    include: LEASE_INCLUDE,
  })

  await notifyUser(lease.ownerId, {
    type:          'LEASE_REJECTED',
    title:         'Lease rejected',
    body:          `Tenant declined the lease for ${updated.property?.title ?? 'your property'}`,
    referenceId:   lease.id,
    referenceType: 'Lease',
    audience:      'OWNER',
  })

  return updated
}

export async function terminateLease(leaseId, ownerId, { ownerNote }) {
  const lease = await prisma.lease.findUnique({ where: { id: leaseId } })
  if (!lease) throw Object.assign(new Error('Lease not found'), { statusCode: 404 })
  if (lease.ownerId !== ownerId) throw Object.assign(new Error('Access denied'), { statusCode: 403 })
  if (lease.status !== 'ACTIVE') throw Object.assign(new Error('Only active leases can be terminated'), { statusCode: 400 })

  const [updated] = await prisma.$transaction([
    prisma.lease.update({
      where: { id: leaseId },
      data: { status: 'TERMINATED', terminatedAt: new Date(), ownerNote },
      include: LEASE_INCLUDE,
    }),
    prisma.property.update({
      where: { id: lease.propertyId },
      data: { status: 'ACTIVE', currentTenantId: null, occupiedSince: null },
    }),
  ])

  // Back on the market. Not new supply — publishedAt.js refuses an OCCUPIED
  // origin for the same reason — but it IS a listing becoming available, which
  // is what the net line has to show.
  recordStatusChange({ propertyId: lease.propertyId, from: 'OCCUPIED', to: 'ACTIVE', actor: 'owner' })

  await notifyUser(lease.tenantId, {
    type:          'SYSTEM',
    title:         'Lease terminated',
    body:          `Your lease for ${updated.property?.title ?? 'the property'} has been terminated`,
    referenceId:   lease.id,
    referenceType: 'Lease',
    audience:      'TENANT',
  })

  return updated
}
