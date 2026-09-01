import { prisma } from '../../lib/prisma.js'
import { notifyUser } from '../notifications/notifications.service.js'
import { getOrCreateConversation, sendMessage } from '../chat/chat.service.js'
import { blockExistsBetween, blockedError } from '../users/safety.service.js'
import { invalidatePreferences } from '../graph/preferences.js'

// India-only platform, so a wall-clock slot is always IST. The server may run
// anywhere (production is a UTC VM), which is exactly why this can't lean on
// the process timezone: `new Date('2026-07-26')` is UTC midnight, and adding a
// local "09:00" to it lands 5.5 hours off in either direction depending on
// where the box is.
const IST_OFFSET_MIN = 5.5 * 60

function istSlotInstant(dateISO, hhmm) {
  const day = new Date(dateISO)
  const [h, m] = hhmm.split(':').map(Number)
  return new Date(Date.UTC(
    day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate(), h, m,
  ) - IST_OFFSET_MIN * 60_000)
}

// "Tue, 29 Jul · 4:30 PM". Explicit timeZone for the same reason istSlotInstant
// exists: the box is UTC, and a slot printed in the process timezone is 5.5
// hours wrong.
function istSlotLabel(instant) {
  const d = new Date(instant)
  if (Number.isNaN(d.getTime())) return null
  return d.toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    weekday: 'short', day: 'numeric', month: 'short',
    hour: 'numeric', minute: '2-digit', hour12: true,
  }).replace(',', '') + ' IST'
}

// A visit request stores `requestedDate` as UTC midnight of the chosen day
// (the client sends `new Date('2026-08-12').toISOString()`), so day equality is
// exact equality — which is also what the same-date auto-reject already relies
// on. AvailabilityBlock.date is stored the same way.
function utcMidnight(dateISO) {
  const d = new Date(dateISO)
  if (Number.isNaN(d.getTime())) return null
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
}

const AVAILABILITY_DAYS = 30

// The days a renter cannot ask for, and why they can't:
//   • an ACCEPTED visit — the owner has committed the day to someone
//   • an AvailabilityBlock — the owner marked the day unavailable themselves
//
// PENDING requests deliberately block NOTHING. They are unconfirmed, and if
// they blocked a day then anyone could freeze a listing's whole calendar by
// firing off requests they never intend to keep.
//
// The response is a bare list of dates: no times, no counts, no identities. It
// says "the owner is busy", which is what any booking calendar says, and
// nothing about who else is looking at the place.
export async function getVisitAvailability(propertyId) {
  const from = utcMidnight(new Date().toISOString())
  const to = new Date(from.getTime() + AVAILABILITY_DAYS * 86_400_000)

  const [booked, blocked] = await Promise.all([
    prisma.appointment.findMany({
      // A stay that STARTED before the window can still occupy nights inside
      // it, so the filter is "overlaps the window", not "starts in it".
      where: {
        propertyId, status: 'ACCEPTED',
        requestedDate: { lte: to },
        OR: [{ checkOutDate: null, requestedDate: { gte: from } }, { checkOutDate: { gt: from } }],
      },
      select: { requestedDate: true, checkOutDate: true },
    }),
    prisma.availabilityBlock.findMany({
      where: { propertyId, isBlocked: true, date: { gte: from, lte: to } },
      select: { date: true },
    }),
  ])

  const dates = new Set(blocked.map((b) => b.date.toISOString().slice(0, 10)))
  for (const a of booked) {
    if (!a.checkOutDate) { dates.add(a.requestedDate.toISOString().slice(0, 10)); continue }
    // An accepted stay occupies every NIGHT of its range — [checkIn,
    // checkOut) — so the check-out day itself stays available for the next
    // guest's check-in.
    for (let d = Math.max(a.requestedDate.getTime(), from.getTime()); d < Math.min(a.checkOutDate.getTime(), to.getTime() + 86_400_000); d += 86_400_000) {
      dates.add(new Date(d).toISOString().slice(0, 10))
    }
  }
  return { unavailableDates: [...dates].sort() }
}

async function isDateUnavailable(propertyId, dateISO) {
  const day = utcMidnight(dateISO)
  if (!day) return false
  const [booked, blocked] = await Promise.all([
    prisma.appointment.findFirst({
      where: { propertyId, status: 'ACCEPTED', requestedDate: day },
      select: { id: true },
    }),
    prisma.availabilityBlock.findFirst({
      where: { propertyId, isBlocked: true, date: day },
      select: { id: true },
    }),
  ])
  return Boolean(booked || blocked)
}

// A stay range [checkIn, checkOut) is unavailable when any of its NIGHTS is —
// blocked by the owner, taken by an accepted visit, or inside an accepted
// stay. Two ranges overlap when each starts before the other ends.
async function isRangeUnavailable(propertyId, fromDay, toDay) {
  const [blocked, bookedVisit, bookedStay] = await Promise.all([
    prisma.availabilityBlock.findFirst({
      where: { propertyId, isBlocked: true, date: { gte: fromDay, lt: toDay } },
      select: { id: true },
    }),
    prisma.appointment.findFirst({
      where: { propertyId, status: 'ACCEPTED', checkOutDate: null, requestedDate: { gte: fromDay, lt: toDay } },
      select: { id: true },
    }),
    prisma.appointment.findFirst({
      where: { propertyId, status: 'ACCEPTED', checkOutDate: { gt: fromDay }, requestedDate: { lt: toDay } },
      select: { id: true },
    }),
  ])
  return Boolean(blocked || bookedVisit || bookedStay)
}

// Every other PENDING request an acceptance settles: same-day visits, and any
// stay whose range overlaps. Shared by the owner's Accept and by instant book,
// which is an acceptance the owner configured in advance.
async function rejectSupersededPending(appt) {
  const rangeEnd = appt.checkOutDate ?? new Date(appt.requestedDate.getTime() + 86_400_000)
  const conflicting = await prisma.appointment.findMany({
    where: {
      propertyId: appt.propertyId, id: { not: appt.id }, status: 'PENDING',
      requestedDate: { lt: rangeEnd },
      OR: [{ checkOutDate: null, requestedDate: { gte: appt.requestedDate } }, { checkOutDate: { gt: appt.requestedDate } }],
    },
    select: { id: true, tenantId: true },
  })
  if (!conflicting.length) return
  await prisma.appointment.updateMany({
    // These are answers too — filling the slot decides every other request for
    // it. `respondedAt: null` is belt-and-braces: PENDING rows can't carry one.
    where: { id: { in: conflicting.map((c) => c.id) }, respondedAt: null },
    data: { status: 'REJECTED', ownerNote: 'Another visit was scheduled for this date.', respondedAt: new Date() },
  })
  await Promise.all(conflicting.map((c) =>
    notifyUser(c.tenantId, {
      type: 'APPOINTMENT_REJECTED',
      title: 'Appointment not available',
      body: 'Another visit was scheduled for this date. Please request a different date.',
      referenceId: c.id,
      referenceType: 'Appointment',
      audience: 'TENANT',
    }).catch(() => {})
  ))
}

// A visit can't be asked for at a time that has already happened. Nothing
// checked this, so "Today · 9:00 AM" booked at 3pm was accepted and sent to the
// owner as a real request — a notification about a slot that passed six hours
// ago, indistinguishable from a genuine one.
//
// Shared by the first request and by a renter's counter-offer: a proposed time
// is a time, and both need exactly these two checks.
function assertFutureSlot(dateISO, hhmm) {
  const slot = istSlotInstant(dateISO, hhmm)
  if (Number.isNaN(slot.getTime())) {
    throw Object.assign(new Error('That date and time could not be read'), { statusCode: 400 })
  }
  if (slot.getTime() <= Date.now()) {
    throw Object.assign(
      new Error('That time has already passed — pick a later slot.'),
      { statusCode: 400 },
    )
  }
}

export async function requestAppointment(tenantId, propertyId, data) {
  const property = await prisma.property.findUnique({
    where: { id: propertyId },
    select: { id: true, ownerId: true, status: true, riskScore: true, type: true, minNights: true, maxNights: true, instantBook: true },
  })
  if (!property) throw Object.assign(new Error('Property not found'), { statusCode: 404 })
  if (property.status !== 'ACTIVE') throw Object.assign(new Error('Property is not available'), { statusCode: 400 })
  if (property.ownerId === tenantId) throw Object.assign(new Error('Cannot book your own property'), { statusCode: 400 })

  // A short stay is booked as a DATE RANGE, not a viewing slot — check-in in
  // requestedDate, check-out in checkOutDate, nights [in, out). The property's
  // type decides which shape applies; a client cannot opt a flat into ranges
  // or a stay out of them.
  const isStay = property.type === 'SHORT_STAY'
  let checkOutDay = null
  if (!isStay) {
    // A visit is a slot, and a slot in the past is unactionable.
    assertFutureSlot(data.requestedDate, data.requestedTime)
  } else {
    const checkIn = utcMidnight(data.requestedDate)
    // A stay has no slot — checking in TODAY at 9pm is a real booking, so the
    // gate is the IST calendar day, not a clock time.
    const istToday = utcMidnight(new Date(Date.now() + IST_OFFSET_MIN * 60_000).toISOString())
    if (!checkIn || checkIn < istToday) {
      throw Object.assign(new Error('Check-in cannot be in the past.'), { statusCode: 400 })
    }
    checkOutDay = data.checkOutDate ? utcMidnight(data.checkOutDate) : null
    if (!checkOutDay || checkOutDay <= checkIn) {
      throw Object.assign(new Error('Pick your check-in and check-out dates.'), { statusCode: 400 })
    }
    const nights = Math.round((checkOutDay - checkIn) / 86_400_000)
    if (property.minNights && nights < property.minNights) {
      throw Object.assign(new Error(`This place has a minimum stay of ${property.minNights} night${property.minNights === 1 ? '' : 's'}.`), { statusCode: 400 })
    }
    if (property.maxNights && nights > property.maxNights) {
      throw Object.assign(new Error(`This place takes stays of up to ${property.maxNights} nights.`), { statusCode: 400 })
    }
    if (await isRangeUnavailable(propertyId, checkIn, checkOutDay)) {
      throw Object.assign(new Error('Some of those dates are already booked or blocked — pick different dates.'), { statusCode: 409 })
    }
  }
  // Blocking has to cover the doorstep, not just the inbox. Someone you have
  // shut out of chat turning up at your home is strictly worse than a message,
  // and a visit request is the one action on this platform that produces a
  // physical meeting. Same neutral error as chat — it must not reveal which
  // side did the blocking.
  if (await blockExistsBetween(tenantId, property.ownerId)) throw blockedError()
  if (property.riskScore?.level === 'HIGH' || property.riskScore?.level === 'SUSPICIOUS') {
    throw Object.assign(new Error('Bookings frozen for this property'), { statusCode: 403 })
  }
  const existing = await prisma.appointment.findFirst({ where: { tenantId, propertyId, status: 'PENDING' } })
  if (existing) throw Object.assign(new Error('You already have a pending request for this property'), { statusCode: 409 })

  // A date the owner has already committed to, or blocked out, is not
  // requestable. Nothing checked this: the request was accepted, and then
  // updateAppointmentStatus below auto-rejected it the moment the owner touched
  // the day's confirmed visit — so the renter got an acceptance-shaped
  // rejection for a slot the platform knew was gone before they asked.
  //
  // The unit is the DAY, not the slot, because that is the unit the auto-reject
  // uses ("Another visit was scheduled for this date"). Greying individual times
  // would imply the owner runs several viewings a day, which the server does not
  // believe.
  if (!isStay && await isDateUnavailable(propertyId, data.requestedDate)) {
    throw Object.assign(
      new Error('The owner already has a visit booked that day — pick another date.'),
      { statusCode: 409 },
    )
  }

  // Instant book: the owner of a short stay opted in advance into accepting
  // any valid request — the range was just validated against their calendar,
  // so the platform answers on their standing instruction. respondedAt is
  // stamped because the renter waited zero, which is what it measures.
  const instant = isStay && property.instantBook === true

  const appt = await prisma.appointment.create({
    data: {
      ...data, tenantId, propertyId, ownerId: property.ownerId,
      requestedDate: new Date(data.requestedDate),
      checkOutDate: checkOutDay,
      ...(instant && { status: 'ACCEPTED', respondedAt: new Date() }),
    },
  })
  if (instant) await rejectSupersededPending(appt)

  const fmtDay = (d) => new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
  const rangeLine = isStay ? `${fmtDay(data.requestedDate)} → ${fmtDay(checkOutDay)}` : null

  await notifyUser(property.ownerId, {
    type: 'APPOINTMENT_REQUEST',
    title: instant ? 'New booking confirmed' : isStay ? 'New stay request' : 'New Appointment Request',
    body: instant
      ? `A guest booked your stay: ${rangeLine}. Instant book confirmed it for them.`
      : isStay
        ? `A guest requested to book your stay: ${rangeLine}.`
        : 'A tenant has requested to visit your property.',
    referenceId: appt.id,
    referenceType: 'Appointment',
    audience: 'OWNER',
  })

  // The strongest preference signal there is — asking to physically go and see
  // a place. Drop the cached profile so recommendations reflect it immediately
  // rather than up to five minutes later.
  invalidatePreferences(tenantId).catch(() => {})

  // Auto-create chat conversation and send appointment summary
  try {
    const chatMsg = isStay
      ? `${instant ? 'Stay booked (instant book)' : 'Stay requested'}\nCheck-in: ${fmtDay(data.requestedDate)}\nCheck-out: ${fmtDay(checkOutDay)}\nPhone: ${data.contactNumber}${data.message ? `\n\n${data.message}` : ''}`
      : `Visit requested\nDate: ${fmtDay(data.requestedDate)}\nTime: ${data.requestedTime}\nPhone: ${data.contactNumber}${data.message ? `\n\n${data.message}` : ''}`
    const convo = await getOrCreateConversation(tenantId, propertyId)
    await sendMessage(convo.id, tenantId, chatMsg)
  } catch { /* best-effort — don't fail the appointment if chat fails */ }

  return appt
}

export async function getTenantAppointments(tenantId) {
  return prisma.appointment.findMany({
    where: { tenantId },
    include: {
      property: {
        select: {
          id: true, displayId: true, title: true, city: true,
          // The renter's counter-offer picker has to offer the same hours the
          // booking form did. Without these it would fall back to the full
          // 09:00-20:00 list and let someone propose a time the owner never
          // agreed to be available for.
          appointmentWindowStart: true, appointmentWindowEnd: true,
          images: { where: { isPrimary: true }, take: 1 },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  })
}

export async function getOwnerAppointments(ownerId) {
  return prisma.appointment.findMany({
    where: { ownerId },
    include: {
      property: { select: { id: true, displayId: true, title: true, city: true, images: { where: { isPrimary: true }, take: 1 } } },
      tenant:   { select: { id: true, displayId: true, name: true, email: true, phone: true, avatarUrl: true } },
    },
    orderBy: { createdAt: 'desc' },
  })
}

export async function getPropertyAppointments(propertyId, ownerId) {
  const property = await prisma.property.findUnique({ where: { id: propertyId, ownerId }, select: { id: true } })
  if (!property) throw Object.assign(new Error('Property not found or access denied'), { statusCode: 404 })
  return prisma.appointment.findMany({ where: { propertyId }, include: { tenant: { select: { id: true, name: true, email: true, phone: true, avatarUrl: true } } }, orderBy: { createdAt: 'desc' } })
}

// Statuses that end the exchange — reopening one would resurrect a visit both
// sides have moved on from.
const SETTLED = new Set(['REJECTED', 'CANCELLED'])

// The only two a renter may set on their own request. Everything else — accept,
// reject, move the slot — stays the owner's.
const TENANT_STATUSES = new Set(['CANCELLED', 'RESCHEDULE_REQUESTED'])

export async function updateAppointmentStatus(
  appointmentId,
  userId,
  { status, scheduledAt, ownerNote, requestedDate, requestedTime, tenantNote },
) {
  const appt = await prisma.appointment.findUnique({ where: { id: appointmentId }, include: { property: { select: { title: true } } } })
  if (!appt) throw Object.assign(new Error('Appointment not found'), { statusCode: 404 })

  const isOwner  = appt.ownerId === userId
  const isTenant = appt.tenantId === userId
  if (!isOwner && !isTenant) throw Object.assign(new Error('Access denied'), { statusCode: 403 })

  // This endpoint was owner-only, so the person who ASKED for the visit had no
  // way to call it off — CANCELLED was a valid status nothing could ever set,
  // and a renter who changed their mind could only message the owner and hope.
  // RESCHEDULE_REQUESTED joined it 2026-08-07: until then a renter who could
  // not make the owner's slot had to cancel and start over from an empty form,
  // losing the thread's context and their place in the owner's queue.
  const tenantOnly = isTenant && !isOwner
  if (tenantOnly && !TENANT_STATUSES.has(status)) {
    throw Object.assign(
      new Error('Only the owner can accept or reject — you can cancel, or propose a different time.'),
      { statusCode: 403 },
    )
  }
  // An owner does not "request" a reschedule of their own listing; they set one
  // (RESCHEDULED). Letting them send the renter's status would produce a card
  // asking the owner to approve their own proposal.
  if (!tenantOnly && status === 'RESCHEDULE_REQUESTED') {
    throw Object.assign(
      new Error('Use RESCHEDULED to move a visit — RESCHEDULE_REQUESTED is the renter proposing one.'),
      { statusCode: 400 },
    )
  }

  if (SETTLED.has(appt.status)) {
    throw Object.assign(
      new Error(`This visit was already ${appt.status.toLowerCase()}.`),
      { statusCode: 409 },
    )
  }

  // A renter's counter-offer is a real slot and gets the same two checks the
  // original request got — otherwise "propose a different time" is the hole
  // through which a past or already-booked slot walks back in.
  if (status === 'RESCHEDULE_REQUESTED') {
    if (!requestedDate || !requestedTime) {
      throw Object.assign(new Error('Pick the date and time you would prefer.'), { statusCode: 400 })
    }
    assertFutureSlot(requestedDate, requestedTime)
    if (await isDateUnavailable(appt.propertyId, requestedDate)) {
      throw Object.assign(
        new Error('The owner already has a visit booked that day — pick another date.'),
        { statusCode: 409 },
      )
    }
  }

  // The owner moving a visit gets the same future-slot check the renter's
  // counter-offer gets — "propose a different time" must not be the hole
  // through which a past slot walks back in, whoever opens it. Deliberately
  // NOT the booked-day check: the renter is protected FROM the owner's
  // calendar; the owner overriding their own calendar is their call.
  if (!tenantOnly && status === 'RESCHEDULED') {
    if (!requestedDate || !requestedTime) {
      throw Object.assign(new Error('Pick the new date and time for the visit.'), { statusCode: 400 })
    }
    assertFutureSlot(requestedDate, requestedTime)
  }

  // `ownerNote` renders on both clients labelled "Owner reply" / "Your reply",
  // and `scheduledAt` IS the owner's new time. Both are the owner's voice, and
  // the shared updateStatusSchema accepts them from whoever calls — so a
  // cancelling renter could put words in the owner's mouth on the owner's own
  // card, and move a slot while calling the visit off. A tenant writes only
  // their OWN fields: the slot they asked for, and their own note.
  const tenantData = status === 'RESCHEDULE_REQUESTED'
    ? {
      status,
      requestedDate: new Date(requestedDate),
      requestedTime,
      tenantNote,
      // The owner's confirmed time is no longer what is on the table. Leaving
      // it would render a card showing two different times, one of them dead.
      scheduledAt: null,
    }
    : { status }

  // The moment the owner answers — accepted, declined, or moved. Stamped ONCE:
  // `?? new Date()` keeps the first reply's time even if the owner edits the
  // note or the slot afterwards, because what is being measured is how long
  // the renter waited to hear anything, not when the row was last touched.
  // features/trust/responsiveness.js turns this into the owner's response rate.
  const respondedAt = appt.respondedAt ?? new Date()

  // An owner reschedule writes requestedDate/requestedTime TOO, because every
  // card on both platforms renders those fields as "the slot on the table" —
  // scheduledAt alone would leave the queue showing the old time while the
  // notification announces the new one. scheduledAt is COMPOSED server-side
  // from the same pair, so the two can never disagree.
  const ownerData = status === 'RESCHEDULED'
    ? {
      status,
      requestedDate: new Date(requestedDate),
      requestedTime,
      scheduledAt: istSlotInstant(requestedDate, requestedTime),
      ownerNote,
      respondedAt,
    }
    : { status, scheduledAt: scheduledAt ? new Date(scheduledAt) : undefined, ownerNote, respondedAt }

  const updated = await prisma.appointment.update({
    where: { id: appointmentId },
    data: tenantOnly ? tenantData : ownerData,
  })

  // A tenant cancelling or counter-offering has to reach the OWNER — the
  // notification further down is addressed to the tenant, which for these two
  // cases is the wrong person.
  if (tenantOnly) {
    const proposed = status === 'RESCHEDULE_REQUESTED'
      ? istSlotLabel(istSlotInstant(requestedDate, requestedTime))
      : null
    const title = proposed ? 'New time proposed' : 'Visit cancelled'
    const body = proposed
      ? `The renter asked to move their visit to “${appt.property?.title ?? 'your property'}” to ${proposed}.`
      : `The renter cancelled their visit to “${appt.property?.title ?? 'your property'}”.`

    await notifyUser(appt.ownerId, {
      type: 'APPOINTMENT_STATUS',
      title,
      body: tenantNote && proposed ? `${body}\n\n${tenantNote}` : body,
      referenceId: appt.id,
      referenceType: 'Appointment',
      // Same type as the owner's reschedule below, opposite hat — which is
      // exactly why audience can't be derived from `type`.
      audience: 'OWNER',
    })
    // The thread already carries the request, so it should carry whatever
    // happened to it — otherwise the owner reads an open request that no longer
    // reflects reality.
    try {
      const line = proposed
        ? `Visit — new time proposed by the renter\n${proposed}${tenantNote ? `\n\n${tenantNote}` : ''}`
        : 'Visit cancelled by the renter'
      const convo = await getOrCreateConversation(appt.tenantId, appt.propertyId)
      await sendMessage(convo.id, appt.tenantId, line)
    } catch { /* best-effort — chat must never fail the status change */ }
    return updated
  }

  // A reschedule IS the new time — saying only "rescheduled" tells the renter
  // that something changed and withholds the one fact that changed. Both the
  // notification and the chat line below carry the slot now.
  const newSlot = status === 'RESCHEDULED' && updated.scheduledAt ? istSlotLabel(updated.scheduledAt) : null

  // NOT APPOINTMENT_RESCHEDULED: both clients have an icon config for that name
  // (amber, RefreshCw) but it is not a value of the NotificationType enum in
  // schema.prisma, so emitting it would throw inside notifyUser — which is
  // awaited — and 500 the reschedule itself. Adding the enum value needs a
  // migration; until that runs in production, RESCHEDULED stays under
  // APPOINTMENT_STATUS, which renders fine.
  const notifType = status === 'ACCEPTED' ? 'APPOINTMENT_ACCEPTED' : status === 'REJECTED' ? 'APPOINTMENT_REJECTED' : 'APPOINTMENT_STATUS'
  const emailMeta = (status === 'ACCEPTED' || status === 'REJECTED')
    ? { propertyTitle: appt.property?.title ?? 'your requested property', ownerNote }
    : undefined

  const defaultBody = newSlot
    ? `The owner moved your visit to ${newSlot}.`
    : `Your appointment request has been ${status.toLowerCase()}.`

  await notifyUser(appt.tenantId, {
    type: notifType,
    title: `Appointment ${status.toLowerCase()}`,
    body: ownerNote ? (newSlot ? `${defaultBody}\n\n${ownerNote}` : ownerNote) : defaultBody,
    referenceId: appt.id,
    referenceType: 'Appointment',
    audience: 'TENANT',
    emailMeta,
  })

  // Accepting settles every other pending request the acceptance covers —
  // same-day visits, and for a stay every request overlapping its range.
  if (status === 'ACCEPTED') await rejectSupersededPending(updated)

  // Send status update to chat
  try {
    // No emoji. These lines render inside a normal message bubble, where a tick
    // or a cross is the one thing in the thread that looks like a system state
    // — and the same two glyphs already mean "sent" and "read" ten pixels away.
    let chatMsg = `Visit ${status.toLowerCase()}`
    if (newSlot) chatMsg += `\nNew time: ${newSlot}`
    if (ownerNote) chatMsg += `\n\n${ownerNote}`
    const convo = await getOrCreateConversation(appt.tenantId, appt.propertyId)
    await sendMessage(convo.id, appt.ownerId, chatMsg)
  } catch { /* best-effort */ }

  return updated
}
