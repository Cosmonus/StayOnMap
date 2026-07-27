import { prisma } from '../../lib/prisma.js'
import { notifyUser } from '../notifications/notifications.service.js'
import { getOrCreateConversation, sendMessage } from '../chat/chat.service.js'

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

export async function requestAppointment(tenantId, propertyId, data) {
  // A visit can't be requested for a time that has already happened. Nothing
  // checked this, so "Today · 9:00 AM" booked at 3pm was accepted and sent to
  // the owner as a real request — they get a notification about a slot that
  // passed six hours ago and no way to tell it from a genuine one.
  const slot = istSlotInstant(data.requestedDate, data.requestedTime)
  if (Number.isNaN(slot.getTime())) {
    throw Object.assign(new Error('That date and time could not be read'), { statusCode: 400 })
  }
  if (slot.getTime() <= Date.now()) {
    throw Object.assign(
      new Error('That time has already passed — pick a later slot.'),
      { statusCode: 400 },
    )
  }

  const property = await prisma.property.findUnique({ where: { id: propertyId }, select: { id: true, ownerId: true, status: true, riskScore: true } })
  if (!property) throw Object.assign(new Error('Property not found'), { statusCode: 404 })
  if (property.status !== 'ACTIVE') throw Object.assign(new Error('Property is not available'), { statusCode: 400 })
  if (property.ownerId === tenantId) throw Object.assign(new Error('Cannot book your own property'), { statusCode: 400 })
  if (property.riskScore?.level === 'HIGH' || property.riskScore?.level === 'SUSPICIOUS') {
    throw Object.assign(new Error('Bookings frozen for this property'), { statusCode: 403 })
  }
  const existing = await prisma.appointment.findFirst({ where: { tenantId, propertyId, status: 'PENDING' } })
  if (existing) throw Object.assign(new Error('You already have a pending request for this property'), { statusCode: 409 })

  const appt = await prisma.appointment.create({ data: { ...data, tenantId, propertyId, ownerId: property.ownerId, requestedDate: new Date(data.requestedDate) } })
  await notifyUser(property.ownerId, { type: 'APPOINTMENT_REQUEST', title: 'New Appointment Request', body: 'A tenant has requested to visit your property.', referenceId: appt.id, referenceType: 'Appointment', audience: 'OWNER' })

  // Auto-create chat conversation and send appointment summary
  try {
    const date = new Date(data.requestedDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
    const chatMsg = `📅 Appointment Request\nDate: ${date}\nTime: ${data.requestedTime}\nPhone: ${data.contactNumber}${data.message ? `\n\n${data.message}` : ''}`
    const convo = await getOrCreateConversation(tenantId, propertyId)
    await sendMessage(convo.id, tenantId, chatMsg)
  } catch { /* best-effort — don't fail the appointment if chat fails */ }

  return appt
}

export async function getTenantAppointments(tenantId) {
  return prisma.appointment.findMany({ where: { tenantId }, include: { property: { select: { id: true, displayId: true, title: true, city: true, images: { where: { isPrimary: true }, take: 1 } } } }, orderBy: { createdAt: 'desc' } })
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

export async function updateAppointmentStatus(appointmentId, userId, { status, scheduledAt, ownerNote }) {
  const appt = await prisma.appointment.findUnique({ where: { id: appointmentId }, include: { property: { select: { title: true } } } })
  if (!appt) throw Object.assign(new Error('Appointment not found'), { statusCode: 404 })

  const isOwner  = appt.ownerId === userId
  const isTenant = appt.tenantId === userId
  if (!isOwner && !isTenant) throw Object.assign(new Error('Access denied'), { statusCode: 403 })

  // This endpoint was owner-only, so the person who ASKED for the visit had no
  // way to call it off — CANCELLED was a valid status nothing could ever set,
  // and a renter who changed their mind could only message the owner and hope.
  // A tenant may cancel their own request; everything else stays the owner's.
  if (isTenant && !isOwner && status !== 'CANCELLED') {
    throw Object.assign(
      new Error('Only the owner can accept, reject or reschedule — you can cancel your request.'),
      { statusCode: 403 },
    )
  }

  if (SETTLED.has(appt.status)) {
    throw Object.assign(
      new Error(`This visit was already ${appt.status.toLowerCase()}.`),
      { statusCode: 409 },
    )
  }

  const updated = await prisma.appointment.update({ where: { id: appointmentId }, data: { status, scheduledAt: scheduledAt ? new Date(scheduledAt) : undefined, ownerNote } })

  // A tenant cancelling has to reach the OWNER — the notification below is
  // addressed to the tenant, which for this one case is the wrong person.
  if (isTenant && !isOwner) {
    await notifyUser(appt.ownerId, {
      type: 'APPOINTMENT_STATUS',
      title: 'Visit cancelled',
      body: `The renter cancelled their visit to “${appt.property?.title ?? 'your property'}”.`,
      referenceId: appt.id,
      referenceType: 'Appointment',
      // Same type as the reschedule below, opposite hat — which is exactly why
      // audience can't be derived from `type`.
      audience: 'OWNER',
    })
    // The thread already carries the request, so it should carry the withdrawal
    // — otherwise the owner reads an open request that no longer exists.
    try {
      const convo = await getOrCreateConversation(appt.tenantId, appt.propertyId)
      await sendMessage(convo.id, appt.tenantId, '📋 Visit cancelled by the renter')
    } catch { /* best-effort — chat must never fail the cancellation */ }
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

  // When accepting, auto-reject other pending appointments for the same property on the same date
  if (status === 'ACCEPTED') {
    const conflicting = await prisma.appointment.findMany({
      where: { propertyId: appt.propertyId, id: { not: appointmentId }, status: 'PENDING', requestedDate: appt.requestedDate },
      select: { id: true, tenantId: true },
    })
    if (conflicting.length > 0) {
      await prisma.appointment.updateMany({
        where: { id: { in: conflicting.map(c => c.id) } },
        data: { status: 'REJECTED', ownerNote: 'Another visit was scheduled for this date.' },
      })
      await Promise.all(conflicting.map(c =>
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
  }

  // Send status update to chat
  try {
    const emoji = status === 'ACCEPTED' ? '✅' : status === 'REJECTED' ? '❌' : status === 'RESCHEDULED' ? '🔄' : '📋'
    let chatMsg = `${emoji} Appointment ${status.toLowerCase()}`
    if (newSlot) chatMsg += `\nNew time: ${newSlot}`
    if (ownerNote) chatMsg += `\n\n${ownerNote}`
    const convo = await getOrCreateConversation(appt.tenantId, appt.propertyId)
    await sendMessage(convo.id, appt.ownerId, chatMsg)
  } catch { /* best-effort */ }

  return updated
}
