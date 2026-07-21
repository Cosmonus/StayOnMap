import { prisma } from '../../lib/prisma.js'
import { emitToUser } from '../../lib/socket.js'
import {
  sendEmail,
  appointmentAcceptedEmail,
  appointmentRejectedEmail,
  verificationUpdateEmail,
} from '../../services/email.service.js'
import { sendPushToUser } from '../../services/push.service.js'
import { sendExpoPushToUser } from '../../services/expoPush.service.js'

const EMAIL_TYPES = new Set(['APPOINTMENT_ACCEPTED', 'APPOINTMENT_REJECTED', 'VERIFICATION_UPDATE'])
const PUSH_TYPES  = new Set(['APPOINTMENT_ACCEPTED', 'APPOINTMENT_REJECTED', 'LEASE_OFFERED', 'LEASE_SIGNED', 'LEASE_REJECTED', 'MESSAGE'])

export async function notifyUser(userId, { type, title, body, referenceId, referenceType, emailMeta }) {
  const notification = await prisma.notification.create({ data: { userId, type, title, body, referenceId, referenceType } })
  emitToUser(userId, 'notification:new', notification)

  // Delivery (push + email) is fire-and-forget — the caller's request must
  // never wait on the mailer (same pattern as chat.service.js's sendMessage).
  // Only the DB notification row above is awaited.
  if (PUSH_TYPES.has(type)) {
    sendPushToUser(userId, { title, body, url: '/user?tab=notifications' }).catch(() => {})
    sendExpoPushToUser(userId, { title, body, data: { referenceId, referenceType } }).catch(() => {})
  }

  if (EMAIL_TYPES.has(type) && emailMeta) {
    deliverEmail(userId, type, emailMeta).catch(() => {})
  }

  return notification
}

async function deliverEmail(userId, type, emailMeta) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true, name: true } })
  if (!user?.email) return
  let emailContent
  if (type === 'APPOINTMENT_ACCEPTED') {
    emailContent = appointmentAcceptedEmail({ tenantName: user.name ?? 'there', ...emailMeta })
  } else if (type === 'APPOINTMENT_REJECTED') {
    emailContent = appointmentRejectedEmail({ tenantName: user.name ?? 'there', ...emailMeta })
  } else if (type === 'VERIFICATION_UPDATE') {
    emailContent = verificationUpdateEmail({ ownerName: user.name ?? 'there', ...emailMeta })
  }
  if (emailContent) {
    await sendEmail({ to: user.email, ...emailContent })
  }
}

export async function getUserNotifications(userId) {
  return prisma.notification.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, take: 50 })
}

export async function markRead(notificationId, userId) {
  const notif = await prisma.notification.findUnique({ where: { id: notificationId } })
  if (!notif || notif.userId !== userId) throw Object.assign(new Error('Not found'), { statusCode: 404 })
  return prisma.notification.update({ where: { id: notificationId }, data: { isRead: true } })
}

export async function markAllRead(userId, type) {
  const where = { userId, isRead: false }
  if (type) where.type = type
  await prisma.notification.updateMany({ where, data: { isRead: true } })
}
