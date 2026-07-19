// Intelligence layer — coordinates the deterministic integrity checks and the
// AI fraud scan for a listing, and owns the shared rent-benchmark computation.
// Called fire-and-forget from properties.service.js on create/update/publish;
// never throws, logs every decision via lib/intelLog.js.
import { prisma } from '../lib/prisma.js'
import { recalculateRiskScore } from '../features/trust/trust.service.js'
import { runFraudScan } from '../features/ai/ai.service.js'
import { intelLog, intelError } from '../lib/intelLog.js'
// Shared with the spatial intelligence layer, which resolves a bare lat/lng to
// a city the same way. Was duplicated here before features/spatial/ needed it.
import { CITY_CENTERS, haversineKm } from '../config/cityCenters.js'

// Average rent across other ACTIVE listings of the same city + type + size
// (BHK count, or sharing for PGs) — free, uses only our own DB data. Requires
// at least 3 comparables so a lone other listing can't masquerade as "the
// area average".
//
// Scoped to the same pricingModel: `rent` holds a monthly rent on a RENT
// listing but a lakh-scale lump sum on a LEASE one, so mixing the two averages
// ₹28,000 with ₹8,00,000 and hands the fraud prompt a meaningless number.
export async function getRentBenchmark(property) {
  const where = {
    status: 'ACTIVE',
    city: property.city,
    type: property.type,
    pricingModel: property.pricingModel ?? 'RENT',
    id: { not: property.id },
    ...(property.type === 'PG' ? { sharing: property.sharing } : { bhk: property.bhk }),
  }
  const agg = await prisma.property.aggregate({ where, _avg: { rent: true }, _count: true })
  if (!agg._avg.rent || agg._count < 3) return null
  return { avgRent: Math.round(Number(agg._avg.rent)), sampleSize: agg._count }
}

/**
 * Evaluate a listing's integrity: duplicate address, near-identical
 * geolocation, coordinate-vs-city consistency, then the AI fraud scan fed
 * with the market benchmark. Signals are deduped against unresolved ones so
 * re-evaluation (update, publish) never double-counts risk.
 */
export async function evaluateListing(propertyId, trigger) {
  const started = Date.now()
  try {
    const property = await prisma.property.findUnique({
      where: { id: propertyId },
      select: { id: true, address: true, lat: true, lng: true, city: true, type: true, bhk: true, sharing: true, pricingModel: true },
    })
    if (!property) return

    const candidates = []

    const dupAddress = await prisma.property.findFirst({
      where: { address: { equals: property.address.trim(), mode: 'insensitive' }, id: { not: propertyId } },
      select: { id: true },
    })
    if (dupAddress) candidates.push({ type: 'DUPLICATE_ADDRESS', detail: `Matches property ${dupAddress.id}` })

    const FIFTY_METERS = 0.00045
    const nearby = await prisma.property.findFirst({
      where: {
        id: { not: propertyId },
        lat: { gte: Number(property.lat) - FIFTY_METERS, lte: Number(property.lat) + FIFTY_METERS },
        lng: { gte: Number(property.lng) - FIFTY_METERS, lte: Number(property.lng) + FIFTY_METERS },
      },
      select: { id: true },
    })
    if (nearby) candidates.push({ type: 'SIMILAR_GEOLOCATION', detail: `Within 50m of property ${nearby.id}` })

    const existing = await prisma.fraudSignal.findMany({ where: { propertyId, resolved: false }, select: { type: true } })
    const existingTypes = new Set(existing.map((s) => s.type))
    const fresh = candidates.filter((c) => !existingTypes.has(c.type))
    if (fresh.length > 0) {
      await prisma.fraudSignal.createMany({ data: fresh.map((c) => ({ propertyId, ...c })) })
      await recalculateRiskScore(propertyId)
    }

    let distanceFromCityKm = null
    let outsideCity = false
    const center = CITY_CENTERS[property.city]
    if (center && property.lat != null && property.lng != null) {
      distanceFromCityKm = Math.round(haversineKm(Number(property.lat), Number(property.lng), center.lat, center.lng))
      outsideCity = distanceFromCityKm > center.radiusKm
      if (outsideCity) {
        intelLog('listing.location_mismatch', { propertyId, city: property.city, distanceFromCityKm })
      }
    }

    const benchmark = await getRentBenchmark(property).catch(() => null)
    const ai = await runFraudScan(propertyId, {
      marketAvgRent:   benchmark?.avgRent,
      comparableCount: benchmark?.sampleSize,
      // `outsideCity` rather than re-reading center.radiusKm here: a listing in
      // a city absent from CITY_CENTERS left `center` undefined, so this line
      // threw, the catch below swallowed it, and the AI scan silently never ran
      // for that listing. The location check is meant to be skippable; it was
      // taking the whole evaluation down with it.
      distanceFromCityKm: outsideCity ? distanceFromCityKm : undefined,
    })

    intelLog('listing.evaluated', {
      propertyId,
      trigger,
      newSignals: fresh.map((f) => f.type),
      knownSignals: [...existingTypes],
      aiScore: ai?.score ?? null,
      ms: Date.now() - started,
    })
  } catch (err) {
    intelError('listing.evaluate_failed', err, { propertyId, trigger })
  }
}
