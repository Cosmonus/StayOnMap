import { prisma } from '../../lib/prisma.js'
import { notifyUser } from '../notifications/notifications.service.js'
import { getOrCreateConversation, sendMessage } from '../chat/chat.service.js'

export async function requestAppointment(tenantId, propertyId, data) {
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
  await notifyUser(property.ownerId, { type: 'APPOINTMENT_REQUEST', title: 'New Appointment Request', body: 'A tenant has requested to visit your property.', referenceId: appt.id, referenceType: 'Appointment' })

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

export async function updateAppointmentStatus(appointmentId, ownerId, { status, scheduledAt, ownerNote }) {
  const appt = await prisma.appointment.findUnique({ where: { id: appointmentId }, include: { property: { select: { title: true } } } })
  if (!appt) throw Object.assign(new Error('Appointment not found'), { statusCode: 404 })
  if (appt.ownerId !== ownerId) throw Object.assign(new Error('Access denied'), { statusCode: 403 })
  const updated = await prisma.appointment.update({ where: { id: appointmentId }, data: { status, scheduledAt: scheduledAt ? new Date(scheduledAt) : undefined, ownerNote } })

  const notifType = status === 'ACCEPTED' ? 'APPOINTMENT_ACCEPTED' : status === 'REJECTED' ? 'APPOINTMENT_REJECTED' : 'APPOINTMENT_STATUS'
  const emailMeta = (status === 'ACCEPTED' || status === 'REJECTED')
    ? { propertyTitle: appt.property?.title ?? 'your requested property', ownerNote }
    : undefined

  await notifyUser(appt.tenantId, { type: notifType, title: `Appointment ${status.toLowerCase()}`, body: ownerNote ?? `Your appointment request has been ${status.toLowerCase()}.`, referenceId: appt.id, referenceType: 'Appointment', emailMeta })

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
        }).catch(() => {})
      ))
    }
  }

  // Send status update to chat
  try {
    const emoji = status === 'ACCEPTED' ? '✅' : status === 'REJECTED' ? '❌' : '📋'
    let chatMsg = `${emoji} Appointment ${status.toLowerCase()}`
    if (ownerNote) chatMsg += `\n\n${ownerNote}`
    const convo = await getOrCreateConversation(appt.tenantId, appt.propertyId)
    await sendMessage(convo.id, ownerId, chatMsg)
  } catch { /* best-effort */ }

  return updated
}
