import { prisma } from '../../lib/prisma.js'

/**
 * The audit timeline.
 *
 * One function, because an event written two different ways is an event that
 * can be written wrong one of them. Every state change in the support layer
 * goes through here.
 *
 * The actor is an ARGUMENT, never read from a request inside this module. A
 * helper that reached for `req` would be one that could attribute an action to
 * whoever happened to be logged in when a background job ran.
 */

/**
 * @param {object} args
 * @param {string} args.caseId
 * @param {string} args.type       SupportEventType
 * @param {object} args.actor      { role, userId?, adminId? }
 * @param {object} [args.meta]     what changed, as DATA — never a sentence
 * @param {object} [args.tx]       a Prisma transaction client, when the event
 *                                 must land atomically with the change it
 *                                 describes
 */
export async function recordEvent({ caseId, type, actor, meta = null, tx = prisma }) {
  return tx.supportEvent.create({
    data: {
      caseId,
      type,
      actorRole: actor?.role ?? 'SYSTEM',
      actorUserId: actor?.userId ?? null,
      actorAdminId: actor?.adminId ?? null,
      meta,
    },
  })
}

/**
 * The timeline for one case, oldest first.
 *
 * ADMIN-ONLY by design, and there is deliberately no user-facing variant. The
 * timeline records assignment, triage, internal notes and escalation — a
 * complete picture of how we handled somebody, including decisions they were
 * never told about. A user gets the MESSAGES, which is the part addressed to
 * them; exposing the events would leak the internal half of every case through
 * a door nobody thought of as a message.
 */
export function listEvents(caseId) {
  return prisma.supportEvent.findMany({
    where: { caseId },
    orderBy: { createdAt: 'asc' },
    select: {
      id: true, type: true, actorRole: true, meta: true, createdAt: true,
      actorAdmin: { select: { id: true, name: true } },
      actorUser: { select: { id: true, name: true } },
    },
  })
}
