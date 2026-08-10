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
// Support cases push on a REPLY and on a RESOLUTION — the two moments somebody
// is actually waiting for — and deliberately not on SUPPORT_CASE_UPDATE, which
// covers assignment and triage. A push saying "your case was assigned to an
// agent" is a notification about our internal process, not about them.
const PUSH_TYPES  = new Set(['APPOINTMENT_ACCEPTED', 'APPOINTMENT_REJECTED', 'LEASE_OFFERED', 'LEASE_SIGNED', 'LEASE_REJECTED', 'MESSAGE', 'SUPPORT_CASE_MESSAGE', 'SUPPORT_CASE_RESOLVED'])

// `audience` says which hat the recipient is wearing — TENANT or OWNER. Every
// caller passes it explicitly; it cannot be derived from `type` (see the
// Notification.audience comment in schema.prisma). Omitting it is allowed and
// means "unclassified", which shows in both modes — a fallback for safety, not
// a default to lean on: a new notification that skips it lands in both inboxes.
export async function notifyUser(userId, { type, title, body, referenceId, referenceType, audience, emailMeta }) {
  const notification = await prisma.notification.create({ data: { userId, type, title, body, referenceId, referenceType, audience } })
  emitToUser(userId, 'notification:new', notification)

  // Delivery (push + email) is fire-and-forget — the caller's request must
  // never wait on the mailer (same pattern as chat.service.js's sendMessage).
  // Only the DB notification row above is awaited.
  // The audience rides along. A push is delivered to the device, not to a mode
  // — so without it, tapping an owner notification while the app sits in renter
  // mode lands on the renter's list, which by design does not contain it. Both
  // clients switch to the notification's own hat before they navigate.
  if (PUSH_TYPES.has(type)) {
    const mode = audience === 'OWNER' ? 'host' : audience === 'TENANT' ? 'tenant' : null
    sendPushToUser(userId, {
      title,
      body,
      url: `/user?tab=notifications${mode ? `&mode=${mode}` : ''}`,
    }).catch(() => {})
    sendExpoPushToUser(userId, { title, body, data: { referenceId, referenceType, audience } }).catch(() => {})
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

// An unclassified row (audience NULL — written before the column existed)
// belongs to neither hat and is therefore shown to both. Filtering it out of
// both would make it unreachable.
function audienceFilter(audience) {
  if (audience !== 'TENANT' && audience !== 'OWNER') return {}
  return { OR: [{ audience }, { audience: null }] }
}

// No `audience` → every notification, which is what released mobile builds
// (and the "all" view) ask for. The filter is opt-in so an older client can
// never end up with a silently narrowed list.
export async function getUserNotifications(userId, audience) {
  return prisma.notification.findMany({
    where: { userId, ...audienceFilter(audience) },
    orderBy: { createdAt: 'desc' },
    take: 50,
  })
}

// Unread per hat, so a mode can say what is waiting in the OTHER one. Without
// this the split hides things: a visit request for your flat is invisible from
// renter mode, and nothing on screen suggests switching. Unclassified rows
// (audience null) count toward both, matching where they're shown.
export async function getUnreadCounts(userId) {
  const unread = { userId, isRead: false }
  const [asTenant, asOwner] = await Promise.all([
    prisma.notification.count({ where: { ...unread, ...audienceFilter('TENANT') } }),
    prisma.notification.count({ where: { ...unread, ...audienceFilter('OWNER') } }),
  ])
  return { asTenant, asOwner }
}

export async function markRead(notificationId, userId) {
  const notif = await prisma.notification.findUnique({ where: { id: notificationId } })
  if (!notif || notif.userId !== userId) throw Object.assign(new Error('Not found'), { statusCode: 404 })
  return prisma.notification.update({ where: { id: notificationId }, data: { isRead: true } })
}

// Scoped by audience for the same reason the list is: "Mark all as read" in the
// host inbox must not silently clear the renter's unread ones, which the reader
// cannot even see from there.
export async function markAllRead(userId, type, audience) {
  const where = { userId, isRead: false, ...audienceFilter(audience) }
  if (type) where.type = type
  await prisma.notification.updateMany({ where, data: { isRead: true } })
}

// A MESSAGE notification is a stand-in for the message itself, so reading the
// thread has to retire it. Without this the bell went on announcing a
// conversation the reader had already finished, and the only cure was clearing
// it by hand — "1 new message" pointing at a thread with nothing new in it is
// the small lie that teaches people to ignore the badge entirely.
//
// Scoped to ONE conversation on purpose: markAllRead(type) above is the
// blunter action, and the two are not interchangeable.
export async function markMessageNotificationsRead(userId, conversationId) {
  const { count } = await prisma.notification.updateMany({
    where: {
      userId,
      type: 'MESSAGE',
      referenceType: 'Conversation',
      referenceId: conversationId,
      isRead: false,
    },
    data: { isRead: true },
  })
  return count
}
