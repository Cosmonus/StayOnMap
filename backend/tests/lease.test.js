/**
 * Lease service tests
 *
 * What each suite guards against:
 *   createLease     — 404 property not owned; 404 unknown tenant; 400 self-lease;
 *                     400 past start date; 400 end before/equal start
 *   signLease       — 403 wrong tenant; 400 already signed/rejected; ACTIVE
 *                     transition also flips the property to OCCUPIED
 *   rejectLease     — 403 wrong tenant; 400 not OFFERED
 *   terminateLease  — 403 wrong owner; 400 not ACTIVE; transition flips the
 *                     property back to ACTIVE and clears the current tenant
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { prismaMock } from './mocks/prisma.js'
import { notifyUser } from '../src/features/notifications/notifications.service.js'

import {
  createLease,
  signLease,
  rejectLease,
  terminateLease,
} from '../src/features/leases/lease.service.js'

function makeLease(overrides = {}) {
  return {
    id: 'lease-1',
    propertyId: 'prop-1',
    tenantId: 'tenant-1',
    ownerId: 'owner-1',
    status: 'OFFERED',
    property: { title: 'Test flat' },
    ...overrides,
  }
}

const validLeaseData = {
  tenantId: 'tenant-1',
  startDate: '2099-01-01',
  endDate: '2099-12-31',
  rentAmount: 20000,
  depositAmount: 40000,
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('createLease', () => {
  it('throws 404 when the property is not found or not owned by the caller', async () => {
    prismaMock.property.findUnique.mockResolvedValue(null)

    await expect(createLease('owner-1', 'prop-1', validLeaseData)).rejects.toMatchObject({ statusCode: 404 })
  })

  it('throws 404 when the tenant does not exist', async () => {
    prismaMock.property.findUnique.mockResolvedValue({ id: 'prop-1', title: 'Test flat' })
    prismaMock.user.findUnique.mockResolvedValue(null)

    await expect(createLease('owner-1', 'prop-1', validLeaseData)).rejects.toMatchObject({ statusCode: 404 })
  })

  it('throws 400 when the owner tries to lease to themself', async () => {
    prismaMock.property.findUnique.mockResolvedValue({ id: 'prop-1', title: 'Test flat' })
    prismaMock.user.findUnique.mockResolvedValue({ id: 'owner-1' })

    await expect(createLease('owner-1', 'prop-1', { ...validLeaseData, tenantId: 'owner-1' })).rejects.toMatchObject({ statusCode: 400 })
  })

  it('throws 400 when the start date is in the past', async () => {
    prismaMock.property.findUnique.mockResolvedValue({ id: 'prop-1', title: 'Test flat' })
    prismaMock.user.findUnique.mockResolvedValue({ id: 'tenant-1' })

    await expect(createLease('owner-1', 'prop-1', { ...validLeaseData, startDate: '2020-01-01' })).rejects.toMatchObject({ statusCode: 400 })
  })

  it('throws 400 when the end date is not after the start date', async () => {
    prismaMock.property.findUnique.mockResolvedValue({ id: 'prop-1', title: 'Test flat' })
    prismaMock.user.findUnique.mockResolvedValue({ id: 'tenant-1' })

    await expect(createLease('owner-1', 'prop-1', { ...validLeaseData, endDate: validLeaseData.startDate })).rejects.toMatchObject({ statusCode: 400 })
  })

  it('creates an OFFERED lease and notifies the tenant on success', async () => {
    prismaMock.property.findUnique.mockResolvedValue({ id: 'prop-1', title: 'Test flat' })
    prismaMock.user.findUnique.mockResolvedValue({ id: 'tenant-1' })
    prismaMock.lease.create.mockResolvedValue(makeLease())

    const result = await createLease('owner-1', 'prop-1', validLeaseData)

    expect(result.status).toBe('OFFERED')
    expect(notifyUser).toHaveBeenCalledWith('tenant-1', expect.objectContaining({ type: 'LEASE_OFFERED' }))
  })
})

describe('signLease', () => {
  it('throws 403 when the caller is not the lease tenant', async () => {
    prismaMock.lease.findUnique.mockResolvedValue(makeLease())

    await expect(signLease('lease-1', 'someone-else', {})).rejects.toMatchObject({ statusCode: 403 })
  })

  it('throws 400 when the lease is not in OFFERED state', async () => {
    prismaMock.lease.findUnique.mockResolvedValue(makeLease({ status: 'ACTIVE' }))

    await expect(signLease('lease-1', 'tenant-1', {})).rejects.toMatchObject({ statusCode: 400 })
  })

  it('activates the lease and occupies the property on success', async () => {
    const lease = makeLease()
    prismaMock.lease.findUnique.mockResolvedValue(lease)
    prismaMock.lease.update.mockResolvedValue({ ...lease, status: 'ACTIVE' })
    prismaMock.property.update.mockResolvedValue({ id: 'prop-1', status: 'OCCUPIED' })

    const result = await signLease('lease-1', 'tenant-1', { tenantNote: 'Looking forward to it' })

    expect(result.status).toBe('ACTIVE')
    expect(prismaMock.property.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'OCCUPIED', currentTenantId: 'tenant-1' }) })
    )
    expect(notifyUser).toHaveBeenCalledWith('owner-1', expect.objectContaining({ type: 'LEASE_SIGNED' }))
  })
})

describe('rejectLease', () => {
  it('throws 403 when the caller is not the lease tenant', async () => {
    prismaMock.lease.findUnique.mockResolvedValue(makeLease())

    await expect(rejectLease('lease-1', 'someone-else', {})).rejects.toMatchObject({ statusCode: 403 })
  })

  it('throws 400 when the lease is not in OFFERED state', async () => {
    prismaMock.lease.findUnique.mockResolvedValue(makeLease({ status: 'REJECTED' }))

    await expect(rejectLease('lease-1', 'tenant-1', {})).rejects.toMatchObject({ statusCode: 400 })
  })

  it('rejects the lease and notifies the owner on success', async () => {
    const lease = makeLease()
    prismaMock.lease.findUnique.mockResolvedValue(lease)
    prismaMock.lease.update.mockResolvedValue({ ...lease, status: 'REJECTED' })

    const result = await rejectLease('lease-1', 'tenant-1', {})

    expect(result.status).toBe('REJECTED')
    expect(notifyUser).toHaveBeenCalledWith('owner-1', expect.objectContaining({ type: 'LEASE_REJECTED' }))
  })
})

describe('terminateLease', () => {
  it('throws 403 when the caller is not the lease owner', async () => {
    prismaMock.lease.findUnique.mockResolvedValue(makeLease({ status: 'ACTIVE' }))

    await expect(terminateLease('lease-1', 'someone-else', {})).rejects.toMatchObject({ statusCode: 403 })
  })

  it('throws 400 when the lease is not ACTIVE', async () => {
    prismaMock.lease.findUnique.mockResolvedValue(makeLease({ status: 'OFFERED' }))

    await expect(terminateLease('lease-1', 'owner-1', {})).rejects.toMatchObject({ statusCode: 400 })
  })

  it('terminates the lease and frees the property on success', async () => {
    const lease = makeLease({ status: 'ACTIVE' })
    prismaMock.lease.findUnique.mockResolvedValue(lease)
    prismaMock.lease.update.mockResolvedValue({ ...lease, status: 'TERMINATED' })
    prismaMock.property.update.mockResolvedValue({ id: 'prop-1', status: 'ACTIVE' })

    const result = await terminateLease('lease-1', 'owner-1', { ownerNote: 'Lease ended early' })

    expect(result.status).toBe('TERMINATED')
    expect(prismaMock.property.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'ACTIVE', currentTenantId: null }) })
    )
    expect(notifyUser).toHaveBeenCalledWith('tenant-1', expect.objectContaining({ type: 'SYSTEM' }))
  })
})
