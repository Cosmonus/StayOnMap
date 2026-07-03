/**
 * Appointments service tests
 *
 * What each suite guards against:
 *   requestAppointment      — 404 missing property; 400 inactive/own-property;
 *                             403 frozen bookings on risky properties; 409 duplicate pending request
 *   updateAppointmentStatus — 404 missing; 403 wrong owner; ACCEPTED auto-rejects
 *                             other PENDING requests for the same property + date
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { prismaMock } from './mocks/prisma.js'
import { notifyUser } from '../src/features/notifications/notifications.service.js'

import {
  requestAppointment,
  updateAppointmentStatus,
} from '../src/features/appointments/appointments.service.js'

const validRequestData = {
  requestedDate: '2026-08-01',
  requestedTime: '10:00',
  contactNumber: '9876543210',
}

function makeAppointment(overrides = {}) {
  return {
    id: 'appt-1',
    tenantId: 'tenant-1',
    ownerId: 'owner-1',
    propertyId: 'prop-1',
    status: 'PENDING',
    requestedDate: new Date('2026-08-01'),
    property: { title: 'Test flat' },
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('requestAppointment', () => {
  it('throws 404 when the property does not exist', async () => {
    prismaMock.property.findUnique.mockResolvedValue(null)

    await expect(requestAppointment('tenant-1', 'prop-1', validRequestData)).rejects.toMatchObject({
      statusCode: 404,
    })
  })

  it('throws 400 when the property is not ACTIVE', async () => {
    prismaMock.property.findUnique.mockResolvedValue({ id: 'prop-1', ownerId: 'owner-1', status: 'PENDING', riskScore: null })

    await expect(requestAppointment('tenant-1', 'prop-1', validRequestData)).rejects.toMatchObject({
      statusCode: 400,
    })
  })

  it('throws 400 when the tenant is the property owner', async () => {
    prismaMock.property.findUnique.mockResolvedValue({ id: 'prop-1', ownerId: 'owner-1', status: 'ACTIVE', riskScore: null })

    await expect(requestAppointment('owner-1', 'prop-1', validRequestData)).rejects.toMatchObject({
      statusCode: 400,
    })
  })

  it.each(['HIGH', 'SUSPICIOUS'])('throws 403 when the property risk level is %s', async (level) => {
    prismaMock.property.findUnique.mockResolvedValue({ id: 'prop-1', ownerId: 'owner-1', status: 'ACTIVE', riskScore: { level } })

    await expect(requestAppointment('tenant-1', 'prop-1', validRequestData)).rejects.toMatchObject({
      statusCode: 403,
    })
  })

  it('throws 409 when the tenant already has a pending request for this property', async () => {
    prismaMock.property.findUnique.mockResolvedValue({ id: 'prop-1', ownerId: 'owner-1', status: 'ACTIVE', riskScore: null })
    prismaMock.appointment.findFirst.mockResolvedValue(makeAppointment())

    await expect(requestAppointment('tenant-1', 'prop-1', validRequestData)).rejects.toMatchObject({
      statusCode: 409,
    })
  })

  it('creates the appointment and notifies the owner on success', async () => {
    prismaMock.property.findUnique.mockResolvedValue({ id: 'prop-1', ownerId: 'owner-1', status: 'ACTIVE', riskScore: null })
    prismaMock.appointment.findFirst.mockResolvedValue(null)
    prismaMock.appointment.create.mockResolvedValue(makeAppointment())

    const result = await requestAppointment('tenant-1', 'prop-1', validRequestData)

    expect(result.status).toBe('PENDING')
    expect(notifyUser).toHaveBeenCalledWith('owner-1', expect.objectContaining({ type: 'APPOINTMENT_REQUEST' }))
  })
})

describe('updateAppointmentStatus', () => {
  it('throws 404 when the appointment does not exist', async () => {
    prismaMock.appointment.findUnique.mockResolvedValue(null)

    await expect(updateAppointmentStatus('appt-1', 'owner-1', { status: 'ACCEPTED' })).rejects.toMatchObject({
      statusCode: 404,
    })
  })

  it('throws 403 when the caller is not the appointment owner', async () => {
    prismaMock.appointment.findUnique.mockResolvedValue(makeAppointment({ ownerId: 'owner-1' }))

    await expect(updateAppointmentStatus('appt-1', 'someone-else', { status: 'ACCEPTED' })).rejects.toMatchObject({
      statusCode: 403,
    })
  })

  it('auto-rejects other PENDING requests for the same property and date on ACCEPTED', async () => {
    const appt = makeAppointment()
    prismaMock.appointment.findUnique.mockResolvedValue(appt)
    prismaMock.appointment.update.mockResolvedValue({ ...appt, status: 'ACCEPTED' })
    prismaMock.appointment.findMany.mockResolvedValue([
      { id: 'appt-2', tenantId: 'tenant-2' },
      { id: 'appt-3', tenantId: 'tenant-3' },
    ])

    await updateAppointmentStatus('appt-1', 'owner-1', { status: 'ACCEPTED' })

    expect(prismaMock.appointment.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ id: { in: ['appt-2', 'appt-3'] } }) })
    )
    expect(notifyUser).toHaveBeenCalledWith('tenant-2', expect.objectContaining({ type: 'APPOINTMENT_REJECTED' }))
    expect(notifyUser).toHaveBeenCalledWith('tenant-3', expect.objectContaining({ type: 'APPOINTMENT_REJECTED' }))
  })

  it('does not touch other appointments when rejecting', async () => {
    const appt = makeAppointment()
    prismaMock.appointment.findUnique.mockResolvedValue(appt)
    prismaMock.appointment.update.mockResolvedValue({ ...appt, status: 'REJECTED' })

    await updateAppointmentStatus('appt-1', 'owner-1', { status: 'REJECTED' })

    expect(prismaMock.appointment.findMany).not.toHaveBeenCalled()
    expect(prismaMock.appointment.updateMany).not.toHaveBeenCalled()
  })
})
