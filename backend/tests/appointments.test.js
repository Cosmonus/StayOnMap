/**
 * Appointments service tests
 *
 * What each suite guards against:
 *   requestAppointment      — 404 missing property; 400 inactive/own-property;
 *                             403 frozen bookings on risky properties; 409 duplicate pending request
 *   updateAppointmentStatus — 404 missing; 403 wrong owner; ACCEPTED auto-rejects
 *                             other PENDING requests for the same property + date
 *   tenant cancellation     — the renter who ASKED for the visit may call it
 *                             off, may do nothing else, and cannot write in the
 *                             owner's voice while doing it
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { prismaMock } from './mocks/prisma.js'
import { notifyUser } from '../src/features/notifications/notifications.service.js'

import {
  requestAppointment,
  updateAppointmentStatus,
} from '../src/features/appointments/appointments.service.js'

// A visit has to be in the FUTURE — `requestAppointment` rejects a slot that
// has already passed, which is correct behaviour and was also a time bomb in
// this file: the fixture hardcoded `2026-08-01`, which was comfortably ahead
// when it was written and silently became the past on 2026-08-01. Five tests
// then failed for a reason that had nothing to do with the code they cover,
// and because deploys are gated on the suite, a green branch stopped shipping.
//
// Derive it instead. Any date literal in a test that feeds a future-dated
// validator is a countdown, not a fixture.
function daysFromNow(n) {
  const d = new Date(Date.now() + n * 24 * 60 * 60 * 1000)
  return d.toISOString().slice(0, 10) // yyyy-mm-dd, what the API accepts
}

const FUTURE_DATE = daysFromNow(7)

const validRequestData = {
  requestedDate: FUTURE_DATE,
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
    requestedDate: new Date(FUTURE_DATE),
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

/**
 * This endpoint used to be owner-only, which made CANCELLED a status nothing
 * could ever set: the person who asked for the visit had no way to withdraw it,
 * and their only route out was messaging the owner and hoping. The tests below
 * pin the narrow hole that was opened for them — narrow because the same
 * request body is shared with the owner's accept/reject/reschedule, so an
 * unguarded tenant path hands the renter the owner's controls.
 */
describe('updateAppointmentStatus — tenant cancelling their own request', () => {
  it('lets the tenant cancel their own request', async () => {
    const appt = makeAppointment()
    prismaMock.appointment.findUnique.mockResolvedValue(appt)
    prismaMock.appointment.update.mockResolvedValue({ ...appt, status: 'CANCELLED' })

    const result = await updateAppointmentStatus('appt-1', 'tenant-1', { status: 'CANCELLED' })

    expect(result.status).toBe('CANCELLED')
  })

  it.each(['ACCEPTED', 'REJECTED', 'RESCHEDULED'])(
    'throws 403 when the tenant tries to set %s',
    async (status) => {
      prismaMock.appointment.findUnique.mockResolvedValue(makeAppointment())

      await expect(updateAppointmentStatus('appt-1', 'tenant-1', { status })).rejects.toMatchObject({
        statusCode: 403,
      })
      expect(prismaMock.appointment.update).not.toHaveBeenCalled()
    },
  )

  it('notifies the OWNER, not the tenant, when the tenant cancels', async () => {
    // The notification on the owner path is addressed to the tenant. Reusing it
    // for a cancellation would tell the renter about their own action and leave
    // the owner holding a request that no longer exists — and the audience must
    // be OWNER, which is exactly why audience can't be derived from `type`
    // (APPOINTMENT_STATUS goes to either hat depending on who acted).
    const appt = makeAppointment()
    prismaMock.appointment.findUnique.mockResolvedValue(appt)
    prismaMock.appointment.update.mockResolvedValue({ ...appt, status: 'CANCELLED' })

    await updateAppointmentStatus('appt-1', 'tenant-1', { status: 'CANCELLED' })

    expect(notifyUser).toHaveBeenCalledTimes(1)
    expect(notifyUser).toHaveBeenCalledWith('owner-1', expect.objectContaining({
      type: 'APPOINTMENT_STATUS',
      audience: 'OWNER',
    }))
  })

  it('ignores ownerNote and scheduledAt sent by the tenant', async () => {
    // updateStatusSchema is shared with the owner's actions, so it accepts both
    // fields from whoever posts. `ownerNote` renders on both clients labelled
    // "Owner reply" — a renter writing into it puts their words on the owner's
    // card under the owner's name — and `scheduledAt` is the owner's new slot.
    const appt = makeAppointment()
    prismaMock.appointment.findUnique.mockResolvedValue(appt)
    prismaMock.appointment.update.mockResolvedValue({ ...appt, status: 'CANCELLED' })

    await updateAppointmentStatus('appt-1', 'tenant-1', {
      status: 'CANCELLED',
      ownerNote: 'The owner said this place is fine, honest',
      scheduledAt: new Date(Date.now() + 86400000).toISOString(),
    })

    expect(prismaMock.appointment.update).toHaveBeenCalledWith({
      where: { id: 'appt-1' },
      data: { status: 'CANCELLED' },
    })
  })

  it('throws 409 when the visit is already settled', async () => {
    // Two taps on "Cancel this visit" — or a cancel on something the owner
    // already rejected — must not resurrect and re-close the exchange, nor
    // fire a second notification about it.
    prismaMock.appointment.findUnique.mockResolvedValue(makeAppointment({ status: 'CANCELLED' }))

    await expect(updateAppointmentStatus('appt-1', 'tenant-1', { status: 'CANCELLED' })).rejects.toMatchObject({
      statusCode: 409,
    })
    expect(prismaMock.appointment.update).not.toHaveBeenCalled()
  })

  it('throws 403 for a stranger cancelling someone else’s visit', async () => {
    prismaMock.appointment.findUnique.mockResolvedValue(makeAppointment())

    await expect(updateAppointmentStatus('appt-1', 'nosy-1', { status: 'CANCELLED' })).rejects.toMatchObject({
      statusCode: 403,
    })
  })
})
