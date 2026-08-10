import { prisma } from '../../lib/prisma.js'
import { notifyUser } from '../notifications/notifications.service.js'
import { recordEvent, listEvents } from './supportEvent.service.js'
import { caseRef, parseCaseRef } from './caseRef.js'
import { ROLE, VISIBILITY, visibleTo, isStaff, allowedVisibilities, partyRole } from './visibility.js'
import { STATUS, assertTransition, transitionStamps, statusAfterReply } from './lifecycle.js'

/**
 * Support cases — the one workflow behind every kind of human intervention.
 *
 * Two rules run through everything here:
 *
 *   1. AUTHORISATION IS A QUERY, NOT A CHECK. Every user-facing read scopes by
 *      the caller's id in the `where`, so there is no path where a permission
 *      check can be forgotten — and a case that is not yours answers 404 rather
 *      than 403, or the id becomes a way to enumerate other people's cases.
 *   2. VISIBILITY IS FILTERED SERVER-SIDE, ALWAYS. `visibility.js` decides;
 *      this file applies it before anything leaves. No route filters, and no
 *      client is trusted to hide a row it was sent.
 */

// What a party is allowed to see of a case itself. Note the absence of
// `assignedTo` and of events: who is handling a case and how it was triaged is
// our internal process, not theirs.
const USER_CASE_SELECT = {
  id: true, number: true, type: true, status: true, subject: true,
  description: true, createdAt: true, updatedAt: true, resolvedAt: true, closedAt: true,
  relatedProperty: { select: { id: true, title: true, city: true } },
}

const MESSAGE_SELECT = {
  id: true, authorRole: true, body: true, visibility: true, createdAt: true,
  authorUser: { select: { id: true, name: true } },
  attachments: { select: { id: true, url: true, fileName: true, mimeType: true, visibility: true } },
}

const notFound = () => Object.assign(new Error('Case not found'), { statusCode: 404 })

/** The owner of a case's related property, or null. Needed to resolve the hat. */
async function relatedOwnerId(supportCase) {
  if (!supportCase.relatedPropertyId) return null
  const property = await prisma.property.findUnique({
    where: { id: supportCase.relatedPropertyId },
    select: { ownerId: true },
  })
  return property?.ownerId ?? null
}

// ── Creating ───────────────────────────────────────────────────────────────

/**
 * Open a case.
 *
 * `openedAs` is passed in rather than derived from User.role, for the reason
 * visibility.js's partyRole exists: an owner reporting somebody else's listing
 * is acting as a renter, and the hat decides which support centre shows it and
 * which messages they can read.
 *
 * Priority is NOT a caller input. A field where anybody can mark their own
 * request URGENT is a field that is URGENT on every request within a week —
 * staff set it, and `severity` on a property report maps to at most HIGH for
 * the same reason (it is client-supplied there too).
 */
export async function createCase({
  type, subject, description, createdById, openedAs = ROLE.TENANT,
  relatedPropertyId = null, relatedAppointmentId = null,
  relatedConversationId = null, relatedLeaseId = null, relatedUserId = null,
  priority,
}, { tx = prisma, actor } = {}) {
  const supportCase = await tx.supportCase.create({
    data: {
      type, subject, description, createdById, openedAs,
      relatedPropertyId, relatedAppointmentId, relatedConversationId,
      relatedLeaseId, relatedUserId,
      ...(priority ? { priority } : {}),
    },
  })

  await recordEvent({
    caseId: supportCase.id,
    type: 'CASE_CREATED',
    actor: actor ?? { role: openedAs, userId: createdById },
    meta: { type, ...(relatedPropertyId ? { propertyId: relatedPropertyId } : {}) },
    tx,
  })

  return supportCase
}

// ── Reading, as a user ─────────────────────────────────────────────────────

/**
 * Every case this user is a party to, newest first.
 *
 * Two sources, because being a party is two different facts: cases they OPENED,
 * and cases opened against a property they own. The second is what makes an
 * owner's support centre show the reports filed about their listings without
 * giving them any case they merely appear in.
 */
export async function listCasesForUser(userId, { hat = ROLE.TENANT } = {}) {
  const where = hat === ROLE.OWNER
    // As an owner: their own owner-hat cases, plus anything about their
    // listings. `relatedProperty.ownerId` rather than a denormalised column —
    // one join, and it cannot go stale when a listing changes hands.
    ? {
      OR: [
        { createdById: userId, openedAs: ROLE.OWNER },
        { relatedProperty: { ownerId: userId } },
      ],
    }
    // As a renter: only what they opened wearing that hat. A case about a
    // property they happen to own is not their renter business.
    : { createdById: userId, openedAs: ROLE.TENANT }

  return prisma.supportCase.findMany({
    where,
    orderBy: { updatedAt: 'desc' },
    take: 100,
    select: {
      ...USER_CASE_SELECT,
      // The unread marker: staff messages this side has not seen. Counted, not
      // listed, because the list page does not render message bodies.
      _count: {
        select: {
          messages: {
            where: {
              readByUserAt: null,
              authorRole: { in: [ROLE.ADMIN, ROLE.SUPPORT_AGENT] },
              visibility: hat === ROLE.OWNER
                ? { in: [VISIBILITY.PUBLIC, VISIBILITY.OWNER_ONLY] }
                : { in: [VISIBILITY.PUBLIC, VISIBILITY.TENANT_ONLY] },
            },
          },
        },
      },
    },
  })
}

/**
 * One case, with the messages this viewer may read.
 *
 * Loads by id, resolves the viewer's hat, and 404s if they hold none — the
 * ownership test cannot be skipped because the answer to "which hat" IS the
 * authorisation.
 */
export async function getCaseForUser(caseId, userId) {
  const found = await prisma.supportCase.findUnique({
    where: { id: caseId },
    select: {
      ...USER_CASE_SELECT,
      createdById: true, openedAs: true, relatedUserId: true, relatedPropertyId: true,
      messages: { orderBy: { createdAt: 'asc' }, select: MESSAGE_SELECT },
      attachments: { select: { id: true, url: true, fileName: true, mimeType: true, visibility: true, messageId: true } },
    },
  })
  if (!found) throw notFound()

  const role = partyRole(found, userId, await relatedOwnerId(found))
  if (!role) throw notFound()

  const viewer = { role, userId }

  // Reading IS reading. Only what this side can actually see is marked — a
  // message they were never shown must not count as read, or the admin panel
  // would report that somebody had seen an answer they never received.
  await prisma.supportMessage.updateMany({
    where: {
      caseId,
      readByUserAt: null,
      authorRole: { in: [ROLE.ADMIN, ROLE.SUPPORT_AGENT, ROLE.SYSTEM] },
      visibility: { in: role === ROLE.OWNER
        ? [VISIBILITY.PUBLIC, VISIBILITY.OWNER_ONLY]
        : [VISIBILITY.PUBLIC, VISIBILITY.TENANT_ONLY] },
    },
    data: { readByUserAt: new Date() },
  })

  // Strip the fields that exist only to resolve the hat, so a party never
  // receives `createdById`/`relatedUserId` — on a report, those ARE the
  // reporter's identity.
  // Destructured to DROP, not to use — hence the underscores. On a report,
  // createdById and relatedUserId ARE the reporter and owner identities.
  const {
    createdById: _createdById, openedAs: _openedAs,
    relatedUserId: _relatedUserId, relatedPropertyId: _relatedPropertyId,
    messages, attachments, ...safe
  } = found

  return {
    ...safe,
    viewerRole: role,
    messages: visibleTo(viewer, messages).map((m) => ({
      ...m,
      attachments: visibleTo(viewer, m.attachments),
      // A party sees WHO only when it is themselves. Staff are "StayOnMap":
      // which individual handled a case is not something a user needs, and is
      // something a determined person could act on.
      authorUser: m.authorUser?.id === userId ? m.authorUser : null,
    })),
    attachments: visibleTo(viewer, attachments),
  }
}

// ── Messages ───────────────────────────────────────────────────────────────

/**
 * Post a message as a party or as staff.
 *
 * `visibility` is only honoured for staff — `allowedVisibilities` returns a
 * single value for a user, and this clamps to it rather than trusting the
 * argument. A tenant who could choose PUBLIC could publish their own identity
 * into a case the owner reads.
 */
export async function addMessage(caseId, actor, body, requestedVisibility, { notify = true } = {}) {
  const found = await prisma.supportCase.findUnique({
    where: { id: caseId },
    select: {
      id: true, status: true, createdById: true, openedAs: true,
      relatedUserId: true, relatedPropertyId: true, firstResponseAt: true, number: true, subject: true,
    },
  })
  if (!found) throw notFound()

  let role = actor.role
  if (!isStaff(role)) {
    role = partyRole(found, actor.userId, await relatedOwnerId(found))
    if (!role) throw notFound()
  }

  if (found.status === STATUS.CLOSED) {
    throw Object.assign(
      new Error('This case is closed. Open a new one and we will pick it up from there.'),
      { statusCode: 400, expose: true },
    )
  }

  const allowed = allowedVisibilities(role)
  const visibility = allowed.includes(requestedVisibility) ? requestedVisibility : allowed[0]

  const message = await prisma.$transaction(async (tx) => {
    const created = await tx.supportMessage.create({
      data: {
        caseId,
        authorRole: role,
        authorUserId: isStaff(role) ? null : actor.userId,
        authorAdminId: isStaff(role) ? actor.adminId : null,
        visibility,
        body,
      },
      select: MESSAGE_SELECT,
    })

    await recordEvent({
      caseId,
      // An internal note is not a message to anybody — separating it in the
      // timeline is what lets an auditor tell "we replied" from "we wrote
      // something down about them".
      type: visibility === VISIBILITY.INTERNAL ? 'INTERNAL_NOTE_ADDED' : 'MESSAGE_SENT',
      actor: { role, userId: actor.userId, adminId: actor.adminId },
      meta: { visibility },
      tx,
    })

    // First staff reply that the USER can actually see. An internal note is
    // not a response to anybody, so it must not stop the clock — that is the
    // single easiest way to make a first-response metric flattering and wrong.
    const isVisibleStaffReply = isStaff(role) && visibility !== VISIBILITY.INTERNAL
    const nextStatus = statusAfterReply(found.status, role)

    if ((isVisibleStaffReply && !found.firstResponseAt) || nextStatus) {
      await tx.supportCase.update({
        where: { id: caseId },
        data: {
          ...(isVisibleStaffReply && !found.firstResponseAt ? { firstResponseAt: new Date() } : {}),
          ...(nextStatus ? { status: nextStatus, ...transitionStamps(nextStatus, found) } : {}),
        },
      })
      if (nextStatus) {
        await recordEvent({
          caseId, type: 'STATUS_CHANGED',
          actor: { role: ROLE.SYSTEM },
          meta: { from: found.status, to: nextStatus, reason: 'reply' },
          tx,
        })
      }
    }

    return created
  })

  // Notify the other side, outside the transaction — a notification failure
  // must never roll back the message it is about.
  //
  // `notify: false` exists for exactly one caller: the property-report adapter,
  // which sends its OWN notification carrying referenceType 'PropertyReport'.
  // Released clients map that type to the report thread; a SupportCase
  // reference would deep-link them nowhere. The generic notification is
  // suppressed rather than sent alongside, because two notifications for one
  // reply is worse than the wrong one.
  if (notify && visibility !== VISIBILITY.INTERNAL) {
    await notifyCounterparty(found, role, visibility).catch(() => {})
  }

  return message
}

/**
 * Tell whoever is NOT the author that something arrived.
 *
 * The body is never carried into the notification: a lock-screen preview must
 * not show support text, and the message should be read where it is marked
 * read. Staff have no notification stream at all — they work from the queue —
 * so a user's message notifies nobody, which is why the admin inbox has an
 * unread count.
 */
async function notifyCounterparty(supportCase, authorRole, visibility) {
  if (!isStaff(authorRole)) return

  const recipients = []
  if (visibility === VISIBILITY.PUBLIC || visibility === VISIBILITY.TENANT_ONLY) {
    if (supportCase.createdById) recipients.push({ userId: supportCase.createdById, audience: 'TENANT' })
  }
  if (visibility === VISIBILITY.PUBLIC || visibility === VISIBILITY.OWNER_ONLY) {
    const ownerId = await relatedOwnerId(supportCase)
    // Never twice: on a case an owner opened themselves, they are both the
    // creator and the property owner.
    if (ownerId && ownerId !== supportCase.createdById) recipients.push({ userId: ownerId, audience: 'OWNER' })
  }

  await Promise.all(recipients.map(({ userId, audience }) => notifyUser(userId, {
    type: 'SUPPORT_CASE_MESSAGE',
    title: 'StayOnMap support replied',
    body: `${caseRef(supportCase.number)} · ${supportCase.subject}`,
    referenceId: supportCase.id,
    referenceType: 'SupportCase',
    audience,
  })))
}

// ── Staff actions ──────────────────────────────────────────────────────────

/** Move a case, through the lifecycle rules and never around them. */
export async function changeStatus(caseId, to, actor, { reason } = {}) {
  const found = await prisma.supportCase.findUnique({
    where: { id: caseId },
    select: { id: true, status: true, number: true, subject: true, createdById: true, resolvedAt: true, relatedPropertyId: true },
  })
  if (!found) throw notFound()

  assertTransition(found.status, to)

  const updated = await prisma.$transaction(async (tx) => {
    const next = await tx.supportCase.update({
      where: { id: caseId },
      data: { status: to, ...transitionStamps(to, found) },
    })
    await recordEvent({
      caseId,
      type: to === STATUS.RESOLVED ? 'CASE_RESOLVED'
        : to === STATUS.CLOSED ? 'CASE_CLOSED'
          : to === STATUS.ESCALATED ? 'CASE_ESCALATED'
            : 'STATUS_CHANGED',
      actor,
      meta: { from: found.status, to, ...(reason ? { reason } : {}) },
      tx,
    })
    return next
  })

  // Only the outcomes somebody is waiting for. "Triaged" is our process.
  if ((to === STATUS.RESOLVED || to === STATUS.CLOSED) && found.createdById) {
    await notifyUser(found.createdById, {
      type: 'SUPPORT_CASE_RESOLVED',
      title: to === STATUS.RESOLVED ? 'Your support request was resolved' : 'Your support request was closed',
      body: `${caseRef(found.number)} · ${found.subject}`,
      referenceId: caseId,
      referenceType: 'SupportCase',
      audience: 'TENANT',
    }).catch(() => {})
  }

  return updated
}

export async function setPriority(caseId, priority, actor) {
  const found = await prisma.supportCase.findUnique({ where: { id: caseId }, select: { id: true, priority: true } })
  if (!found) throw notFound()
  if (found.priority === priority) return found

  return prisma.$transaction(async (tx) => {
    const next = await tx.supportCase.update({ where: { id: caseId }, data: { priority } })
    await recordEvent({ caseId, type: 'PRIORITY_CHANGED', actor, meta: { from: found.priority, to: priority }, tx })
    return next
  })
}

export async function assignCase(caseId, assignedToId, actor) {
  const found = await prisma.supportCase.findUnique({ where: { id: caseId }, select: { id: true, assignedToId: true } })
  if (!found) throw notFound()

  return prisma.$transaction(async (tx) => {
    const next = await tx.supportCase.update({ where: { id: caseId }, data: { assignedToId } })
    await recordEvent({
      caseId,
      // Reassignment is a different fact from assignment — one is picking up
      // work, the other is handing it over, and a queue report cares which.
      type: found.assignedToId ? 'CASE_REASSIGNED' : 'CASE_ASSIGNED',
      actor,
      meta: { from: found.assignedToId, to: assignedToId },
      tx,
    })
    return next
  })
}

/**
 * Escalate explicitly, rather than "just set the status".
 *
 * The spec asks for this and it is right: an escalation carries a REASON, and a
 * status change that silently means "somebody senior should look" loses the one
 * piece of information the senior person needs. Recorded as its own event type
 * so escalation rate is countable.
 */
export async function escalateCase(caseId, actor, reason) {
  const updated = await changeStatus(caseId, STATUS.ESCALATED, actor, { reason })
  return updated
}

// ── Reading, as staff ──────────────────────────────────────────────────────

/**
 * The support inbox.
 *
 * No visibility filtering, because staff see everything — that is what makes
 * moderation possible. What IS filtered is the page size, which is capped
 * rather than trusted: an admin session with `?limit=100000` reaching a table
 * that grows with every support request is a way to make the panel slow from
 * the address bar, the same rule the marketplace readouts already follow.
 */
export async function adminListCases({
  status, type, priority, assignedToId, unassigned, city, search,
  page = 1, limit = 25,
} = {}) {
  const take = Math.min(100, Math.max(1, Number(limit) || 25))
  const skip = (Math.max(1, Number(page) || 1) - 1) * take

  const where = {
    ...(status ? { status } : {}),
    ...(type ? { type } : {}),
    ...(priority ? { priority } : {}),
    // `unassigned` is its own flag rather than assignedToId=null, because a
    // query string cannot express null and "the ones nobody has picked up" is
    // the single most useful filter on this screen.
    ...(unassigned ? { assignedToId: null } : assignedToId ? { assignedToId } : {}),
    ...(city ? { relatedProperty: { city } } : {}),
    ...(search ? searchClause(search) : {}),
  }

  const [rows, total] = await Promise.all([
    prisma.supportCase.findMany({
      where,
      // Urgent first, then oldest — a queue sorted newest-first buries the case
      // that has been waiting longest, which is the one that most needs
      // answering.
      orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }],
      skip,
      take,
      select: {
        id: true, number: true, type: true, status: true, priority: true,
        subject: true, createdAt: true, updatedAt: true, firstResponseAt: true,
        createdBy: { select: { id: true, name: true, email: true } },
        assignedTo: { select: { id: true, name: true } },
        relatedProperty: { select: { id: true, title: true, city: true } },
        report: { select: { id: true, category: true, severity: true } },
        _count: {
          select: {
            // Unread from the USER side — what is waiting on staff. Staff have
            // no notification stream, so this count is the whole signal.
            messages: { where: { readByAdminAt: null, authorRole: { in: [ROLE.TENANT, ROLE.OWNER] } } },
          },
        },
      },
    }),
    prisma.supportCase.count({ where }),
  ])

  return { cases: rows, total, page: Math.max(1, Number(page) || 1), limit: take }
}

/**
 * Search across the things a person actually quotes at you.
 *
 * "SC-1042" first, because a case reference is exact and everything else is a
 * guess — resolving it to a number means an admin pasting a reference out of an
 * email gets one row rather than a text match. Falls through to subject, the
 * requester and the listing.
 *
 * Deliberately NOT a search over message bodies: those include internal notes
 * and the reporter's private words, and a search box is the wrong place to
 * decide visibility.
 */
function searchClause(raw) {
  const term = String(raw).trim()
  const number = parseCaseRef(term)
  if (number) return { number }

  return {
    OR: [
      { subject: { contains: term, mode: 'insensitive' } },
      { createdBy: { OR: [
        { name: { contains: term, mode: 'insensitive' } },
        { email: { contains: term, mode: 'insensitive' } },
      ] } },
      { relatedProperty: { title: { contains: term, mode: 'insensitive' } } },
    ],
  }
}

/**
 * One case, in full, for a moderator.
 *
 * Everything: internal notes, the timeline, both sides of the conversation,
 * every attachment. This is the page the spec asks to make sufficient on its
 * own — "the admin should never need to navigate across five pages to
 * understand a case" — so it loads the related property, the requester and the
 * report in one call rather than making the client stitch them.
 */
export async function adminGetCase(caseId) {
  const found = await prisma.supportCase.findUnique({
    where: { id: caseId },
    select: {
      id: true, number: true, type: true, status: true, priority: true,
      subject: true, description: true, openedAs: true,
      createdAt: true, updatedAt: true, firstResponseAt: true, resolvedAt: true, closedAt: true,
      createdBy: { select: { id: true, name: true, email: true, phone: true, createdAt: true } },
      assignedTo: { select: { id: true, name: true } },
      relatedUser: { select: { id: true, name: true, email: true } },
      relatedProperty: { select: { id: true, title: true, city: true, status: true, ownerId: true } },
      relatedAppointment: { select: { id: true, status: true, requestedDate: true } },
      relatedConversation: { select: { id: true } },
      relatedLease: { select: { id: true, status: true } },
      report: {
        select: {
          id: true, category: true, severity: true, status: true,
          description: true, evidenceUrls: true, isAnonymous: true, ownerResponse: true,
        },
      },
      messages: {
        orderBy: { createdAt: 'asc' },
        select: {
          id: true, authorRole: true, body: true, visibility: true, createdAt: true,
          authorUser: { select: { id: true, name: true } },
          authorAdmin: { select: { id: true, name: true } },
          attachments: { select: { id: true, url: true, fileName: true, mimeType: true, visibility: true } },
        },
      },
      attachments: {
        orderBy: { createdAt: 'asc' },
        select: { id: true, url: true, fileName: true, mimeType: true, sizeBytes: true, visibility: true, messageId: true, createdAt: true },
      },
    },
  })
  if (!found) throw notFound()

  // Reading a case IS reading its user messages — the queue's "waiting on us"
  // count is driven by readByAdminAt, and a moderator who has the case open is
  // exactly who it was waiting for.
  await prisma.supportMessage.updateMany({
    where: { caseId, readByAdminAt: null, authorRole: { in: [ROLE.TENANT, ROLE.OWNER] } },
    data: { readByAdminAt: new Date() },
  })

  return { ...found, events: await listEvents(caseId) }
}

/**
 * The queue counters.
 *
 * One grouped query rather than six counts. Every number the dashboard shows —
 * Open, Urgent, Unassigned, Waiting, Escalated, Resolved — is derived from the
 * same snapshot, so they cannot disagree with each other the way six separate
 * round trips can when a case moves between them.
 */
export async function adminCaseCounts() {
  const [byStatus, urgent, unassigned] = await Promise.all([
    prisma.supportCase.groupBy({ by: ['status'], _count: { _all: true } }),
    prisma.supportCase.count({ where: { priority: 'URGENT', status: { notIn: [STATUS.RESOLVED, STATUS.CLOSED] } } }),
    prisma.supportCase.count({ where: { assignedToId: null, status: { notIn: [STATUS.RESOLVED, STATUS.CLOSED] } } }),
  ])

  const count = (s) => byStatus.find((r) => r.status === s)?._count?._all ?? 0

  return {
    open: count(STATUS.OPEN),
    triaged: count(STATUS.TRIAGED),
    inProgress: count(STATUS.IN_PROGRESS),
    // The two WAITING states are one number on the dashboard: to whoever is
    // triaging, "waiting on somebody else" is a single bucket to skip past.
    waiting: count(STATUS.WAITING_FOR_USER) + count(STATUS.WAITING_FOR_OWNER),
    escalated: count(STATUS.ESCALATED),
    resolved: count(STATUS.RESOLVED),
    closed: count(STATUS.CLOSED),
    urgent,
    unassigned,
  }
}

/**
 * Open a case as a user, with every reference verified.
 *
 * THE REFERENCES ARE THE ATTACK SURFACE. "Related appointment" arrives as an id
 * in a request body, and an unchecked one would let anybody attach a stranger's
 * appointment — or a stranger's private conversation — to a case they then read
 * the admin's replies on. So each is confirmed to belong to the caller before
 * it is stored, and a reference that does not is DROPPED rather than rejected:
 * the support request itself is still valid and a person asking for help should
 * not be met with a validation error about plumbing they never saw.
 *
 * A property is the exception and is kept unverified on purpose — anybody may
 * ask about any listing ("this one looks fake", "is this address real"), and
 * requiring a relationship would make the most common support request
 * impossible. It is public data either way.
 */
export async function createCaseForUser(userId, input, { hat = ROLE.TENANT } = {}) {
  const [appointment, conversation, lease] = await Promise.all([
    input.relatedAppointmentId
      ? prisma.appointment.findFirst({
        where: { id: input.relatedAppointmentId, OR: [{ tenantId: userId }, { ownerId: userId }] },
        select: { id: true },
      })
      : null,
    input.relatedConversationId
      ? prisma.conversation.findFirst({
        where: { id: input.relatedConversationId, OR: [{ tenantId: userId }, { ownerId: userId }] },
        select: { id: true },
      })
      : null,
    input.relatedLeaseId
      ? prisma.lease.findFirst({
        where: { id: input.relatedLeaseId, OR: [{ tenantId: userId }, { ownerId: userId }] },
        select: { id: true },
      })
      : null,
  ])

  return createCase({
    type: input.type,
    subject: input.subject,
    description: input.description,
    createdById: userId,
    openedAs: hat,
    relatedPropertyId: input.relatedPropertyId ?? null,
    relatedAppointmentId: appointment?.id ?? null,
    relatedConversationId: conversation?.id ?? null,
    relatedLeaseId: lease?.id ?? null,
  }, { actor: { role: hat, userId } })
}

/**
 * Record an uploaded file against a case.
 *
 * Takes a URL our own uploader returned rather than doing the upload: the
 * multipart route owns the mime allowlist, the 5MB cap and the randomUUID path,
 * and duplicating that here would be a second, weaker door to the same bucket.
 *
 * Visibility follows the uploader's hat through the same rule as a message, so
 * a tenant's screenshot is TENANT_ONLY and never reaches the owner it may
 * identify them to.
 */
export async function addAttachment(caseId, actor, { url, fileName, mimeType, sizeBytes, messageId }) {
  const found = await prisma.supportCase.findUnique({
    where: { id: caseId },
    select: { id: true, status: true, createdById: true, openedAs: true, relatedUserId: true, relatedPropertyId: true },
  })
  if (!found) throw notFound()

  let role = actor.role
  if (!isStaff(role)) {
    role = partyRole(found, actor.userId, await relatedOwnerId(found))
    if (!role) throw notFound()
  }
  if (found.status === STATUS.CLOSED) {
    throw Object.assign(new Error('This case is closed.'), { statusCode: 400, expose: true })
  }

  return prisma.$transaction(async (tx) => {
    const attachment = await tx.supportAttachment.create({
      data: {
        caseId,
        messageId: messageId ?? null,
        uploadedByUserId: isStaff(role) ? null : actor.userId,
        uploadedByAdminId: isStaff(role) ? actor.adminId : null,
        url, fileName: fileName ?? null, mimeType, sizeBytes: sizeBytes ?? null,
        visibility: allowedVisibilities(role)[0],
      },
      select: { id: true, url: true, fileName: true, mimeType: true, visibility: true, createdAt: true },
    })
    await recordEvent({
      caseId, type: 'ATTACHMENT_ADDED',
      actor: { role, userId: actor.userId, adminId: actor.adminId },
      meta: { mimeType }, tx,
    })
    return attachment
  })
}
