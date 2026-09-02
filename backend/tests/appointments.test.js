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
  getVisitAvailability,
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

// ─────────────────────────────────────────────────────────────────────────────
// Availability, and the renter's counter-offer (both added 2026-08-07)
// ─────────────────────────────────────────────────────────────────────────────

// The owner's window was offered by both booking forms and enforced by
// neither end until 2026-09-02 — a hand-built request could book 7 AM on a
// listing whose owner said 10 to 6.
describe('requestAppointment — the owner\'s viewing window', () => {
  const windowed = { id: 'prop-1', ownerId: 'owner-1', status: 'ACTIVE', riskScore: null, appointmentWindowStart: '10:00', appointmentWindowEnd: '18:00' }

  beforeEach(() => {
    prismaMock.appointment.findFirst.mockResolvedValue(null)
    prismaMock.availabilityBlock.findFirst.mockResolvedValue(null)
    prismaMock.appointment.create.mockResolvedValue(makeAppointment())
  })

  it('refuses a slot outside the window, naming the window', async () => {
    prismaMock.property.findUnique.mockResolvedValue(windowed)
    await expect(requestAppointment('tenant-1', 'prop-1', { ...validRequestData, requestedTime: '07:00' })).rejects.toMatchObject({
      statusCode: 400, message: expect.stringMatching(/between 10:00 AM and 6:00 PM/),
    })
    await expect(requestAppointment('tenant-1', 'prop-1', { ...validRequestData, requestedTime: '18:30' })).rejects.toMatchObject({ statusCode: 400 })
    expect(prismaMock.appointment.create).not.toHaveBeenCalled()
  })

  it('accepts both bounds inclusively, matching the forms', async () => {
    prismaMock.property.findUnique.mockResolvedValue(windowed)
    await expect(requestAppointment('tenant-1', 'prop-1', { ...validRequestData, requestedTime: '10:00' })).resolves.toBeTruthy()
    await expect(requestAppointment('tenant-1', 'prop-1', { ...validRequestData, requestedTime: '18:00' })).resolves.toBeTruthy()
  })

  it('a listing with no window accepts any slot, as before', async () => {
    prismaMock.property.findUnique.mockResolvedValue({ ...windowed, appointmentWindowStart: null, appointmentWindowEnd: null })
    await expect(requestAppointment('tenant-1', 'prop-1', { ...validRequestData, requestedTime: '07:00' })).resolves.toBeTruthy()
  })

  it('a renter\'s counter-offer is held to the same window', async () => {
    prismaMock.appointment.findUnique.mockResolvedValue(makeAppointment({ property: { title: 'Test flat', appointmentWindowStart: '10:00', appointmentWindowEnd: '18:00' } }))
    await expect(updateAppointmentStatus('appt-1', 'tenant-1', { status: 'RESCHEDULE_REQUESTED', requestedDate: FUTURE_DATE, requestedTime: '08:00' })).rejects.toMatchObject({
      statusCode: 400, message: expect.stringMatching(/between 10:00 AM and 6:00 PM/),
    })
  })
})

describe('requestAppointment — days the owner is not free', () => {
  beforeEach(() => {
    prismaMock.property.findUnique.mockResolvedValue({ id: 'prop-1', ownerId: 'owner-1', status: 'ACTIVE', riskScore: null })
    prismaMock.appointment.findFirst.mockResolvedValue(null)
    prismaMock.availabilityBlock.findFirst.mockResolvedValue(null)
  })

  it('refuses a day the owner already has an ACCEPTED visit on', async () => {
    // findFirst is called twice in requestAppointment: once for this tenant's
    // own pending request, then once inside isDateUnavailable.
    prismaMock.appointment.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 'other-appt' })

    await expect(requestAppointment('tenant-1', 'prop-1', validRequestData)).rejects.toMatchObject({
      statusCode: 409,
    })
    expect(prismaMock.appointment.create).not.toHaveBeenCalled()
  })

  it('refuses a day the owner blocked out themselves', async () => {
    prismaMock.availabilityBlock.findFirst.mockResolvedValue({ id: 'block-1' })

    await expect(requestAppointment('tenant-1', 'prop-1', validRequestData)).rejects.toMatchObject({
      statusCode: 409,
    })
  })

  it('a PENDING request from someone else blocks nothing', async () => {
    // Only ACCEPTED counts. If PENDING blocked a day, anyone could freeze a
    // listing's whole calendar with requests they never intend to keep.
    prismaMock.appointment.create.mockResolvedValue(makeAppointment())

    await expect(requestAppointment('tenant-1', 'prop-1', validRequestData)).resolves.toBeTruthy()
    const isDateQuery = prismaMock.appointment.findFirst.mock.calls.at(-1)[0]
    expect(isDateQuery.where.status).toBe('ACCEPTED')
  })
})

describe('getVisitAvailability', () => {
  it('merges accepted visits and owner blocks into one date list', async () => {
    prismaMock.appointment.findMany.mockResolvedValue([
      { requestedDate: new Date('2026-08-12T00:00:00.000Z') },
    ])
    prismaMock.availabilityBlock.findMany.mockResolvedValue([
      { date: new Date('2026-08-14T00:00:00.000Z') },
      // Same day as the accepted visit — must not appear twice.
      { date: new Date('2026-08-12T00:00:00.000Z') },
    ])

    const result = await getVisitAvailability('prop-1')

    expect(result.unavailableDates).toEqual(['2026-08-12', '2026-08-14'])
  })

  it('asks only for ACCEPTED appointments', async () => {
    prismaMock.appointment.findMany.mockResolvedValue([])
    prismaMock.availabilityBlock.findMany.mockResolvedValue([])

    await getVisitAvailability('prop-1')

    expect(prismaMock.appointment.findMany.mock.calls[0][0].where.status).toBe('ACCEPTED')
  })

  it('expands an accepted stay into every NIGHT of its range — the check-out day stays free', async () => {
    const checkIn = daysFromNow(3)
    prismaMock.appointment.findMany.mockResolvedValue([
      { requestedDate: new Date(`${checkIn}T00:00:00.000Z`), checkOutDate: new Date(`${daysFromNow(6)}T00:00:00.000Z`) },
    ])
    prismaMock.availabilityBlock.findMany.mockResolvedValue([])

    const result = await getVisitAvailability('prop-1')

    expect(result.unavailableDates).toEqual([daysFromNow(3), daysFromNow(4), daysFromNow(5)])
  })
})

/**
 * SHORT_STAY: a stay is booked as a DATE RANGE — check-in in requestedDate,
 * check-out in checkOutDate, nights [in, out) — and the property's own type
 * decides which shape applies, never the client. instantBook is the owner's
 * standing acceptance of any valid request.
 */
describe('requestAppointment — SHORT_STAY date-range booking', () => {
  const stayProperty = {
    id: 'prop-1', ownerId: 'owner-1', status: 'ACTIVE', riskScore: null,
    type: 'SHORT_STAY', minNights: 2, maxNights: 28, instantBook: false,
  }
  const stayRequest = {
    requestedDate: daysFromNow(7),
    checkOutDate: daysFromNow(10),
    requestedTime: '12:00',
    contactNumber: '9876543210',
  }

  beforeEach(() => {
    prismaMock.property.findUnique.mockResolvedValue({ ...stayProperty })
    prismaMock.appointment.findFirst.mockResolvedValue(null)
    prismaMock.appointment.findMany.mockResolvedValue([])
    prismaMock.availabilityBlock.findFirst.mockResolvedValue(null)
  })

  it('refuses a stay with no check-out date, and one that ends before it starts', async () => {
    await expect(requestAppointment('tenant-1', 'prop-1', { ...stayRequest, checkOutDate: undefined }))
      .rejects.toMatchObject({ statusCode: 400 })
    await expect(requestAppointment('tenant-1', 'prop-1', { ...stayRequest, checkOutDate: daysFromNow(7) }))
      .rejects.toMatchObject({ statusCode: 400 })
  })

  it('enforces the property’s own minimum and maximum nights', async () => {
    await expect(requestAppointment('tenant-1', 'prop-1', { ...stayRequest, checkOutDate: daysFromNow(8) }))
      .rejects.toMatchObject({ statusCode: 400, message: expect.stringMatching(/minimum stay of 2/) })
    prismaMock.property.findUnique.mockResolvedValue({ ...stayProperty, maxNights: 2 })
    await expect(requestAppointment('tenant-1', 'prop-1', stayRequest))
      .rejects.toMatchObject({ statusCode: 400, message: expect.stringMatching(/up to 2 nights/) })
  })

  it('refuses a range that crosses an owner-blocked night', async () => {
    prismaMock.availabilityBlock.findFirst.mockResolvedValue({ id: 'block-1' })
    await expect(requestAppointment('tenant-1', 'prop-1', stayRequest))
      .rejects.toMatchObject({ statusCode: 409 })
    expect(prismaMock.appointment.create).not.toHaveBeenCalled()
  })

  it('creates a pending stay request with the range, and tells the owner it is a stay', async () => {
    prismaMock.appointment.create.mockResolvedValue(makeAppointment({ checkOutDate: new Date(stayRequest.checkOutDate) }))

    await requestAppointment('tenant-1', 'prop-1', stayRequest)

    const created = prismaMock.appointment.create.mock.calls[0][0].data
    expect(created.checkOutDate).toBeInstanceOf(Date)
    expect(created.status).toBeUndefined() // PENDING by default — no instant book
    expect(notifyUser).toHaveBeenCalledWith('owner-1', expect.objectContaining({
      title: 'New stay request',
    }))
  })

  it('instant book accepts on the owner’s standing instruction and stamps respondedAt', async () => {
    prismaMock.property.findUnique.mockResolvedValue({ ...stayProperty, instantBook: true })
    prismaMock.appointment.create.mockResolvedValue(makeAppointment({ status: 'ACCEPTED', checkOutDate: new Date(stayRequest.checkOutDate) }))

    const result = await requestAppointment('tenant-1', 'prop-1', stayRequest)

    const created = prismaMock.appointment.create.mock.calls[0][0].data
    expect(created.status).toBe('ACCEPTED')
    expect(created.respondedAt).toBeInstanceOf(Date)
    expect(result.status).toBe('ACCEPTED')
    expect(notifyUser).toHaveBeenCalledWith('owner-1', expect.objectContaining({
      title: 'New booking confirmed',
    }))
  })

  it('a flat cannot be opted into ranges by the client — checkOutDate is ignored', async () => {
    prismaMock.property.findUnique.mockResolvedValue({ id: 'prop-1', ownerId: 'owner-1', status: 'ACTIVE', riskScore: null, type: 'APARTMENT' })
    prismaMock.appointment.create.mockResolvedValue(makeAppointment())

    await requestAppointment('tenant-1', 'prop-1', { ...validRequestData, checkOutDate: daysFromNow(10) })

    expect(prismaMock.appointment.create.mock.calls[0][0].data.checkOutDate).toBeNull()
  })
})

describe('updateAppointmentStatus — tenant proposing a different time', () => {
  const NEW_DATE = daysFromNow(10)
  const counterOffer = { status: 'RESCHEDULE_REQUESTED', requestedDate: NEW_DATE, requestedTime: '16:30', tenantNote: 'Work thing' }

  beforeEach(() => {
    prismaMock.appointment.findFirst.mockResolvedValue(null)
    prismaMock.availabilityBlock.findFirst.mockResolvedValue(null)
  })

  it('writes the tenant’s own slot and note, and clears the owner’s stale time', async () => {
    prismaMock.appointment.findUnique.mockResolvedValue(
      makeAppointment({ status: 'ACCEPTED', scheduledAt: new Date(FUTURE_DATE) }),
    )
    prismaMock.appointment.update.mockResolvedValue(makeAppointment({ status: 'RESCHEDULE_REQUESTED' }))

    await updateAppointmentStatus('appt-1', 'tenant-1', counterOffer)

    const { data } = prismaMock.appointment.update.mock.calls[0][0]
    expect(data.status).toBe('RESCHEDULE_REQUESTED')
    expect(data.requestedTime).toBe('16:30')
    expect(data.tenantNote).toBe('Work thing')
    // The owner's confirmed time is no longer what is on the table — a card
    // showing two times, one of them dead, is worse than showing one.
    expect(data.scheduledAt).toBeNull()
  })

  it('never lets the tenant write the owner’s fields', async () => {
    prismaMock.appointment.findUnique.mockResolvedValue(makeAppointment())
    prismaMock.appointment.update.mockResolvedValue(makeAppointment({ status: 'RESCHEDULE_REQUESTED' }))

    await updateAppointmentStatus('appt-1', 'tenant-1', {
      ...counterOffer,
      ownerNote: 'I said yes',
      scheduledAt: new Date(NEW_DATE).toISOString(),
    })

    const { data } = prismaMock.appointment.update.mock.calls[0][0]
    expect(data.ownerNote).toBeUndefined()
    expect(data.scheduledAt).toBeNull()
  })

  it('notifies the OWNER, carrying the proposed time', async () => {
    prismaMock.appointment.findUnique.mockResolvedValue(makeAppointment())
    prismaMock.appointment.update.mockResolvedValue(makeAppointment({ status: 'RESCHEDULE_REQUESTED' }))

    await updateAppointmentStatus('appt-1', 'tenant-1', counterOffer)

    expect(notifyUser).toHaveBeenCalledWith('owner-1', expect.objectContaining({
      audience: 'OWNER',
      title: 'New time proposed',
    }))
    expect(notifyUser).not.toHaveBeenCalledWith('tenant-1', expect.anything())
  })

  it('refuses a proposal with no slot', async () => {
    prismaMock.appointment.findUnique.mockResolvedValue(makeAppointment())

    await expect(
      updateAppointmentStatus('appt-1', 'tenant-1', { status: 'RESCHEDULE_REQUESTED' }),
    ).rejects.toMatchObject({ statusCode: 400 })
  })

  it('refuses a proposal in the past — the same check the first request gets', async () => {
    prismaMock.appointment.findUnique.mockResolvedValue(makeAppointment())

    await expect(updateAppointmentStatus('appt-1', 'tenant-1', {
      status: 'RESCHEDULE_REQUESTED', requestedDate: daysFromNow(-2), requestedTime: '10:00',
    })).rejects.toMatchObject({ statusCode: 400 })
  })

  it('refuses a proposal on a day the owner is already booked', async () => {
    prismaMock.appointment.findUnique.mockResolvedValue(makeAppointment())
    prismaMock.appointment.findFirst.mockResolvedValue({ id: 'other-appt' })

    await expect(updateAppointmentStatus('appt-1', 'tenant-1', counterOffer))
      .rejects.toMatchObject({ statusCode: 409 })
  })

  it('refuses an OWNER sending the renter’s status', async () => {
    // An owner does not request a reschedule of their own listing, they set
    // one. Allowing it would render a card asking them to approve themselves.
    prismaMock.appointment.findUnique.mockResolvedValue(makeAppointment())

    await expect(updateAppointmentStatus('appt-1', 'owner-1', counterOffer))
      .rejects.toMatchObject({ statusCode: 400 })
  })

  it('still refuses every other status from a tenant', async () => {
    prismaMock.appointment.findUnique.mockResolvedValue(makeAppointment())

    await expect(updateAppointmentStatus('appt-1', 'tenant-1', { status: 'ACCEPTED' }))
      .rejects.toMatchObject({ statusCode: 403 })
  })
})

describe('updateAppointmentStatus — the OWNER moving a visit', () => {
  // The owner's reschedule was API-only until 2026-08-12 — the enum value and
  // the service branch existed, but no client offered the button, and sending
  // scheduledAt alone would have left every queue card showing the OLD slot
  // (both platforms render requestedDate/requestedTime as "the slot on the
  // table"). These pin the shape that makes the UI honest: one slot in, three
  // consistent fields out.

  it('writes requestedDate/Time AND composes scheduledAt from the same slot', async () => {
    const appt = makeAppointment()
    prismaMock.appointment.findUnique.mockResolvedValue(appt)
    prismaMock.appointment.update.mockImplementation(({ data }) => ({ ...appt, ...data }))

    const newDate = daysFromNow(5)
    await updateAppointmentStatus('appt-1', 'owner-1', {
      status: 'RESCHEDULED', requestedDate: newDate, requestedTime: '16:30',
    })

    const { data } = prismaMock.appointment.update.mock.calls[0][0]
    expect(data.requestedTime).toBe('16:30')
    expect(data.requestedDate.toISOString().slice(0, 10)).toBe(newDate)
    // Composed server-side, never client-supplied — so the instant and the
    // displayed pair cannot disagree. 16:30 IST is 11:00 UTC.
    expect(data.scheduledAt.toISOString()).toBe(`${newDate}T11:00:00.000Z`)
  })

  it('refuses a reschedule with no new slot', async () => {
    prismaMock.appointment.findUnique.mockResolvedValue(makeAppointment())
    await expect(updateAppointmentStatus('appt-1', 'owner-1', { status: 'RESCHEDULED' }))
      .rejects.toMatchObject({ statusCode: 400 })
    expect(prismaMock.appointment.update).not.toHaveBeenCalled()
  })

  it('refuses a slot in the past — whoever proposes it', async () => {
    prismaMock.appointment.findUnique.mockResolvedValue(makeAppointment())
    await expect(updateAppointmentStatus('appt-1', 'owner-1', {
      status: 'RESCHEDULED', requestedDate: daysFromNow(-2), requestedTime: '10:00',
    })).rejects.toMatchObject({ statusCode: 400 })
  })

  it('tells the TENANT the new time, not just that something changed', async () => {
    const appt = makeAppointment()
    prismaMock.appointment.findUnique.mockResolvedValue(appt)
    prismaMock.appointment.update.mockImplementation(({ data }) => ({ ...appt, ...data }))

    await updateAppointmentStatus('appt-1', 'owner-1', {
      status: 'RESCHEDULED', requestedDate: daysFromNow(5), requestedTime: '16:30',
    })

    expect(notifyUser).toHaveBeenCalledWith('tenant-1', expect.objectContaining({
      audience: 'TENANT',
      body: expect.stringContaining('moved your visit to'),
    }))
  })
})
