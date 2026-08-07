// Resolving a listing to the area it is IN.
//
// Until 2026-08-07 a "locality" was `slugify(Property.landmark)` — owner-typed
// free text, re-derived per request. This turns it into an entity with a stable
// id, so everything downstream (landing pages, demand, later similarity and
// recommendations) can attach to one thing instead of to a spelling.
//
// TWO RULES, both load-bearing:
//
//   1. THE MAP DECIDES, NOT THE TYPING. When OSM admin boundaries cover the
//      listing's coordinates, the most specific one wins — ward, then zone, then
//      municipality. The owner's text becomes an ALIAS, never the identity. An
//      owner typing "Prime Location" does not get to invent an area.
//
//   2. NEVER GUESS. No boundary covering the point means we fall back to the
//      owner's text (source LANDMARK), and if there is no usable text either we
//      resolve to nothing and the listing keeps reading through `landmark`
//      exactly as before. Ahmedabad and Surat genuinely have no ward/zone
//      polygons in OSM, so LANDMARK is a permanent state for them, not a
//      temporary one — which is why `source` is recorded rather than assumed.
import { prisma } from '../../lib/prisma.js'
import { boundariesAt } from '../spatial/boundaryLookup.js'
import { intelError, intelLog } from '../../lib/intelLog.js'

/** "Anna Nagar" → "anna-nagar". Same function as the SEO layer's, re-exported
 *  from here so the entity and its URL can never disagree about a slug. */
export const slugify = (s) => String(s ?? '')
  .toLowerCase()
  .normalize('NFKD')
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')

/**
 * Which admin levels are a "locality" for our purposes, most specific first.
 *
 * Ward (10) is the unit Indian civic data is published against and the one a
 * resident actually names. District (6) and above are deliberately excluded:
 * "Bengaluru Urban" is not an area anyone searches a home in, and resolving to
 * it would produce one enormous locality per city — worse than no entity at all,
 * because it would look like it worked.
 */
const LOCALITY_LEVELS = [10, 9, 8]

/**
 * Resolve one listing to a Locality row, creating it on first sight.
 *
 * Never throws — it is called fire-and-forget from the property write path, and
 * a listing that fails to resolve must still be a listing.
 *
 * @param {{id: string, city: string, lat: any, lng: any, landmark: string|null}} property
 * @returns {Promise<string|null>} the Locality id, or null if unresolvable
 */
export async function resolveLocality(property) {
  try {
    const { city, lat, lng, landmark } = property
    if (!city) return null

    const citySlug = slugify(city)
    const resolved = await fromBoundaries(lat, lng) ?? fromLandmark(landmark)
    if (!resolved) return null

    const locality = await upsertLocality({ ...resolved, city, citySlug, lat, lng })
    if (!locality) return null

    // The owner's own words for this place, when they differ from the canonical
    // name. This is what stops a canonical rename from 404ing a URL the earlier
    // spelling had already published.
    if (landmark) await recordAlias(locality, landmark, citySlug)

    return locality.id
  } catch (err) {
    intelError('locality.resolve_failed', err, { propertyId: property?.id })
    return null
  }
}

/** The map's answer. Returns null for "we could not look" AND for "nothing
 *  covers this point" — both mean the same thing to the caller: fall back. */
async function fromBoundaries(lat, lng) {
  if (lat == null || lng == null) return null

  const hits = await boundariesAt(Number(lat), Number(lng))
  // `null` is "could not look" (no boundary data seeded, lookup failed); `[]` is
  // "looked, found none". boundaryLookup.js draws that distinction deliberately
  // and it is preserved here only in the log — the fallback is the same.
  if (!hits?.length) return null

  for (const level of LOCALITY_LEVELS) {
    const hit = hits.find((b) => b.adminLevel === level && b.name?.trim())
    if (hit) {
      return {
        source: 'BOUNDARY',
        name: hit.name.trim(),
        slug: slugify(hit.name),
        osmId: hit.osmId,
        adminLevel: hit.adminLevel,
      }
    }
  }
  return null
}

/** The owner's answer, used only when the map has none. */
function fromLandmark(landmark) {
  const name = String(landmark ?? '').trim()
  const slug = slugify(name)
  if (!name || !slug) return null
  return { source: 'LANDMARK', name, slug, osmId: null, adminLevel: null }
}

/**
 * Find-or-create, keyed by osmId for boundary localities and by (citySlug, slug)
 * for landmark ones.
 *
 * The osmId lookup comes FIRST and is what makes a later boundary seed an
 * upgrade rather than a duplicate: a landmark-derived "Koramangala" already
 * sitting at that slug gets promoted in place — its id, and therefore every
 * listing pointing at it, survives.
 */
async function upsertLocality({ source, name, slug, osmId, adminLevel, city, citySlug, lat, lng }) {
  if (osmId) {
    const byOsm = await prisma.locality.findUnique({ where: { osmId } })
    if (byOsm) return byOsm
  }

  const bySlug = await prisma.locality.findUnique({
    where: { citySlug_slug: { citySlug, slug } },
  })

  if (bySlug) {
    // Promote a LANDMARK row the first time the map can confirm it. Never the
    // reverse: a boundary-backed locality is not downgraded because one later
    // listing happened to fall outside every polygon.
    if (source === 'BOUNDARY' && bySlug.source === 'LANDMARK') {
      intelLog('locality.promoted', { localityId: bySlug.id, slug, osmId })
      return prisma.locality.update({
        where: { id: bySlug.id },
        data: { source, osmId, adminLevel, name },
      })
    }
    return bySlug
  }

  return prisma.locality.create({
    data: {
      city, citySlug, name, slug, source, osmId, adminLevel,
      lat: lat ?? null,
      lng: lng ?? null,
    },
  })
}

/**
 * Record what the owner called this place.
 *
 * Skipped when the alias slug equals the locality's own slug (nothing to learn)
 * or when another locality in the same city already owns that alias slug — the
 * unique constraint would reject it anyway, and the first claimant winning is
 * the right outcome: an ambiguous alias must resolve to one page, not flip
 * between two.
 */
async function recordAlias(locality, landmark, citySlug) {
  const text = String(landmark).trim()
  const slug = slugify(text)
  if (!text || !slug || slug === locality.slug) return

  try {
    await prisma.localityAlias.create({
      data: { localityId: locality.id, text, slug, citySlug },
    })
  } catch {
    // Unique violation — already recorded, or claimed by a sibling locality.
    // Both are fine and neither is worth a log line on a write path.
  }
}

/**
 * Resolve one property and store the link. Idempotent — running it twice is a
 * no-op, which is what makes it safe to call from every write path and from the
 * backfill script.
 *
 * Fire-and-forget by design: it is a polygon lookup, and a create must not wait
 * on one. The window where a fresh listing has no locality is exactly the window
 * where readers fall back to `landmark`, which is what they did before this
 * existed.
 */
export async function syncPropertyLocality(propertyId) {
  try {
    const property = await prisma.property.findUnique({
      where: { id: propertyId },
      select: { id: true, city: true, lat: true, lng: true, landmark: true, localityId: true },
    })
    if (!property) return null

    const localityId = await resolveLocality(property)
    if (!localityId || localityId === property.localityId) return property.localityId

    await prisma.property.update({ where: { id: propertyId }, data: { localityId } })
    return localityId
  } catch (err) {
    intelError('locality.sync_failed', err, { propertyId })
    return null
  }
}

/**
 * Resolve a URL slug to its canonical locality: the locality's own slug first,
 * then an alias.
 *
 * Order matters. A locality's own slug must win over another locality's alias
 * for the same string, or publishing a new area could silently steal an
 * existing page's URL.
 */
export async function localityBySlug(citySlug, slug) {
  const direct = await prisma.locality.findUnique({
    where: { citySlug_slug: { citySlug, slug } },
  })
  if (direct) return direct

  const alias = await prisma.localityAlias.findUnique({
    where: { citySlug_slug: { citySlug, slug } },
    include: { locality: true },
  })
  return alias?.locality ?? null
}
