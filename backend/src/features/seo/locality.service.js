// Locality landing pages — /rent/:city/:area.
//
// The search intent in Indian rentals is "2bhk in anna nagar", not "rentals in
// India". A page per locality is the shape that intent lands on, and the data
// for it already exists: listings carry `landmark`, and the spatial layer
// already describes the cell.
//
// THE RULE THAT MATTERS: a locality page exists only where there are listings
// to show. With ~5 real listings in production, generating a page per known
// area name would produce hundreds of near-empty pages — textbook thin content,
// which is actively penalised and would waste the crawl budget of a small site
// on nothing. `listLocalities()` is derived from live inventory, so the page
// set grows with supply instead of pretending to.
import { prisma } from '../../lib/prisma.js'
import { SUPPORTED_CITIES } from '../../config/cities.js'
import { localityBySlug, slugify } from '../localities/resolve.js'
import { GraphRepository } from '../graph/repository.js'

/** "Anna Nagar" → "anna-nagar". Re-exported from features/localities so the
 *  entity and its URL cannot disagree about a slug — they were two copies of
 *  the same function until the Locality entity existed to own it. */
export { slugify }

/**
 * Every (city, locality) pair with at least one publicly visible ACTIVE
 * listing. Used by the sitemap and to resolve a slug back to its real name.
 */
export async function listLocalities() {
  // Grouped in JS rather than by the database, because the grouping key is now
  // "the resolved Locality if there is one, else the owner's text" and SQL has
  // no clean way to express that. The row set is bounded by live ACTIVE
  // inventory — the same rows the old groupBy scanned.
  const rows = await prisma.property.findMany({
    where: {
      status: 'ACTIVE',
      // On USER, not Property — see sitemap.service.js.
      owner: { listingVisibility: 'PUBLIC' },
      city: { in: SUPPORTED_CITIES },
      // A listing needs SOME name for its area. Before the Locality entity this
      // could only be `landmark`; now a resolved locality is the better answer
      // and a listing may carry one without any landmark text at all.
      OR: [{ landmark: { not: null } }, { localityId: { not: null } }],
    },
    select: {
      city: true,
      landmark: true,
      locality: { select: { id: true, name: true, slug: true, citySlug: true, source: true } },
    },
  })

  const groups = new Map()
  for (const row of rows) {
    // The resolved entity wins. This is what merges "Koramangala",
    // "Koramangala 5th Block" and "koramangala." into one page instead of three
    // — the whole reason the entity exists.
    const name = row.locality?.name ?? row.landmark?.trim()
    const slug = row.locality?.slug ?? slugify(row.landmark)
    if (!name || !slug) continue

    const citySlug = row.locality?.citySlug ?? slugify(row.city)
    const key = row.locality?.id ?? `landmark:${citySlug}:${slug}`

    const existing = groups.get(key)
    if (existing) {
      existing.count++
      continue
    }
    groups.set(key, {
      city: row.city,
      citySlug,
      locality: name,
      localitySlug: slug,
      localityId: row.locality?.id ?? null,
      localitySource: row.locality?.source ?? null,
      count: 1,
    })
  }

  return [...groups.values()]
    .map((g) => ({ ...g, indexable: isIndexable(g) }))
    // Biggest first — it is the order the sitemap and any future index page
    // both want, and it costs nothing here.
    .sort((a, b) => b.count - a.count)
}

/**
 * Whether a locality page is worth putting in front of a search engine.
 *
 * THE RULE IS THE RESOLVER'S OWN, APPLIED ONE LAYER LATER: the map decides, not
 * the typing. A page earns indexing when its area came from an OSM admin
 * boundary — a ward, zone or municipality someone could actually search. A page
 * whose slug came from `Property.landmark` is a stranger's typing turned into a
 * URL, and on 2026-08-08 that had published, among others:
 *
 *     /rent/chennai/opp-to-pk-store
 *     /rent/chennai/ponnu-super-bazaar-avadi
 *
 * Nobody searches those. They were four of the nine live locality URLs, and on a
 * site with 55 indexable pages total they were spending real crawl budget.
 *
 * WHY NOT JUST RAISE THE COUNT. A count threshold would not have caught them —
 * it is not a volume problem. "Opp to PK store" with five listings is still
 * useless, and a boundary-resolved ward with one listing is still a place a
 * person types into Google. Quality of the KEY is the thing that separates them,
 * so that is what is measured.
 *
 * NON-INDEXABLE DOES NOT MEAN GONE. The page still resolves and still renders —
 * internal links and anything already shared keep working. It is withheld from
 * the sitemap and marked `noindex, follow`, which is the brief's own prescription
 * for below-threshold pages.
 *
 * TIGHTENED 2026-08-08, and the first version of this rule is why. It asked only
 * "did this come from the map", which killed `opp-to-pk-store` — and then the
 * backfill published these instead:
 *
 *     /rent/chennai/ward-137      /rent/mumbai/h-w-ward
 *     /rent/chennai/ward-105      /rent/bengaluru/ward-58
 *     /rent/hyderabad/hyderabad   ← admin_level 8 fell back to the CITY name
 *
 * All correct. None searchable. Provenance was a PROXY for "a place someone
 * types into Google", and for Indian OSM data the proxy breaks: wards are
 * mostly numbered, and a municipality is named after its city. So the rule now
 * asks the real question directly — is this the kind of name a renter uses —
 * via `source`, which distinguishes a neighbourhood (`PLACE`, from
 * `place=suburb|neighbourhood|quarter`) from an administrative unit
 * (`BOUNDARY`) and from the owner's typing (`LANDMARK`).
 *
 * `name === city` is belt-and-braces on top: a locality page whose scope is the
 * whole city duplicates `/rent/:citySlug`, and that is a duplicate-content
 * problem regardless of which source produced it.
 */
export function isIndexable(group) {
  if (group.localityId === null) return false
  if (group.localitySource !== 'PLACE') return false
  // A locality named after its own city is the city page under a second URL.
  return slugify(group.locality) !== slugify(group.city)
}

/**
 * One locality page's data. Returns null when the pair has no live listings,
 * which the route turns into a 404 rather than an empty page — see the rule at
 * the top of this file.
 */
export async function getLocality(citySlug, localitySlug) {
  const all = await listLocalities()
  let match = all.find((l) => l.citySlug === citySlug && l.localitySlug === localitySlug)

  // No direct hit — try resolving the slug as an ALIAS. This is what keeps a URL
  // alive after a listing's area is resolved to its canonical name:
  // /rent/bengaluru/koramangala-5th-block was published while that string was
  // the identity, and it must keep landing on the Koramangala page rather than
  // 404ing because we got better at naming places.
  if (!match) {
    const canonical = await localityBySlug(citySlug, localitySlug)
    if (canonical) match = all.find((l) => l.localityId === canonical.id)
  }
  if (!match) return null

  const properties = await prisma.property.findMany({
    where: {
      status: 'ACTIVE',
      owner: { listingVisibility: 'PUBLIC' },
      // Keyed by the entity when there is one, so the page shows every listing
      // in the area however its owner spelled it. Falls back to the exact
      // landmark text for listings not yet resolved — the same behaviour as
      // before, which is what the page had for all of them until today.
      ...(match.localityId
        ? { localityId: match.localityId }
        : { city: match.city, landmark: match.locality }),
    },
    select: {
      id: true, title: true, type: true, bhk: true, rent: true, deposit: true,
      pricingModel: true, nightlyRate: true, furnished: true, area: true,
      city: true, landmark: true, updatedAt: true,
      images: { where: { isPrimary: true }, select: { url: true }, take: 1 },
    },
    orderBy: { updatedAt: 'desc' },
    take: 60,
  })

  const rents = properties.map((p) => Number(p.rent)).filter((n) => Number.isFinite(n) && n > 0)

  // Sideways in the hierarchy: areas whose listings resemble this area's,
  // via the graph's SIMILAR_TO edges. `GraphRepository.findRelatedAreas` already
  // existed for exactly this — graph.routes.js notes it was left without a public
  // route because it had no consumer. This page is the consumer.
  //
  // TWO FILTERS, and the second is the one that matters. Every result is a real
  // `Locality` entity, so all of them pass the indexability rule by
  // construction. But a Locality can exist with no ACTIVE listings TODAY, and
  // its page would 404 — so the candidates are intersected with the live page
  // set before any of them becomes a link. Linking to a 404 is worse than not
  // linking.
  //
  // Returns [] until the §1.6g backfill runs: it joins on `Property.localityId`,
  // which is null on every production row. Nothing renders, nothing breaks.
  const nearby = match.localityId
    ? (await GraphRepository.findRelatedAreas(match.localityId, { limit: 6 }))
      .filter((n) => all.some((l) => l.localityId === n.id))
      .map((n) => ({ locality: n.name, localitySlug: n.slug, citySlug: n.citySlug }))
    : []

  // `localityId` is a grouping key, not part of the page's contract — dropped so
  // the public JSON keeps exactly the shape it had before the entity existed.
  //
  // `indexable` deliberately SURVIVES into both consumers (added 2026-08-08).
  // The prerender route needs it to decide `noindex`, and exposing it on the
  // public JSON is additive and honest — it is a true statement about the page,
  // and the SEO health view will want to read it from the same place rather
  // than re-deriving the rule and drifting from it.
  const { localityId: _localityId, ...page } = match

  return {
    ...page,
    properties,
    nearby,
    // A median, not an average: one ₹4Cr plot in a street of ₹15k flats makes
    // an average meaningless, and this number is the page's headline fact.
    medianRent: rents.length ? median(rents) : null,
    types: [...new Set(properties.map((p) => p.type))],
  }
}

function median(sorted) {
  const xs = [...sorted].sort((a, b) => a - b)
  const mid = Math.floor(xs.length / 2)
  return xs.length % 2 ? xs[mid] : Math.round((xs[mid - 1] + xs[mid]) / 2)
}

/**
 * Is this listing one an anonymous visitor can open? The same rule the sitemap
 * advertises, in one place so the two cannot disagree — a sitemap URL that
 * 404s is worse than no URL at all.
 */
export async function isPubliclyListed(id) {
  const row = await prisma.property.findFirst({
    where: { id, status: 'ACTIVE', owner: { listingVisibility: 'PUBLIC' } },
    select: { id: true },
  })
  return Boolean(row)
}
