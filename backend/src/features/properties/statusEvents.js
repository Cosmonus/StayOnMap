import { prisma } from '../../lib/prisma.js'

/**
 * Record that a listing changed status.
 *
 * Nine places in this codebase move a Property between statuses — publish,
 * pause, moderate, verify, mark-tenant, vacate, two auto-suspends, and the bulk
 * suspend when an owner is blocked. `status` is one column that overwrites
 * itself, so unless the transition is written down as it happens the evidence
 * is gone: the moment a listing goes OCCUPIED, nothing remembers it was ever
 * ACTIVE, and "net new supply this week" cannot be computed afterwards at any
 * price.
 *
 * FIRE AND FORGET, always. A metrics row must never break the write that earned
 * it — an owner marking their flat rented does not care that our chart missed a
 * point, and a throw here would surface as a failed action. Same rule as
 * `notifyUser` and the graph refreshes.
 *
 * A no-op when nothing changed, so a caller can hand over the old and new
 * status without checking first — and so an idempotent re-save does not invent
 * churn that never happened.
 *
 * `actor` is COARSE on purpose: 'owner', 'admin', 'system'. Who suspended a
 * listing already lives in `ActivityLog` with the admin attached. Putting a
 * user id here would turn a counting table into a second, weaker audit trail,
 * with its own retention question and its own answer to a deletion request.
 */
export function recordStatusChange({ propertyId, from, to, actor = 'system' }) {
  if (!propertyId || !to || from === to) return
  prisma.propertyStatusEvent
    .create({ data: { propertyId, fromStatus: from ?? null, toStatus: to, actor } })
    .catch(() => {})
}

/**
 * The same, for a bulk transition.
 *
 * `updateMany` is the one shape that cannot report what it touched — it returns
 * a count, not rows — so the caller has to resolve the ids BEFORE the update or
 * the set is unrecoverable. Blocking an owner suspends every ACTIVE listing
 * they have, and that is real churn: leaving it out would make the supply chart
 * quietly understate exactly the weeks when moderation was busiest.
 */
export function recordBulkStatusChange({ propertyIds, from, to, actor = 'system' }) {
  if (!propertyIds?.length || !to || from === to) return
  prisma.propertyStatusEvent
    .createMany({
      data: propertyIds.map((propertyId) => ({ propertyId, fromStatus: from ?? null, toStatus: to, actor })),
    })
    .catch(() => {})
}
