// Marketplace health — the supply side, and whether the two sides ever meet.
//
// `analytics.service.js` counts what people DID (sessions through a funnel) and
// `demand.service.js` counts what they asked for and we could not show. Both
// look at renters. This file is the other half: whether listings get made,
// whether owners answer, and whether a conversation ever becomes a tenancy.
//
// Everything here counts ROWS, not sessions, and that distinction is the reason
// it is a separate file rather than more functions in analytics.service.js. The
// funnel's denominator is a browsing session; this one's is a listing, a
// conversation or a booking. Quoting a session rate beside a row rate is how
// two true numbers produce a false comparison.
//
// House rule inherited from getTimeToPublish and worth keeping: report a MEDIAN
// with its sample size, never a mean. Production has ~5 genuine listings, so a
// single outlier moves a mean into fiction and the count matters as much as the
// number.
import { prisma } from '../../lib/prisma.js'

const DAY_MS = 24 * 60 * 60 * 1000

/** Median of a sorted numeric array, or null when there is nothing to report. */
function median(sorted) {
  if (!sorted.length) return null
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

/** Nearest-rank percentile — no interpolation, so the answer is a real observation. */
function percentile(sorted, p) {
  if (!sorted.length) return null
  return sorted[Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1)]
}

/**
 * Unfinished listings, and the step they stopped on.
 *
 * ⚠ THIS IS NOT AN ABANDONMENT RATE, and it cannot be made into one. A draft is
 * deleted the moment it publishes (`discardDraftEverywhere` on success), so a
 * finished listing leaves no evidence it was ever a draft — the denominator
 * does not exist. Reporting `open / (open + published)` would silently compare
 * live drafts against listings whose drafts are gone, which is a smaller number
 * dressed up as a rate.
 *
 * What this DOES answer is the actionable question: how many people are stuck
 * right now, for how long, and on which question. `stepKey` is read rather than
 * `stepIdx` because the two wizards number their steps differently — web runs
 * six steps, mobile seven — so an index means different things depending on
 * which device saved it.
 */
export async function getDraftFunnel({ days = 90, staleDays = 7 } = {}) {
  const since = new Date(Date.now() - days * DAY_MS)
  const staleBefore = new Date(Date.now() - staleDays * DAY_MS)

  const rows = await prisma.listingDraft.findMany({
    where: { savedAt: { gte: since } },
    select: { savedAt: true, payload: true },
  })

  const ages = rows.map((r) => Date.now() - r.savedAt.getTime()).sort((a, b) => a - b)

  const byStep = new Map()
  for (const r of rows) {
    // A draft written before stepKey existed, or by a build we do not know:
    // grouped as unknown rather than guessed into a real step.
    const key = typeof r.payload?.stepKey === 'string' ? r.payload.stepKey : 'unknown'
    byStep.set(key, (byStep.get(key) ?? 0) + 1)
  }

  const medianAge = median(ages)

  return {
    days,
    staleDays,
    open: rows.length,
    stale: rows.filter((r) => r.savedAt < staleBefore).length,
    medianAgeHours: medianAge === null ? null : Math.round(medianAge / (60 * 60 * 1000)),
    byStep: [...byStep.entries()]
      .map(([stepKey, count]) => ({ stepKey, count }))
      .sort((a, b) => b.count - a.count),
  }
}

/**
 * How long an owner takes to answer a renter, and how often they never do.
 *
 * `features/trust/responsiveness.js` already measures this PER OWNER for trust
 * scoring; this is the platform-wide distribution, which is a different
 * question — a good median hides the third of owners who never reply, and it is
 * the never-replied share that decides whether a rental marketplace works.
 *
 * Measured from the renter's FIRST message rather than from `contact_intent`:
 * the analytics event says somebody pressed a button, the message says they
 * actually asked something. Only the second one deserves an answer.
 *
 * A conversation with no owner reply YET is counted as unanswered rather than
 * dropped. Dropping it would mean the metric improves every time an owner
 * ignores someone, which is precisely backwards.
 */
export async function getOwnerResponsiveness({ days = 30 } = {}) {
  const since = new Date(Date.now() - days * DAY_MS)

  const rows = await prisma.$queryRaw`
    WITH asked AS (
      SELECT m."conversationId", MIN(m."createdAt") AS at
      FROM "Message" m
      JOIN "Conversation" c ON c."id" = m."conversationId"
      WHERE m."senderId" = c."tenantId" AND m."createdAt" >= ${since}
      GROUP BY m."conversationId"
    )
    SELECT
      a."conversationId",
      MIN(reply."createdAt") AS answered_at,
      a.at                   AS asked_at
    FROM asked a
    JOIN "Conversation" c ON c."id" = a."conversationId"
    LEFT JOIN "Message" reply
      ON reply."conversationId" = a."conversationId"
     AND reply."senderId" = c."ownerId"
     AND reply."createdAt" > a.at
    GROUP BY a."conversationId", a.at
  `

  const waits = rows
    .filter((r) => r.answered_at)
    .map((r) => (new Date(r.answered_at).getTime() - new Date(r.asked_at).getTime()) / 60000)
    .sort((a, b) => a - b)

  return {
    days,
    conversations: rows.length,
    answered: waits.length,
    neverAnswered: rows.length - waits.length,
    medianMinutes: median(waits) === null ? null : Math.round(median(waits)),
    p90Minutes: percentile(waits, 90) === null ? null : Math.round(percentile(waits, 90)),
  }
}

/**
 * Conversation → booking → tenancy, in rows.
 *
 * The session funnel stops at `appointment_created`, and leases are reported as
 * an all-time count with nothing joining the two. This is the join:
 * `Lease.appointmentId` means a signed lease can be traced back to the visit
 * that produced it, which is the only end-to-end evidence the product works.
 *
 * Each step counts things STARTED in the window, so the later steps are
 * genuinely a subset of the earlier ones — an appointment booked last week and
 * signed today counts in both. Counting outcomes by their own date instead
 * would let a step exceed the one above it and read as a rate over 100%.
 */
export async function getMatchChain({ days = 90 } = {}) {
  const since = new Date(Date.now() - days * DAY_MS)
  const window = { gte: since }

  const [conversations, appointments, accepted, leasesOffered, signedRows] = await Promise.all([
    prisma.conversation.count({ where: { createdAt: window } }),
    prisma.appointment.count({ where: { createdAt: window } }),
    prisma.appointment.count({ where: { createdAt: window, status: 'ACCEPTED' } }),
    prisma.lease.count({ where: { createdAt: window } }),
    prisma.lease.findMany({
      where: { createdAt: window, signedAt: { not: null } },
      // `appointmentId` is a BARE COLUMN on Lease — there is no `appointment`
      // relation to include, so this is resolved in a second query below.
      // Selecting it as a relation is a runtime Prisma error, not a type error,
      // and a mocked client in a unit test validates nothing: it 500'd the
      // whole endpoint in production while the suite stayed green.
      // tests/prisma-field-names.test.js now checks every select against
      // schema.prisma, which is the only thing that could have caught it.
      select: { signedAt: true, createdAt: true, appointmentId: true },
    }),
  ])

  // From the visit request to a signed lease — the whole journey, for the
  // leases that can see back to one. A lease offered without an appointment
  // (an owner and renter who sorted it out in chat) has no such start, so it
  // is excluded from the duration rather than measured from the offer, which
  // would be a different and much shorter thing wearing the same label.
  //
  // Two queries rather than a join, because `Lease.appointmentId` is a plain
  // column with no relation declared. One extra round trip on a handful of ids.
  const appointmentIds = signedRows.map((l) => l.appointmentId).filter(Boolean)
  const starts = appointmentIds.length
    ? new Map(
      (await prisma.appointment.findMany({
        where: { id: { in: appointmentIds } },
        select: { id: true, createdAt: true },
      })).map((a) => [a.id, a.createdAt]),
    )
    : new Map()

  const durations = signedRows
    .map((l) => ({ signedAt: l.signedAt, startedAt: starts.get(l.appointmentId) }))
    .filter((l) => l.startedAt)
    .map((l) => (l.signedAt.getTime() - l.startedAt.getTime()) / DAY_MS)
    .sort((a, b) => a - b)

  return {
    days,
    steps: [
      { key: 'conversations', label: 'Conversations started', count: conversations },
      { key: 'appointments',  label: 'Visits requested',      count: appointments },
      { key: 'accepted',      label: 'Visits accepted',       count: accepted },
      { key: 'leases',        label: 'Leases offered',        count: leasesOffered },
      { key: 'signed',        label: 'Leases signed',         count: signedRows.length },
    ],
    medianDaysToLease: median(durations) === null ? null : Math.round(median(durations) * 10) / 10,
    samples: durations.length,
  }
}

/**
 * Live listings nobody is looking at.
 *
 * The funnel says how many people reached a property page; it cannot say that
 * four of our listings have never been on one. At this inventory that
 * distinction decides what to do next: a listing with no views is a
 * VISIBILITY problem (wrong area, wrong price band, not indexed), while a
 * listing with views and no messages is a LISTING problem (bad photos, no
 * description, a price nobody will pay). They look identical on every other
 * screen and need opposite work.
 *
 * "Seen" means a real property-page view or a conversation, never a map pin
 * impression — a pin scrolling past in a viewport is not somebody looking at
 * a home.
 */
export async function getDeadInventory({ days = 30, limit = 10 } = {}) {
  const since = new Date(Date.now() - days * DAY_MS)
  const sinceDay = new Date(since.toISOString().slice(0, 10)) // PropertyDailyView.day is a DATE

  const [live, viewed, contacted] = await Promise.all([
    prisma.property.findMany({
      where: { status: 'ACTIVE' },
      select: { id: true, title: true, city: true, createdAt: true, publishedAt: true },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.propertyDailyView.groupBy({
      by: ['propertyId'],
      where: { day: { gte: sinceDay } },
      _sum: { count: true },
    }),
    prisma.conversation.groupBy({
      by: ['propertyId'],
      where: { createdAt: { gte: since } },
      _count: { _all: true },
    }),
  ])

  const views = new Map(viewed.map((r) => [r.propertyId, r._sum.count ?? 0]))
  const chats = new Map(contacted.map((r) => [r.propertyId, r._count._all]))

  const scored = live.map((p) => ({
    id: p.id,
    title: p.title,
    city: p.city,
    liveSince: p.publishedAt ?? p.createdAt,
    views: views.get(p.id) ?? 0,
    conversations: chats.get(p.id) ?? 0,
  }))

  return {
    days,
    live: live.length,
    // Split rather than summed, because the two need opposite work.
    unseen: scored.filter((p) => p.views === 0).length,
    seenButUncontacted: scored.filter((p) => p.views > 0 && p.conversations === 0).length,
    // Oldest first: a listing that has been live and ignored for a month is a
    // more urgent conversation with its owner than one posted on Tuesday.
    worst: scored.filter((p) => p.conversations === 0).slice(0, limit),
  }
}

/**
 * Whether our listings are good enough to convert the demand we do get.
 *
 * With ~5 genuine listings every one of them has to work, so "how many photos
 * does the median listing have" is a supply-quality question, not vanity. A
 * listing with no photo wastes scarce, expensive demand — and nothing in the
 * panel could name which one it was.
 *
 * Buckets rather than an average: "2.4 photos" describes no real listing, and
 * the actionable fact is how many sit at zero.
 */
export async function getListingReadiness() {
  const live = await prisma.property.findMany({
    where: { status: 'ACTIVE' },
    select: {
      id: true,
      title: true,
      description: true,
      _count: { select: { images: true } },
      verification: { select: { status: true } },
    },
  })

  const photos = { none: 0, few: 0, enough: 0 }
  let noDescription = 0
  let verified = 0
  const worst = []

  for (const p of live) {
    const n = p._count.images
    if (n === 0) photos.none++
    else if (n < 3) photos.few++
    else photos.enough++

    // 120 characters is roughly one honest sentence about the home. Shorter
    // than that is a title repeated, which tells a renter nothing.
    const thin = !p.description || p.description.trim().length < 120
    if (thin) noDescription++
    if (p.verification?.status === 'VERIFIED') verified++

    if (n < 3 || thin) worst.push({ id: p.id, title: p.title, photos: n, thinDescription: thin })
  }

  return {
    live: live.length,
    photos,
    noDescription,
    verified,
    worst: worst.slice(0, 10),
  }
}

/**
 * New supply, by week.
 *
 * TWO SERIES, DELIBERATELY, because they answer different questions and only
 * one of them has history. `created` is when an owner started the listing and
 * is exact all the way back; `published` is when a renter could first see it
 * and exists only from 2026-08-10, when the column was added (see
 * features/properties/publishedAt.js). Merging them with COALESCE would produce
 * one clean-looking line that changes meaning halfway along.
 */
export async function getSupplyTrend({ weeks = 12 } = {}) {
  const since = new Date(Date.now() - weeks * 7 * DAY_MS)

  const rows = await prisma.$queryRaw`
    SELECT
      TO_CHAR(week, 'YYYY-MM-DD')                  AS week,
      CAST(COALESCE(SUM(created), 0) AS INTEGER)   AS created,
      CAST(COALESCE(SUM(published), 0) AS INTEGER) AS published
    FROM (
      SELECT DATE_TRUNC('week', "createdAt") AS week, 1 AS created, 0 AS published
      FROM "Property" WHERE "createdAt" >= ${since}
      UNION ALL
      SELECT DATE_TRUNC('week', "publishedAt") AS week, 0 AS created, 1 AS published
      FROM "Property" WHERE "publishedAt" >= ${since}
    ) t
    GROUP BY week
    ORDER BY week ASC
  `

  // What LEFT the market, from the status log. Without this the chart only ever
  // goes up — a picture of a market where nothing is rented, paused or removed.
  const departures = await prisma.$queryRaw`
    SELECT
      TO_CHAR(DATE_TRUNC('week', "createdAt"), 'YYYY-MM-DD') AS week,
      CAST(COUNT(*) AS INTEGER)                              AS left_market
    FROM "PropertyStatusEvent"
    WHERE "createdAt" >= ${since}
      AND "fromStatus" = 'ACTIVE'
      AND "toStatus" <> 'ACTIVE'
    GROUP BY DATE_TRUNC('week', "createdAt")
    ORDER BY DATE_TRUNC('week', "createdAt") ASC
  `
  const leftBy = new Map(departures.map((r) => [r.week, Number(r.left_market)]))

  return {
    weeks,
    // Said out loud rather than left for a reader to infer from a flat line:
    // every listing that went live before this date has a NULL publishedAt and
    // cannot be placed on the published series. The same is true of departures —
    // the status log starts empty, so early weeks show no churn because none was
    // recorded, not because none happened.
    publishedTrackedSince: '2026-08-10',
    series: rows.map((r) => {
      const published = Number(r.published)
      const left = leftBy.get(r.week) ?? 0
      return {
        week: r.week,
        created: Number(r.created),
        published,
        left,
        // The number a marketplace lives on. Reported alongside its parts
        // rather than instead of them: a net of zero from 8 in and 8 out is a
        // different business from a net of zero from nothing happening.
        net: published - left,
      }
    }),
  }
}
