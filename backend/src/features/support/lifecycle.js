/**
 * The case lifecycle, as a closed machine.
 *
 * Pure, like visibility.js, and for the same reason: a status is not decoration
 * — RESOLVED stamps `resolvedAt`, which is what every SLA number is computed
 * from, and CLOSED is meant to be final. A service that accepted any status
 * from a request body would let a caller reopen a closed case, un-resolve a
 * resolved one, or quietly rewrite the timings a support team is measured on.
 *
 * The rule the spec asks for — "do not allow arbitrary status transitions" —
 * is enforced HERE and nowhere else, so there is one table to read and one to
 * change.
 */

export const STATUS = {
  OPEN: 'OPEN',
  TRIAGED: 'TRIAGED',
  IN_PROGRESS: 'IN_PROGRESS',
  WAITING_FOR_USER: 'WAITING_FOR_USER',
  WAITING_FOR_OWNER: 'WAITING_FOR_OWNER',
  ESCALATED: 'ESCALATED',
  RESOLVED: 'RESOLVED',
  CLOSED: 'CLOSED',
}

export const PRIORITY = { LOW: 'LOW', NORMAL: 'NORMAL', HIGH: 'HIGH', URGENT: 'URGENT' }

/** Statuses that mean the case is finished, for counting and for gating. */
export const TERMINAL = new Set([STATUS.CLOSED])

/**
 * Where each status can go next.
 *
 * Three deliberate shapes:
 *
 *   · The working states (TRIAGED, IN_PROGRESS, both WAITING_*, ESCALATED) all
 *     reach each other. Support is not a pipeline — a case waiting on an owner
 *     goes back to IN_PROGRESS the moment they answer, and pretending otherwise
 *     just makes people set the wrong status.
 *   · RESOLVED can be REOPENED to IN_PROGRESS. "We think this is fixed" is a
 *     claim the other person is allowed to disagree with, and forcing a new
 *     case for a bad fix loses the history that explains it.
 *   · CLOSED goes NOWHERE. It is the one genuinely final state, which is what
 *     makes it worth having next to RESOLVED.
 */
const WORKING = [
  STATUS.TRIAGED, STATUS.IN_PROGRESS, STATUS.WAITING_FOR_USER,
  STATUS.WAITING_FOR_OWNER, STATUS.ESCALATED,
]

/** The working states plus the two exits, minus `from` itself. */
const onwardFrom = (from) => [...WORKING, STATUS.RESOLVED, STATUS.CLOSED].filter((s) => s !== from)

export const TRANSITIONS = {
  [STATUS.OPEN]:              onwardFrom(STATUS.OPEN),
  [STATUS.TRIAGED]:           onwardFrom(STATUS.TRIAGED),
  [STATUS.IN_PROGRESS]:       onwardFrom(STATUS.IN_PROGRESS),
  [STATUS.WAITING_FOR_USER]:  onwardFrom(STATUS.WAITING_FOR_USER),
  [STATUS.WAITING_FOR_OWNER]: onwardFrom(STATUS.WAITING_FOR_OWNER),
  [STATUS.ESCALATED]:         onwardFrom(STATUS.ESCALATED),
  // Reopening is allowed; skipping straight back into triage is not — a
  // reopened case is being worked on, by definition.
  [STATUS.RESOLVED]:          [STATUS.IN_PROGRESS, STATUS.CLOSED],
  [STATUS.CLOSED]:            [],
}

export const canTransition = (from, to) => (TRANSITIONS[from] ?? []).includes(to)

/**
 * Validate a transition, or throw the 400 the caller should send.
 *
 * Throws rather than returning false so a service cannot forget to check the
 * result — the failure mode of a boolean here is silently applying an illegal
 * transition, which is the thing this module exists to prevent.
 */
export function assertTransition(from, to) {
  if (from === to) {
    throw Object.assign(new Error(`This case is already ${to.toLowerCase().replace(/_/g, ' ')}.`), {
      statusCode: 400, expose: true,
    })
  }
  if (!canTransition(from, to)) {
    const message = from === STATUS.CLOSED
      // Named specially because it is the one people hit: a closed case looks
      // like every other case, and "invalid transition" would not explain it.
      ? 'This case is closed. Closed cases cannot be changed — open a new one instead.'
      : `A case cannot go from ${from.replace(/_/g, ' ').toLowerCase()} to ${to.replace(/_/g, ' ').toLowerCase()}.`
    throw Object.assign(new Error(message), { statusCode: 400, expose: true })
  }
}

/**
 * The timestamps a transition stamps, beyond `status` itself.
 *
 * Written once and never cleared on reopen: `resolvedAt` records that a case
 * WAS resolved at a point in time, and blanking it on reopen would erase the
 * fact that support answered within an hour and got it wrong — which is
 * precisely the case worth being able to find later.
 */
export function transitionStamps(to, current) {
  const now = new Date()
  if (to === STATUS.RESOLVED && !current?.resolvedAt) return { resolvedAt: now }
  if (to === STATUS.CLOSED) {
    return { closedAt: now, ...(current?.resolvedAt ? {} : { resolvedAt: now }) }
  }
  return {}
}

/**
 * Which status a case should move to when a party replies.
 *
 * A tenant answering a WAITING_FOR_USER case is the single most common event in
 * any support system, and leaving it WAITING_FOR_USER is how a queue fills with
 * cases that are actually waiting on staff. Returns null when nothing should
 * change, so the caller does not have to know the rules.
 */
export function statusAfterReply(current, authorRole) {
  if (current === STATUS.CLOSED || current === STATUS.RESOLVED) return null
  if (authorRole === 'TENANT' && current === STATUS.WAITING_FOR_USER) return STATUS.IN_PROGRESS
  if (authorRole === 'OWNER' && current === STATUS.WAITING_FOR_OWNER) return STATUS.IN_PROGRESS
  // A staff reply on a brand-new case means somebody picked it up.
  if ((authorRole === 'ADMIN' || authorRole === 'SUPPORT_AGENT') && current === STATUS.OPEN) return STATUS.IN_PROGRESS
  return null
}
