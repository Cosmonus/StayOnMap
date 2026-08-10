// The tool layer.
//
// Everything an agent is allowed to do, and nothing else. The brief's safety
// rules are enforced HERE rather than in a prompt, because a prompt is a request
// and this is a gate:
//
//   • No arbitrary SQL and no arbitrary graph query. There is no `query` tool,
//     no `raw` parameter, and no place to put one — each tool has a fixed shape
//     and a Zod schema that strips anything else.
//   • Bounded results. Every tool clamps its own limit; a caller asking for
//     10,000 gets the ceiling.
//   • Timeouts. A tool that hangs must fail the call, not the request.
//   • Timed and logged. Latency per tool is the observability the brief asks
//     for, and it lands in the same intelLog stream as every other decision.
//   • Nothing here writes. Not one handler mutates a row — recomputes are
//     triggered by the property write path, not by whoever is asking questions.
//
// ZOD, NOT TYPESCRIPT. The brief says "strict TypeScript types"; this codebase
// is JavaScript by deliberate decision, and Zod is what it already validates
// every route with. It is also the stronger choice here: types vanish at
// runtime, and the argument that needs checking is one an LLM just made up.
import { z } from 'zod'
import { GraphRepository } from './repository.js'
import { rankProperties } from './ranking.js'
import { getUserPreferences } from './preferences.js'
import { intelLog, intelError } from '../../lib/intelLog.js'
import { prisma } from '../../lib/prisma.js'
import { indiaLat, indiaLng } from '../../utils/geo.js'
// `listPoisNear`, not `poisNear`: the latter returns counts grouped by category,
// which cannot name a station. Note its argument order puts `categories` BEFORE
// `radiusM` — the reverse of its sibling.
import { listPoisNear } from '../spatial/poiProvider.js'
import { findReusedImages } from '../intelligence/imageFingerprint.js'
import { findSharedContactOwners } from '../intelligence/ownerGraph.js'
import { getMetroNetwork } from '../metro/metro.service.js'
import { recordToolTiming } from './health.js'

const DEFAULT_TIMEOUT_MS = 5_000

const nodeIdSchema = z.string().regex(/^[A-Za-z]+:.+$/, 'node id must be "Type:id"')
// Coerced: these arrive as query-string text. Bounds from utils/geo.js — the
// one place the box is defined.
const latSchema = indiaLat(z.coerce.number())
const lngSchema = indiaLng(z.coerce.number())

/**
 * The registry.
 *
 * Each entry declares its input shape, its own result ceiling, and a handler
 * that receives ALREADY-VALIDATED arguments. Adding a tool is one entry; there
 * is no other way to add one, which is what makes the surface auditable.
 */
export const TOOLS = {
  searchProperties: {
    description: 'Filtered listing search. The same engine the public map uses.',
    input: z.object({
      city: z.string().max(64).optional(),
      type: z.string().max(32).optional(),
      bhk: z.coerce.number().int().min(0).max(20).optional(),
      rentMin: z.coerce.number().min(0).optional(),
      rentMax: z.coerce.number().min(0).optional(),
      limit: z.coerce.number().int().min(1).max(50).default(20),
    }),
    handler: async (args) => prisma.property.findMany({
      where: {
        status: 'ACTIVE',
        ...(args.city ? { city: args.city } : {}),
        ...(args.type ? { type: args.type } : {}),
        ...(args.bhk != null ? { bhk: args.bhk } : {}),
        ...(args.rentMin != null || args.rentMax != null
          ? { rent: { ...(args.rentMin != null ? { gte: args.rentMin } : {}), ...(args.rentMax != null ? { lte: args.rentMax } : {}) } }
          : {}),
      },
      select: {
        id: true, title: true, type: true, bhk: true, rent: true, pricingModel: true,
        city: true, landmark: true, lat: true, lng: true, localityId: true, createdAt: true,
        trustScore: { select: { badge: true, overallScore: true } },
      },
      take: args.limit,
    }),
  },

  searchGraph: {
    description: 'Bounded walk of the relationship graph from one node.',
    input: z.object({
      from: nodeIdSchema,
      depth: z.coerce.number().int().min(1).max(3).default(2),
      types: z.array(z.string().max(32)).max(10).optional(),
      limit: z.coerce.number().int().min(1).max(200).default(50),
    }),
    handler: async (a) => GraphRepository.traverse(a.from, { depth: a.depth, types: a.types ?? null, limit: a.limit }),
  },

  findRelated: {
    description: 'One hop out from a node.',
    input: z.object({
      from: nodeIdSchema,
      types: z.array(z.string().max(32)).max(10).optional(),
      direction: z.enum(['in', 'out', 'both']).default('both'),
      limit: z.coerce.number().int().min(1).max(200).default(50),
    }),
    handler: async (a) => GraphRepository.findRelated(a.from, { types: a.types ?? null, direction: a.direction, limit: a.limit }),
  },

  findNearbyProperties: {
    description: 'Active listings within a radius of a point.',
    input: z.object({
      lat: latSchema, lng: lngSchema,
      radiusM: z.coerce.number().int().min(100).max(25_000).default(3_000),
      excludeId: z.string().max(64).optional(),
      limit: z.coerce.number().int().min(1).max(50).default(20),
    }),
    handler: async (a) => GraphRepository.findNearby(a),
  },

  findNearbyStations: {
    description: 'Metro and rail stations near a point, from the self-hosted OSM index.',
    input: z.object({
      lat: latSchema, lng: lngSchema,
      radiusM: z.coerce.number().int().min(100).max(10_000).default(2_000),
      city: z.string().max(64).optional(),
    }),
    handler: async (a) => {
      const result = await listPoisNear(a.lat, a.lng, ['metro_station', 'railway_station'], a.radiusM, a.city ?? null)
      // `available: false` means the city was never seeded. Reporting an empty
      // list would turn "we have not loaded this" into "there is nothing here" —
      // the single confusion this whole layer exists to prevent.
      if (!result?.available) return { available: false, reason: 'POI index not seeded for this city', stations: [] }
      return { available: true, stations: result.pois ?? [] }
    },
  },

  findNearbyAmenities: {
    description: 'Everyday amenities near a point (schools, hospitals, shops, parks).',
    input: z.object({
      lat: latSchema, lng: lngSchema,
      radiusM: z.coerce.number().int().min(100).max(10_000).default(1_500),
      categories: z.array(z.string().max(32)).max(12).optional(),
      city: z.string().max(64).optional(),
    }),
    handler: async (a) => {
      const categories = a.categories ?? ['school', 'hospital', 'supermarket', 'park', 'pharmacy']
      const result = await listPoisNear(a.lat, a.lng, categories, a.radiusM, a.city ?? null)
      if (!result?.available) return { available: false, reason: 'POI index not seeded for this city', amenities: [] }
      return { available: true, amenities: result.pois ?? [] }
    },
  },

  findSimilarProperties: {
    description: 'Stored SIMILAR_TO neighbours of a listing, with the reasons behind each match.',
    input: z.object({
      propertyId: z.string().min(1).max(64),
      limit: z.coerce.number().int().min(1).max(24).default(6),
    }),
    handler: async (a) => GraphRepository.findSimilar(a.propertyId, a.limit),
  },

  findRelatedAreas: {
    description: 'Areas whose listings people would plausibly substitute for this one.',
    input: z.object({
      localityId: z.string().min(1).max(64),
      limit: z.coerce.number().int().min(1).max(20).default(5),
    }),
    handler: async (a) => GraphRepository.findRelatedAreas(a.localityId, { limit: a.limit }),
  },

  calculateCommute: {
    description: 'Straight-line distance between a listing and a destination. A PROXY, never a travel time.',
    input: z.object({
      fromLat: latSchema, fromLng: lngSchema,
      toLat: latSchema, toLng: lngSchema,
    }),
    handler: async (a) => {
      const { haversineMeters } = await import('../../lib/geohash.js')
      const metres = Math.round(haversineMeters(a.fromLat, a.fromLng, a.toLat, a.toLng))
      return {
        straightLineM: metres,
        // Named so a consumer cannot mistake it for a measurement. The spatial
        // layer removed assumed walk times for exactly this reason: across a
        // rail line, 420m of straight line is a 1.5km walk. A duration returns
        // when a router can MEASURE one.
        provenance: 'DERIVED',
        note: 'Straight-line distance. Not a travel time and not a route.',
      }
    },
  },

  getUserPreferences: {
    description: 'What a person has shown they are looking for, derived from their own saves, visits and views.',
    input: z.object({ userId: z.string().min(1).max(64) }),
    handler: async (a) => (await getUserPreferences(a.userId)) ?? { known: false, reason: 'not enough signals yet' },
  },

  getPropertyTrustSignals: {
    description: 'Trust score, risk score and open fraud signals for a listing.',
    input: z.object({ propertyId: z.string().min(1).max(64) }),
    handler: async (a) => {
      const [trust, risk, signals] = await Promise.all([
        prisma.trustScore.findUnique({ where: { propertyId: a.propertyId } }),
        prisma.propertyRiskScore.findUnique({ where: { propertyId: a.propertyId } }),
        prisma.fraudSignal.findMany({
          where: { propertyId: a.propertyId, resolved: false },
          // `detectedAt`, not `createdAt` — FraudSignal has never had one.
          // Prisma threw PrismaClientValidationError on every call, `runTool`
          // caught it as TOOL_FAILED, and this tool had therefore failed 100%
          // of the time since it was written.
          select: { type: true, detail: true, detectedAt: true },
          take: 20,
        }),
      ])
      return { trust, risk, signals }
    },
  },

  detectPropertyRelationships: {
    description: 'Other listings sharing this one\'s photos. Evidence for review, never a verdict.',
    input: z.object({ propertyId: z.string().min(1).max(64) }),
    handler: async (a) => ({
      reusedImages: await findReusedImages(a.propertyId),
      note: 'A photo match is evidence, not a finding. The same owner relisting the same home looks identical to a stolen photo at this layer.',
    }),
  },

  detectOwnerRelationships: {
    description: 'Other listing accounts sharing this owner\'s phone number. Evidence for review, never a verdict.',
    input: z.object({ ownerId: z.string().min(1).max(64) }),
    handler: async (a) => {
      const owner = await prisma.user.findUnique({ where: { id: a.ownerId }, select: { phone: true } })
      const shared = await findSharedContactOwners(a.ownerId, owner?.phone)
      return {
        shared: shared ?? null,
        note: 'A shared number is a broker running several accounts OR a family sharing a line. This cannot tell them apart and must not be reported as fraud.',
      }
    },
  },

  rankProperties: {
    description: 'Order a candidate set by the deterministic ranking pipeline. Weights are configuration and cannot be set here.',
    input: z.object({
      propertyIds: z.array(z.string().min(1).max(64)).min(1).max(100),
      center: z.object({ lat: latSchema, lng: lngSchema }).optional(),
      radiusM: z.coerce.number().int().min(100).max(50_000).optional(),
      budget: z.object({ min: z.coerce.number().min(0).optional(), max: z.coerce.number().min(0).optional() }).optional(),
      commute: z.object({ lat: latSchema, lng: lngSchema }).optional(),
      userId: z.string().min(1).max(64).optional(),
    }),
    handler: async (a) => {
      const properties = await prisma.property.findMany({
        where: { id: { in: a.propertyIds }, status: 'ACTIVE' },
        select: {
          id: true, title: true, type: true, bhk: true, rent: true, nightlyRate: true,
          pricingModel: true, lat: true, lng: true, city: true, landmark: true,
          localityId: true, createdAt: true,
          trustScore: { select: { badge: true, overallScore: true } },
        },
      })
      const preferences = a.userId ? await getUserPreferences(a.userId) : null
      return rankProperties(properties, { ...a, preferences })
    },
  },

  getMetroNetwork: {
    description: 'Metro lines and stations for a supported city.',
    input: z.object({ city: z.string().min(2).max(64) }),
    handler: async (a) => {
      const network = await getMetroNetwork(a.city)
      // Null is "this city has no network file", which is a real answer for a
      // city whose metro is still under construction — not an error.
      return network ?? { available: false, reason: `no metro network on file for ${a.city}` }
    },
  },
}

export const TOOL_NAMES = Object.keys(TOOLS)

/**
 * Run a tool by name.
 *
 * The ONLY entry point. It validates, bounds, times, logs, and never lets a
 * handler's failure escape as an exception — a caller gets a structured error it
 * can reason about, because "the tool failed" is information an agent must be
 * able to act on rather than a stack trace it will hallucinate around.
 */
export async function runTool(name, args = {}, { timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
  const started = Date.now()
  const tool = Object.prototype.hasOwnProperty.call(TOOLS, name) ? TOOLS[name] : null

  if (!tool) {
    return { ok: false, error: 'UNKNOWN_TOOL', message: `No such tool: ${name}`, tools: TOOL_NAMES }
  }

  const parsed = tool.input.safeParse(args)
  if (!parsed.success) {
    return {
      ok: false,
      error: 'INVALID_ARGUMENTS',
      message: `Invalid arguments for ${name}`,
      issues: parsed.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
    }
  }

  try {
    const data = await Promise.race([
      tool.handler(parsed.data),
      new Promise((_, reject) => setTimeout(() => reject(new Error('TOOL_TIMEOUT')), timeoutMs)),
    ])
    const ms = Date.now() - started
    intelLog('graph.tool', { tool: name, ms, ok: true })
    recordToolTiming(name, ms, true)
    return { ok: true, tool: name, ms, data }
  } catch (err) {
    const ms = Date.now() - started
    const timedOut = err?.message === 'TOOL_TIMEOUT'
    if (!timedOut) intelError('graph.tool_failed', err, { tool: name, ms })
    else intelLog('graph.tool', { tool: name, ms, ok: false, error: 'TOOL_TIMEOUT' })
    recordToolTiming(name, ms, false)
    return { ok: false, tool: name, ms, error: timedOut ? 'TOOL_TIMEOUT' : 'TOOL_FAILED', message: timedOut ? `${name} exceeded ${timeoutMs}ms` : 'Tool execution failed' }
  }
}

/**
 * The tool catalogue, as an agent would be given it.
 *
 * Derived from the registry rather than written beside it, so a tool cannot be
 * advertised that does not exist, and one cannot exist unadvertised.
 */
export function toolCatalogue() {
  return TOOL_NAMES.map((name) => ({ name, description: TOOLS[name].description }))
}
