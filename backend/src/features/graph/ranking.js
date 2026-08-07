// The ranking pipeline.
//
// Deterministic, explainable, and tunable without a deploy. Every ranked result
// carries the component scores that produced its position, because a ranking
// nobody can interrogate is indistinguishable from a bug.
//
// THREE PROPERTIES, all deliberate:
//
//   1. WEIGHTS LIVE IN THE DATABASE, DEFAULTS LIVE IN CODE. Tuning from real
//      behaviour is the point; a redeploy per experiment is how tuning stops
//      happening. An empty RankingWeights table is a working system, not a
//      broken one — which also means a fresh checkout ranks identically to
//      production until somebody deliberately changes it.
//
//   2. NOTHING IN THE AGENT LAYER CAN WRITE THEM. Structural, not a promise:
//      no writer is exported from here, and features/graph/tools/ imports only
//      `rankProperties`. A model that can set its own weights can justify any
//      ordering after the fact.
//
//   3. A COMPONENT THAT CANNOT BE COMPUTED IS DROPPED, NOT ZEROED. No commute
//      destination given means commute is not part of the blend — scoring it
//      zero would push every listing down equally, which is noise, and would
//      make the total incomparable between a query that supplied a destination
//      and one that did not.
import { prisma } from '../../lib/prisma.js'
import { haversineMeters } from '../../lib/geohash.js'
import { intelError } from '../../lib/intelLog.js'

/**
 * The default profile.
 *
 * These are the weights the brief specifies. They are a starting hypothesis,
 * not a finding — nothing has yet measured whether trust should outrank budget.
 * That is exactly why they are tunable, and why `note` exists on the table.
 */
export const DEFAULT_WEIGHTS = {
  location: 0.25,
  budget: 0.20,
  commute: 0.15,
  preference: 0.15,
  trust: 0.15,
  freshness: 0.10,
}

const COMPONENTS = Object.keys(DEFAULT_WEIGHTS)

// Weights change about never; the cache spares a lookup per ranked request.
let cached = null
let cachedAt = 0
const CACHE_MS = 60_000

/**
 * Load a weight profile, falling back to the code defaults.
 *
 * Any unknown key in a stored profile is IGNORED and any missing one takes its
 * default, so a partial or typo'd row degrades to sane behaviour instead of
 * ranking on a component that does not exist.
 */
export async function getWeights(name = 'default') {
  if (cached && Date.now() - cachedAt < CACHE_MS) return cached
  try {
    const row = await prisma.rankingWeights.findUnique({ where: { name } })
    const stored = row?.weights ?? {}
    const merged = Object.fromEntries(COMPONENTS.map((k) => [
      k,
      Number.isFinite(Number(stored[k])) && Number(stored[k]) >= 0 ? Number(stored[k]) : DEFAULT_WEIGHTS[k],
    ]))
    cached = normalise(merged)
    cachedAt = Date.now()
    return cached
  } catch (err) {
    // A missing table or an unreachable database must not stop the site
    // ranking results. Defaults are a correct answer, not a degraded one.
    intelError('graph.ranking_weights_failed', err, { name })
    return normalise({ ...DEFAULT_WEIGHTS })
  }
}

/** Scale a profile to sum to 1, so a row that does not is corrected rather than
 *  silently over-weighting every component at once. */
function normalise(weights) {
  const total = Object.values(weights).reduce((a, b) => a + b, 0)
  if (!(total > 0)) return { ...DEFAULT_WEIGHTS }
  return Object.fromEntries(Object.entries(weights).map(([k, v]) => [k, v / total]))
}

/** Test seam — the cache would otherwise carry a profile between cases. */
export function resetWeightCache() {
  cached = null
  cachedAt = 0
}

const HALF_LIFE_DAYS = 30

/**
 * Score one property against a search context.
 *
 * @param {object} property     with lat/lng, rent, trustScore, createdAt
 * @param {object} context
 *   center      {lat,lng}  what the search was centred on
 *   radiusM     number     the viewport's reach, so "close" scales with the map
 *   budget      {min,max}  the renter's stated range
 *   commute     {lat,lng}  where they need to get to
 *   preferences from getUserPreferences()
 *   now         Date       injected so freshness is testable
 */
export function scoreProperty(property, context = {}) {
  const { center, radiusM = 8_000, budget, commute, preferences, now = new Date() } = context
  const components = {}

  // ── Location: distance from what the search was centred on.
  if (center && property.lat != null && property.lng != null) {
    const metres = haversineMeters(Number(center.lat), Number(center.lng), Number(property.lat), Number(property.lng))
    components.location = Math.max(0, 1 - metres / Math.max(radiusM, 1))
  }

  // ── Budget: inside the range is a full mark; outside decays by how far over.
  const price = Number(property.type === 'SHORT_STAY' ? (property.nightlyRate ?? property.rent) : property.rent)
  if (budget && Number.isFinite(price) && price > 0) {
    const { min, max } = budget
    if (max != null && price > Number(max)) {
      // Over budget. Decays to zero at 50% over — beyond that it is not an
      // option, however good it is.
      components.budget = Math.max(0, 1 - (price - Number(max)) / (Number(max) * 0.5))
    } else if (min != null && price < Number(min)) {
      // Under budget is not a problem, but a listing far below the stated floor
      // is usually a different product than the one being shopped for.
      components.budget = Math.max(0.5, 1 - (Number(min) - price) / Math.max(Number(min), 1))
    } else {
      components.budget = 1
    }
  }

  // ── Commute: only when a destination was actually given.
  if (commute && property.lat != null && property.lng != null) {
    const metres = haversineMeters(Number(commute.lat), Number(commute.lng), Number(property.lat), Number(property.lng))
    // 15km is the point where a daily commute stops being a selling point.
    // Straight-line, and therefore a PROXY — the spatial layer refuses to turn
    // haversine into a travel time, and so does this. It orders results; it is
    // never displayed as a duration.
    components.commute = Math.max(0, 1 - metres / 15_000)
  }

  // ── Preference: how well this matches what the person has shown they want.
  if (preferences) {
    const parts = []
    if (preferences.types?.length) parts.push(preferences.types.includes(property.type) ? 1 : 0)
    if (preferences.localityIds?.length && property.localityId) {
      parts.push(preferences.localityIds.includes(property.localityId) ? 1 : 0)
    }
    if (preferences.budget && Number.isFinite(price) && price > 0) {
      const { min, max } = preferences.budget
      parts.push(price >= min * 0.8 && price <= max * 1.2 ? 1 : 0)
    }
    if (parts.length) components.preference = parts.reduce((a, b) => a + b, 0) / parts.length
  }

  // ── Trust: the platform's own score, already 0-100.
  const trust = property.trustScore?.overallScore
  if (Number.isFinite(Number(trust))) components.trust = Math.min(1, Math.max(0, Number(trust) / 100))

  // ── Freshness: exponential decay, so a listing does not fall off a cliff on
  // its 31st day.
  const created = property.createdAt ? new Date(property.createdAt) : null
  if (created && !Number.isNaN(created.valueOf())) {
    const days = (now.valueOf() - created.valueOf()) / 86_400_000
    components.freshness = Math.max(0, Math.min(1, 2 ** (-Math.max(0, days) / HALF_LIFE_DAYS)))
  }

  return components
}

/**
 * Rank a candidate set. Pure — it does no I/O, so it is trivially testable and
 * cannot surprise a caller with a query.
 *
 * Returns the same objects with a `ranking` field attached: the final score, the
 * components that produced it, and the ones that could not be computed. That
 * last list is what turns "why is this third?" into a one-line answer.
 */
export function rank(properties, context, weights) {
  const w = weights ?? DEFAULT_WEIGHTS
  return properties
    .map((property) => {
      const components = scoreProperty(property, context)
      const present = Object.keys(components)
      // Renormalise over what exists — see property 3 in the header.
      const total = present.reduce((sum, k) => sum + (w[k] ?? 0), 0)
      const score = total > 0
        ? present.reduce((sum, k) => sum + components[k] * (w[k] ?? 0), 0) / total
        : 0
      return {
        ...property,
        ranking: {
          score: Math.round(score * 1000) / 1000,
          components: Object.fromEntries(present.map((k) => [k, Math.round(components[k] * 100) / 100])),
          skipped: COMPONENTS.filter((k) => !present.includes(k)),
        },
      }
    })
    .sort((a, b) => b.ranking.score - a.ranking.score)
}

/** The convenience wrapper: load the active profile, then rank. */
export async function rankProperties(properties, context = {}, profile = 'default') {
  return rank(properties, context, await getWeights(profile))
}
