// What a person has shown they are looking for.
//
// DERIVED ON READ, NOT STORED. There is no UserPreference table, and that is a
// decision rather than an omission: every signal it would hold already exists in
// SavedListing, PropertyViewer and Appointment, so a table would be a second
// copy with a staleness problem and a sync path to get wrong. The same rule the
// spatial layer follows applies — promote a derived value to a real column when
// a FILTER needs one, and not before. Nothing filters on preference; ranking
// reads it for one user at a time.
//
// WHAT IS DELIBERATELY NOT INFERRED. The brief says not to infer sensitive
// personal attributes, and the honest reading of that is stronger than avoiding
// protected characteristics: we do not infer where someone WORKS from where they
// browse, or who they live with from a bedroom count. The commute destination is
// asked for, never guessed — CommuteCalculator already asks.
//
// SIGNAL STRENGTH IS ORDERED BY COST TO THE USER. Saving a listing is a
// deliberate act; requesting a visit is a bigger one; a view is nearly free and
// is often a mis-tap. They are weighted accordingly, because treating a glance
// as equal to a booking is what produces recommendations that feel like
// surveillance and are wrong anyway.
import { prisma } from '../../lib/prisma.js'
import { cacheGet, cacheSet } from '../../lib/redis.js'
import { intelError } from '../../lib/intelLog.js'

const CACHE_TTL_S = 5 * 60

// How much each act says about intent.
const WEIGHT = { appointment: 5, saved: 3, viewed: 1 }

// Below this, we have not learned anything worth acting on. Ranking treats a
// null preference as "component absent" rather than "no preferences", which are
// very different: the first drops out of the blend, the second would rank
// everything against an empty profile.
const MIN_SIGNALS = 3

/**
 * Derive one person's preferences from what they have already done.
 *
 * Returns null when there is not enough to say. Never throws — a ranking that
 * cannot personalise is still a ranking.
 *
 * @returns {Promise<{types, localityIds, budget, cities, basis}|null>}
 */
export async function getUserPreferences(userId) {
  if (!userId) return null

  const key = `graph:prefs:${userId}`
  const cached = await cacheGet(key)
  if (cached) return cached.v

  try {
    const [saved, appointments, viewed] = await Promise.all([
      prisma.savedListing.findMany({
        where: { userId },
        select: { property: { select: PROPERTY_FIELDS } },
        take: 100,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.appointment.findMany({
        where: { tenantId: userId },
        select: { property: { select: PROPERTY_FIELDS } },
        take: 50,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.propertyViewer.findMany({
        where: { userId },
        select: { count: true, property: { select: PROPERTY_FIELDS } },
        take: 100,
        orderBy: { lastViewedAt: 'desc' },
      }),
    ])

    const signals = [
      ...appointments.map((a) => ({ property: a.property, weight: WEIGHT.appointment })),
      ...saved.map((s) => ({ property: s.property, weight: WEIGHT.saved })),
      // A repeat view says a little more than a single one, but capped: forty
      // views of one listing is one interest, not forty.
      ...viewed.map((v) => ({ property: v.property, weight: WEIGHT.viewed * Math.min(3, v.count ?? 1) })),
    ].filter((s) => s.property)

    if (signals.length < MIN_SIGNALS) return await remember(key, null)

    const types = topKeys(signals, (p) => p.type, 3)
    const localityIds = topKeys(signals, (p) => p.localityId, 5)
    const cities = topKeys(signals, (p) => p.city, 3)

    // Budget from the prices they actually engaged with. A range, not an
    // average: the average of a ₹12k PG and a ₹80k flat is a number describing
    // nothing anyone looked at.
    const prices = signals
      .flatMap(({ property, weight }) => {
        const value = Number(property.type === 'SHORT_STAY' ? (property.nightlyRate ?? property.rent) : property.rent)
        return Number.isFinite(value) && value > 0 ? Array(Math.round(weight)).fill(value) : []
      })
      .sort((a, b) => a - b)

    const budget = prices.length
      // 10th-90th percentile, so one outlier cannot widen the range to
      // uselessness.
      ? { min: percentile(prices, 0.1), max: percentile(prices, 0.9) }
      : null

    const preferences = {
      types,
      localityIds,
      cities,
      budget,
      // What this was learned from. A recommendation that cannot say why it
      // thinks what it thinks is not something a user can correct.
      basis: {
        appointments: appointments.length,
        saved: saved.length,
        viewed: viewed.length,
      },
    }
    return await remember(key, preferences)
  } catch (err) {
    intelError('graph.preferences_failed', err, { userId })
    return null
  }
}

const PROPERTY_FIELDS = {
  id: true, type: true, city: true, localityId: true,
  rent: true, nightlyRate: true, bhk: true,
}

async function remember(key, value) {
  await cacheSet(key, { v: value }, CACHE_TTL_S)
  return value
}

/** The most-weighted distinct values of one field. */
function topKeys(signals, pick, limit) {
  const totals = new Map()
  for (const { property, weight } of signals) {
    const key = pick(property)
    if (key == null) continue
    totals.set(key, (totals.get(key) ?? 0) + weight)
  }
  return [...totals.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([key]) => key)
}

function percentile(sorted, p) {
  const index = Math.min(sorted.length - 1, Math.max(0, Math.floor(sorted.length * p)))
  return Math.round(sorted[index])
}

/**
 * Drop a person's cached profile.
 *
 * Called when they act — saving a listing should change what they are shown
 * before the five-minute TTL expires, or the feature feels broken in exactly
 * the moment somebody is paying attention to it.
 */
export async function invalidatePreferences(userId) {
  if (!userId) return
  await cacheSet(`graph:prefs:${userId}`, null, 1).catch(() => {})
}
