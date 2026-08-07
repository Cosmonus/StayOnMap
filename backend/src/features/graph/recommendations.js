// "Homes for you" — where the graph, the preferences and the ranking meet.
//
// The pipeline, and every step of it is deterministic:
//
//   1. Derive what this person has shown they want (preferences.js).
//   2. Gather CANDIDATES from the graph — the neighbours of what they saved and
//      visited — rather than from a filter over the whole table. This is the
//      part that needs a graph: "listings like the ones you kept" is a two-hop
//      walk, and expressing it as a WHERE clause means first deciding what
//      "like" means in SQL, which is the thing the similarity scorer exists to
//      answer.
//   3. Fall back to their preferred areas and types when the graph is thin —
//      which it is for a new user, and for a young platform.
//   4. Rank the candidates (ranking.js) with the configured weights.
//
// WHAT IS EXCLUDED, AND WHY IT MATTERS MORE THAN WHAT IS INCLUDED:
//   • Listings they already saved. Recommending something already on their
//     shortlist is the clearest possible signal that nothing is being learned.
//   • Their OWN listings. An owner is not a candidate tenant for their own flat.
//   • Anything not ACTIVE, so no recommendation leads to a page they cannot open.
//
// It returns WHY each listing is there. A recommendation nobody can interrogate
// is indistinguishable from an ad.
import { prisma } from '../../lib/prisma.js'
import { getUserPreferences } from './preferences.js'
import { rankProperties } from './ranking.js'
import { intelError, intelLog } from '../../lib/intelLog.js'

const CANDIDATE_CAP = 200

const CARD_FIELDS = {
  id: true, title: true, type: true, bhk: true, sharing: true, rent: true,
  pricingModel: true, nightlyRate: true, city: true, landmark: true,
  lat: true, lng: true, localityId: true, furnished: true, area: true,
  extent: true, extentUnit: true, carpetArea: true, maxGuests: true,
  createdAt: true, ownerId: true,
  images: { where: { isPrimary: true }, select: { url: true }, take: 1 },
  trustScore: { select: { badge: true, overallScore: true } },
}

/**
 * @returns {Promise<{items, basis, preferences}>}
 *   `basis` says how the candidates were found, so an empty or odd result is
 *   explainable rather than mysterious.
 */
export async function getRecommendations(userId, { limit = 12, center = null, commute = null } = {}) {
  const started = Date.now()
  try {
    const preferences = await getUserPreferences(userId)

    // What they have already engaged with — the seeds, and simultaneously the
    // set that must not be recommended back to them.
    const [saved, appointments] = await Promise.all([
      prisma.savedListing.findMany({ where: { userId }, select: { propertyId: true }, take: 100 }),
      prisma.appointment.findMany({ where: { tenantId: userId }, select: { propertyId: true }, take: 50 }),
    ])

    const seedIds = [...new Set([...saved.map((s) => s.propertyId), ...appointments.map((a) => a.propertyId)])]
    const excludeIds = new Set(seedIds)

    // ── 1. Graph hop: what the seeds resemble.
    const viaGraph = seedIds.length
      ? await prisma.propertySimilarity.findMany({
        where: {
          propertyId: { in: seedIds },
          similarId: { notIn: seedIds },
          similar: { status: 'ACTIVE', ownerId: { not: userId } },
        },
        select: { similarId: true, score: true },
        orderBy: { score: 'desc' },
        take: CANDIDATE_CAP,
      })
      : []

    const graphIds = [...new Set(viaGraph.map((r) => r.similarId))]

    // NOTHING KNOWN ABOUT THIS PERSON → NO RECOMMENDATIONS.
    //
    // Without this guard the preference query below has no city or type filter,
    // so it returns the newest ACTIVE listings — which the response would then
    // label `matches_your_search`. That is a false claim about somebody we know
    // nothing about, and "the newest listings" is already what the map shows.
    // The brief's rule applies: when the relationship cannot be established,
    // say so rather than substituting something that looks like an answer.
    if (!seedIds.length && !preferences) {
      return { items: [], basis: { seeds: 0, viaGraph: 0, viaPreference: 0, reason: 'nothing_known_yet' }, preferences: null }
    }

    // ── 2. Preference fallback. Somebody with seeds but no similarity edges yet
    // — a young platform, or a listing whose neighbours have not been computed —
    // would otherwise see nothing despite us knowing what they like.
    const needed = CANDIDATE_CAP - graphIds.length
    const viaPreference = needed > 0
      ? await prisma.property.findMany({
        where: {
          status: 'ACTIVE',
          ownerId: { not: userId },
          id: { notIn: [...excludeIds, ...graphIds] },
          ...(preferences?.cities?.length ? { city: { in: preferences.cities } } : {}),
          ...(preferences?.types?.length ? { type: { in: preferences.types } } : {}),
        },
        select: { id: true },
        orderBy: { createdAt: 'desc' },
        take: needed,
      })
      : []

    const candidateIds = [...new Set([...graphIds, ...viaPreference.map((p) => p.id)])]
    if (!candidateIds.length) {
      return { items: [], basis: { seeds: seedIds.length, viaGraph: 0, viaPreference: 0 }, preferences }
    }

    const candidates = await prisma.property.findMany({
      where: { id: { in: candidateIds } },
      select: CARD_FIELDS,
    })

    const ranked = await rankProperties(candidates, {
      center: center ?? null,
      // Budget comes from what they engaged with, not from a filter they typed —
      // this surface has no filter bar.
      budget: preferences?.budget ?? null,
      commute,
      preferences,
    })

    const byId = new Map(viaGraph.map((r) => [r.similarId, r.score]))
    const items = ranked.slice(0, limit).map((property) => ({
      ...property,
      why: {
        // Which arm found it. "Because it is like one you saved" and "because
        // it is new in an area you browse" are different claims and should not
        // be presented as the same one.
        source: byId.has(property.id) ? 'similar_to_saved' : 'matches_your_search',
        similarityToSaved: byId.get(property.id) ?? null,
        ranking: property.ranking,
      },
    }))

    intelLog('graph.recommendations', {
      userId, seeds: seedIds.length, viaGraph: graphIds.length,
      viaPreference: viaPreference.length, returned: items.length, ms: Date.now() - started,
    })

    return {
      items,
      basis: { seeds: seedIds.length, viaGraph: graphIds.length, viaPreference: viaPreference.length },
      preferences,
    }
  } catch (err) {
    intelError('graph.recommendations_failed', err, { userId })
    // An empty list, never a 500. A dashboard section that cannot load is a
    // worse outcome than one with nothing in it yet.
    return { items: [], basis: { error: true }, preferences: null }
  }
}
