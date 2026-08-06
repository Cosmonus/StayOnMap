// Product telemetry — recording, and the two questions it exists to answer.
//
// Zero telemetry existed before 2026-08-07, so every product decision was made
// on intuition. This is deliberately the smallest thing that changes that: one
// funnel, one duration, and a readout in the admin panel. Data with no readout
// is not instrumentation, it is a table.
import { prisma } from '../../lib/prisma.js'
import { FUNNEL, RETENTION_DAYS } from './events.js'

// Recording must never be able to break the thing being recorded. Every entry
// point here swallows its own errors — a failed insert loses one data point,
// which is a rounding error; a thrown one loses the user's action.
export async function recordEvents(rows) {
  if (!rows?.length) return 0
  try {
    const result = await prisma.analyticsEvent.createMany({ data: rows })
    schedulePrune()
    return result.count
  } catch {
    return 0
  }
}

/** Fire-and-forget single event, for server-side emitters. */
export function record(name, { sessionId, userId, propertyId, city, props } = {}) {
  // A server-side event has no browser session. Key it to the user so it can
  // still be stitched into that person's funnel; fall back to a marker rather
  // than an empty string, which would silently group every server event into
  // one giant "session".
  recordEvents([{
    name,
    sessionId: sessionId ?? (userId ? `server:${userId}` : 'server:anonymous'),
    userId: userId ?? null,
    propertyId: propertyId ?? null,
    city: city ?? null,
    props: props ?? null,
  }]).catch(() => {})
}

// ── Retention ───────────────────────────────────────────────────────────────
// No new scheduler. The backend has one interval (the spatial refresher) and
// adding a second for a once-a-day DELETE would be more moving parts than the
// problem has. Instead the prune rides an insert, at most once per process per
// day. It is an idempotent DELETE, so running it on several instances is
// harmless — worst case each one finds nothing left to remove.
let lastPruneDay = null

function schedulePrune() {
  const today = new Date().toISOString().slice(0, 10)
  if (lastPruneDay === today) return
  lastPruneDay = today
  pruneOldEvents().catch(() => {})
}

export async function pruneOldEvents(now = new Date()) {
  const cutoff = new Date(now.getTime() - RETENTION_DAYS * 24 * 60 * 60 * 1000)
  const { count } = await prisma.analyticsEvent.deleteMany({
    where: { createdAt: { lt: cutoff } },
  })
  return count
}

// ── The readout ─────────────────────────────────────────────────────────────

/**
 * The funnel, counted in SESSIONS rather than events.
 *
 * This distinction is the whole point. Counting events makes a single restless
 * visitor who taps forty pins look like forty people reaching step two, and the
 * conversion rate that falls out of it is fiction. A session either reached a
 * step or it did not.
 *
 * Each step's rate is quoted against the FIRST step, not the previous one —
 * "3% of people who saw the map booked a visit" is the number that means
 * something, and step-to-step rates hide a collapse at the top.
 */
export async function getFunnel({ days = 30 } = {}) {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000)

  const rows = await prisma.analyticsEvent.groupBy({
    by: ['name', 'sessionId'],
    where: { name: { in: FUNNEL }, createdAt: { gte: since } },
  })

  const sessionsByStep = new Map(FUNNEL.map((n) => [n, new Set()]))
  for (const row of rows) sessionsByStep.get(row.name)?.add(row.sessionId)

  const top = sessionsByStep.get(FUNNEL[0]).size

  return {
    days,
    steps: FUNNEL.map((name) => {
      const sessions = sessionsByStep.get(name).size
      return {
        name,
        sessions,
        // Null, not 0, when there is nothing to divide by. A 0% conversion
        // rate reads as "nobody converts"; the truth is "nobody has visited".
        pctOfTop: top ? Math.round((sessions / top) * 1000) / 10 : null,
      }
    }),
  }
}

/**
 * How long it takes an owner to get a listing live, from first keystroke in
 * the wizard to published.
 *
 * Reported as a MEDIAN plus the sample size, never a mean: one owner who left
 * a draft open over a weekend drags a mean into uselessness, and with ~5 real
 * listings in production the sample is small enough that the count matters as
 * much as the number.
 */
export async function getTimeToPublish({ days = 90 } = {}) {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000)

  const rows = await prisma.analyticsEvent.findMany({
    where: { name: 'listing_publish_completed', createdAt: { gte: since } },
    select: { props: true },
  })

  const durations = rows
    .map((r) => Number(r.props?.msSinceDraftStart))
    .filter((ms) => Number.isFinite(ms) && ms > 0)
    .sort((a, b) => a - b)

  if (!durations.length) return { days, samples: 0, medianMinutes: null }

  const mid = Math.floor(durations.length / 2)
  const medianMs = durations.length % 2
    ? durations[mid]
    : (durations[mid - 1] + durations[mid]) / 2

  return {
    days,
    samples: durations.length,
    medianMinutes: Math.round(medianMs / 60000),
  }
}
