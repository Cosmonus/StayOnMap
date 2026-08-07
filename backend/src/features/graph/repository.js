// GraphRepository — the one place that knows the graph is PostgreSQL.
//
// WHAT THIS ABSTRACTS, AND WHAT IT DELIBERATELY DOES NOT.
//
// The brief asks for a repository so business logic is not coupled to a graph
// vendor. It lists createNode/updateNode alongside the traversals. Those two are
// not here, and leaving them out is the point rather than an omission: the same
// brief says PostgreSQL remains authoritative for transactional data, so a
// property is created by properties.service.js through Prisma, inside a
// transaction, with validation and ownership checks. Wrapping that in
// `createNode()` would add an indirection that every writer would have to
// bypass anyway the moment it needed a transaction — an abstraction nobody can
// use is worse than none.
//
// What genuinely WOULD change if the backend changed is the reading of
// relationships, and that is exactly what lives here: findRelated, findNearby,
// findSimilar, traverse.
//
// HOW TRAVERSAL WORKS. The "GraphEdge" view (migration 20260807060000) projects
// six differently-shaped relationships — foreign keys, join tables, a
// similarity table — into one (src, dst, type) shape with "Type:id" node ids. A
// recursive CTE walks it. That is the whole of "Postgres is the graph": the
// edges were always there; what was missing was a uniform way to follow them.
//
// EVERY TRAVERSAL IS BOUNDED. Depth and row count are clamped here, not left to
// the caller, because an unbounded walk over a well-connected graph is a way to
// take the database down from a query string.
import { prisma } from '../../lib/prisma.js'
import { boundsFilter } from '../../utils/geo.js'
import { getSimilar } from './similarity.js'
import { intelError } from '../../lib/intelLog.js'

/** Hard ceilings. A caller may ask for less; it may not ask for more. */
export const MAX_DEPTH = 3
export const MAX_ROWS = 200

const clamp = (value, fallback, max) => {
  const n = Number(value)
  return Number.isFinite(n) && n > 0 ? Math.min(Math.floor(n), max) : fallback
}

/** "Property:abc" → { type: 'Property', id: 'abc' } */
export function parseNodeId(nodeId) {
  const raw = String(nodeId ?? '')
  const at = raw.indexOf(':')
  if (at <= 0) return null
  return { type: raw.slice(0, at), id: raw.slice(at + 1) }
}

export const nodeId = (type, id) => `${type}:${id}`

/**
 * One hop out from a node.
 *
 * Undirected by default: relationships are stored in whichever direction was
 * natural to write, and a caller asking "what is this connected to" does not
 * care that SAVED points from user to property. Pass `direction: 'out'` when the
 * arrow itself is the question.
 */
export async function findRelated(from, { types = null, direction = 'both', limit = 50 } = {}) {
  const node = parseNodeId(from)
  if (!node) return []
  const take = clamp(limit, 50, MAX_ROWS)

  try {
    const rows = await prisma.$queryRaw`
      SELECT dst AS node, type, 'out' AS direction
        FROM "GraphEdge"
       WHERE src = ${from}
         AND (${direction} = 'both' OR ${direction} = 'out')
         AND (${types}::text[] IS NULL OR type = ANY(${types}::text[]))
       UNION ALL
      SELECT src AS node, type, 'in' AS direction
        FROM "GraphEdge"
       WHERE dst = ${from}
         AND (${direction} = 'both' OR ${direction} = 'in')
         AND (${types}::text[] IS NULL OR type = ANY(${types}::text[]))
       LIMIT ${take}
    `
    return rows
  } catch (err) {
    intelError('graph.find_related_failed', err, { from })
    return []
  }
}

/**
 * Bounded breadth-first walk from a node.
 *
 * Returns each reachable node with the depth it was found at and the path taken
 * to reach it. The path is what makes a result explainable — "this listing,
 * because you saved one by the same owner" is a sentence you can only write if
 * you kept the route.
 *
 * Cycles are cut by tracking the visited set inside the CTE: without it, a
 * SIMILAR_TO edge pair walks forever.
 */
export async function traverse(from, { depth = 2, types = null, limit = 100 } = {}) {
  if (!parseNodeId(from)) return []
  const maxDepth = clamp(depth, 2, MAX_DEPTH)
  const take = clamp(limit, 100, MAX_ROWS)

  try {
    return await prisma.$queryRaw`
      WITH RECURSIVE walk AS (
        SELECT ${from}::text AS node,
               0             AS depth,
               ARRAY[${from}::text] AS path,
               NULL::text    AS via
         UNION ALL
        SELECT e.dst,
               w.depth + 1,
               w.path || e.dst,
               e.type
          FROM walk w
          JOIN (
                SELECT src, dst, type FROM "GraphEdge"
                 UNION ALL
                -- Both directions, so a walk can arrive at a property from the
                -- user who saved it as easily as the other way round.
                SELECT dst, src, type FROM "GraphEdge"
               ) e ON e.src = w.node
         WHERE w.depth < ${maxDepth}
           -- The cycle cut. Without it a SIMILAR_TO pair recurses to the limit.
           AND NOT (e.dst = ANY(w.path))
           AND (${types}::text[] IS NULL OR e.type = ANY(${types}::text[]))
      )
      SELECT node, depth, path, via
        FROM walk
       WHERE depth > 0
       ORDER BY depth, node
       LIMIT ${take}
    `
  } catch (err) {
    intelError('graph.traverse_failed', err, { from, depth: maxDepth })
    return []
  }
}

/**
 * Listings near a point.
 *
 * A bbox prefilter, the same pattern the POI scan uses and for the same reason:
 * there is no PostGIS here by design, and an indexed range scan plus a distance
 * check does the job at this scale. See docs/spatial-intelligence.md §3.
 */
export async function findNearby({ lat, lng, radiusM = 3_000, limit = 20, excludeId = null } = {}) {
  if (lat == null || lng == null) return []
  const take = clamp(limit, 20, MAX_ROWS)

  // Degrees per metre, latitude-corrected so the box is not wildly wide near
  // the equator and narrow further north.
  const dLat = radiusM / 111_320
  const dLng = radiusM / (111_320 * Math.max(0.2, Math.cos((Number(lat) * Math.PI) / 180)))

  return prisma.property.findMany({
    where: {
      status: 'ACTIVE',
      ...(excludeId ? { id: { not: excludeId } } : {}),
      ...boundsFilter({
        swLat: Number(lat) - dLat, neLat: Number(lat) + dLat,
        swLng: Number(lng) - dLng, neLng: Number(lng) + dLng,
      }),
    },
    select: {
      id: true, title: true, type: true, bhk: true, rent: true, pricingModel: true,
      nightlyRate: true, lat: true, lng: true, city: true, landmark: true, localityId: true,
      createdAt: true,
      images: { where: { isPrimary: true }, select: { url: true }, take: 1 },
      trustScore: { select: { badge: true, overallScore: true } },
    },
    take,
  })
}

/** Stored SIMILAR_TO neighbours. Delegated so there is one scorer, not two. */
export async function findSimilar(propertyId, limit = 6) {
  return getSimilar(propertyId, clamp(limit, 6, MAX_ROWS))
}

/**
 * Areas related to an area.
 *
 * Two localities are related when listings in one are similar to listings in the
 * other — a substitution signal drawn from the inventory itself rather than from
 * a hand-drawn map of which neighbourhoods "go together". It needs no new data,
 * and it improves as the SIMILAR_TO edges do.
 */
export async function findRelatedAreas(localityId, { limit = 5 } = {}) {
  if (!localityId) return []
  const take = clamp(limit, 5, 50)

  try {
    return await prisma.$queryRaw`
      SELECT l."id", l."name", l."slug", l."citySlug", COUNT(*)::int AS "sharedMatches"
        FROM "PropertySimilarity" ps
        JOIN "Property" a ON a."id" = ps."propertyId"
        JOIN "Property" b ON b."id" = ps."similarId"
        JOIN "Locality"  l ON l."id" = b."localityId"
       WHERE a."localityId" = ${localityId}
         AND b."localityId" IS NOT NULL
         AND b."localityId" <> ${localityId}
       GROUP BY l."id", l."name", l."slug", l."citySlug"
       ORDER BY COUNT(*) DESC
       LIMIT ${take}
    `
  } catch (err) {
    intelError('graph.related_areas_failed', err, { localityId })
    return []
  }
}

/**
 * The repository object the brief asks for.
 *
 * Exported as a namespace so a caller depends on the SHAPE rather than on the
 * module path of each function — which is what makes swapping the backend a
 * change to one file instead of a hundred imports.
 */
export const GraphRepository = {
  findRelated,
  findNearby,
  findSimilar,
  findRelatedAreas,
  traverse,
  parseNodeId,
  nodeId,
}
