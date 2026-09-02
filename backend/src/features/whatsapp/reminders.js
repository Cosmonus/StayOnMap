// One reminder for a listing held on the owner's profile (AWAITING_PROFILE —
// see publish.service.js). Sent about 20 hours after the hold, deliberately
// INSIDE Meta's 24-hour customer-service window, which starts at the owner's
// last message: a plain text is free and always delivered there, and a
// template would be a second thing to get approved for one sentence.
//
// Exactly once: `draft.flags.heldReminderAt` is stamped, and the update goes
// through prisma directly rather than conversation.save() so lastMessageAt —
// the window's clock — is not moved by us.
//
// In-process interval, like the spatial refresher's fallback path. One VM,
// one process; if that ever changes, put the tick behind the same lock the
// refresher uses. A missed tick (deploy mid-interval) is caught by the next
// one as long as the row is still inside the window.
import { env } from '../../config/env.js'
import { prisma } from '../../lib/prisma.js'
import { sendText, whatsappConfigured } from './client.js'
import * as copy from './copy.js'
import { intelError, intelLog } from '../../lib/intelLog.js'

export const REMIND_AFTER_MS = 20 * 60 * 60 * 1000
export const WINDOW_MS = 24 * 60 * 60 * 1000
const TICK_MS = 30 * 60 * 1000

/** One pass. Returns how many reminders went out. Exported for tests. */
export async function runHeldReminderTick(now = Date.now()) {
  if (!whatsappConfigured() && env.nodeEnv !== 'development') return 0
  const rows = await prisma.whatsAppConversation.findMany({
    where: {
      status: 'AWAITING_PROFILE',
      lastMessageAt: { lt: new Date(now - REMIND_AFTER_MS), gt: new Date(now - WINDOW_MS) },
    },
    select: { id: true, phone: true, userId: true, draft: true },
    take: 100,
  })
  let sent = 0
  for (const conv of rows) {
    if (conv.draft?.flags?.heldReminderAt) continue
    try {
      const user = conv.userId ? await prisma.user.findUnique({ where: { id: conv.userId }, select: { email: true } }) : null
      const ok = await sendText(conv.phone, copy.heldReminder({ email: user?.email, loginUrl: env.frontendUrl }), { conversationId: conv.id })
      const draft = { ...(conv.draft ?? {}), flags: { ...(conv.draft?.flags ?? {}), heldReminderAt: new Date(now).toISOString() } }
      await prisma.whatsAppConversation.update({ where: { id: conv.id }, data: { draft } })
      if (ok) sent++
      intelLog('whatsapp.held_reminder', { conversationId: conv.id, delivered: !!ok })
    } catch (err) {
      intelError('whatsapp.held_reminder_failed', err, { conversationId: conv.id })
    }
  }
  return sent
}

let timer = null
export function startHeldReminders() {
  if (timer) return
  timer = setInterval(() => { runHeldReminderTick().catch(() => {}) }, TICK_MS)
  timer.unref?.()
}
export function stopHeldReminders() {
  if (timer) clearInterval(timer)
  timer = null
}
