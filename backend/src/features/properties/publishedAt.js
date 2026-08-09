/**
 * When a listing first went live — one rule, shared by every place that can
 * flip a Property to ACTIVE.
 *
 * There are three such places (admin approval, verification approval, and an
 * owner marking a home vacant again) and they had nothing in common before
 * this. A stamp written slightly differently in each is exactly how a supply
 * chart ends up counting the same listing twice.
 *
 * Two rules, both of which exist to keep "new supply this week" meaning what
 * it says:
 *
 * 1. **Once.** A listing paused for a month and reinstated has not been
 *    published twice. Already stamped means leave it alone.
 * 2. **Not from OCCUPIED.** A tenant moving out makes a listing available
 *    again; it does not make it new. Without this, every vacancy would appear
 *    in the supply chart as fresh inventory — the one number the chart exists
 *    to report honestly.
 *
 * Returns a Prisma `data` fragment, empty when nothing should be written, so
 * callers can spread it unconditionally.
 */
export function firstPublishStamp(current, nextStatus, now = new Date()) {
  if (nextStatus !== 'ACTIVE') return {}
  if (current?.publishedAt) return {}
  if (current?.status === 'OCCUPIED') return {}
  return { publishedAt: now }
}
