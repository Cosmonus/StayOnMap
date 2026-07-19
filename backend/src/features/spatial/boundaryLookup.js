// Which administrative areas contain this point?
//
// The bbox-then-exact pattern PoiIndex already uses, applied to polygons: an
// indexed range scan narrows thousands of boundaries to a handful, then
// ray-casting in JS decides. This is the whole of "no PostGIS" for this
// dataset — see docs/spatial-intelligence.md §3 for what would change that.
import { prisma } from '../../lib/prisma.js'
import { cacheGet, cacheSet } from '../../lib/redis.js'
import { intelError } from '../../lib/intelLog.js'
import { pointInGeometry } from './boundaryGeometry.js'

// Boundaries change on the timescale of municipal reorganisations. The cache
// exists to spare the JSON-decoding of large polygons, not to track updates.
const LOOKUP_TTL_S = 24 * 60 * 60

/**
 * What OSM's admin levels mean here.
 *
 * Kept as OSM's own numbering rather than remapped: these numbers are what the
 * source data, every other OSM consumer and the seeder all speak, and a
 * private renumbering would need translating back on every refetch. The labels
 * are India-specific because the levels genuinely mean different things per
 * country — this map is the place that assumption lives.
 */
export const ADMIN_LEVEL_LABELS = {
  4: 'State',
  5: 'Division',
  6: 'District',
  7: 'Sub-district',
  8: 'Municipality',
  9: 'Zone',
  10: 'Ward',
}

/**
 * Every boundary containing a point, most specific first.
 *
 * Returns [] for "we looked and found none" and null for "we could not look" —
 * the same distinction providers.js draws, and for the same reason: a cell with
 * no boundary data must not render as a place with no ward.
 *
 * @returns {Array<{osmId, name, nameLocal, adminLevel, label}>|null}
 */
export async function boundariesAt(lat, lng) {
  const key = `spatial:bnd:${Math.round(lat * 1000) / 1000},${Math.round(lng * 1000) / 1000}`
  const cached = await cacheGet(key)
  if (cached) return cached.v

  try {
    // The prefilter. A point is only inside a boundary whose bbox contains it,
    // so this is an exact narrowing, not a heuristic one.
    const candidates = await prisma.boundary.findMany({
      where: {
        minLat: { lte: lat }, maxLat: { gte: lat },
        minLng: { lte: lng }, maxLng: { gte: lng },
      },
      select: { osmId: true, name: true, nameLocal: true, adminLevel: true, geometry: true },
      // A point genuinely sits inside a nested stack of maybe six boundaries.
      // The cap is a runaway guard, not an expected limit.
      take: 100,
    })

    const hits = candidates
      .filter((b) => pointInGeometry({ lat, lng }, b.geometry))
      .map(({ geometry: _geometry, ...b }) => ({
        ...b,
        label: ADMIN_LEVEL_LABELS[b.adminLevel] ?? `Admin level ${b.adminLevel}`,
      }))
      // Most specific first — a ward is more useful than the state it sits in.
      .sort((a, b) => b.adminLevel - a.adminLevel)

    await cacheSet(key, { v: hits }, LOOKUP_TTL_S)
    return hits
  } catch (err) {
    intelError('spatial.boundary_lookup_failed', err, {})
    return null
  }
}
