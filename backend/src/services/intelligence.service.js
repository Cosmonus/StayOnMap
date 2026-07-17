// Intelligence layer — coordinates the deterministic integrity checks and the
// AI fraud scan for a listing, and owns the shared rent-benchmark computation.
// Called fire-and-forget from properties.service.js on create/update/publish;
// never throws, logs every decision via lib/intelLog.js.
import { prisma } from '../lib/prisma.js'
import { recalculateRiskScore } from '../features/trust/trust.service.js'
import { runFraudScan } from '../features/ai/ai.service.js'
import { intelLog, intelError } from '../lib/intelLog.js'

// Approximate city centres + generous metro-area radii for coordinate-vs-city
// sanity checks. Covers SUPPORTED_CITIES (config/cities.js); a city missing
// here simply skips the check.
const CITY_CENTERS = {
  Delhi:     { lat: 28.6139, lng: 77.2090, radiusKm: 60 },
  Mumbai:    { lat: 19.0760, lng: 72.8777, radiusKm: 55 },
  Kolkata:   { lat: 22.5726, lng: 88.3639, radiusKm: 45 },
  Chennai:   { lat: 13.0827, lng: 80.2707, radiusKm: 45 },
  Bengaluru: { lat: 12.9716, lng: 77.5946, radiusKm: 45 },
  Hyderabad: { lat: 17.3850, lng: 78.4867, radiusKm: 45 },
  Ahmedabad: { lat: 23.0225, lng: 72.5714, radiusKm: 40 },
  Pune:      { lat: 18.5204, lng: 73.8567, radiusKm: 45 },
  Surat:     { lat: 21.1702, lng: 72.8311, radiusKm: 35 },
}

function haversineKm(lat1, lng1, lat2, lng2) {
  const toRad = (d) => (d * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

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
    const center = CITY_CENTERS[property.city]
    if (center && property.lat != null && property.lng != null) {
      distanceFromCityKm = Math.round(haversineKm(Number(property.lat), Number(property.lng), center.lat, center.lng))
      if (distanceFromCityKm > center.radiusKm) {
        intelLog('listing.location_mismatch', { propertyId, city: property.city, distanceFromCityKm })
      }
    }

    const benchmark = await getRentBenchmark(property).catch(() => null)
    const ai = await runFraudScan(propertyId, {
      marketAvgRent:   benchmark?.avgRent,
      comparableCount: benchmark?.sampleSize,
      distanceFromCityKm: distanceFromCityKm != null && distanceFromCityKm > center.radiusKm ? distanceFromCityKm : undefined,
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
