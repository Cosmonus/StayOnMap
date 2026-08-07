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
import { checkListingLocation } from '../features/properties/locationCheck.js'
import { findReusedImages } from '../features/intelligence/imageFingerprint.js'
import { findSharedContactOwners } from '../features/intelligence/ownerGraph.js'

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
      // `pincode` is here because checkListingLocation reads it — without it the
      // location check received undefined and silently never ran, which is the
      // exact "wired but inert" failure this file exists to prevent.
      select: {
        id: true, address: true, lat: true, lng: true, city: true, pincode: true,
        type: true, bhk: true, sharing: true, pricingModel: true,
        ownerId: true,
        owner: { select: { phone: true } },
      },
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

    // ── Relationship checks (added 2026-08-07) ──────────────────────────────
    // Both look BEYOND this listing, which is what everything above cannot do:
    // a listing can be internally perfect and still be one of five posted by the
    // same person behind five accounts, or carry a photograph lifted from
    // somebody else's home. Both are evidence for a moderator, never a verdict —
    // see each module's header for why the ambiguity is real.
    //
    // Failures are swallowed per check. A fingerprint table that has not been
    // backfilled, or a phone column full of nulls, must degrade to "no signal",
    // never take the evaluation down with it.
    const reused = await findReusedImages(propertyId).catch(() => [])
    if (reused.length) {
      const closest = reused[0]
      // A different OWNER reusing the photo is the serious case; the same owner
      // is usually an honest relist of the same home. Both are recorded, and the
      // detail says which, because the risk weighting is a moderator's call.
      const otherOwners = reused.filter((r) => r.ownerId !== property.ownerId)
      candidates.push({
        type: 'REUSED_IMAGES',
        detail: otherOwners.length
          ? `Photo also on ${otherOwners.length} listing(s) owned by a different account (closest match: property ${otherOwners[0].propertyId}, ${otherOwners[0].closest}/64 bits apart)`
          : `Photo also on ${reused.length} other listing(s) by the same owner (closest: property ${closest.propertyId})`,
      })
    }

    const shared = await findSharedContactOwners(property.ownerId, property.owner?.phone).catch(() => null)
    if (shared) {
      const verified = shared.accounts.filter((a) => a.phoneVerified).length
      candidates.push({
        type: 'SAME_CONTACT',
        // Deliberately does not name the accounts in the detail string: this text
        // is read in a moderation queue, and the finding is "this number is
        // shared", not "these people are colluding". The account list is one
        // query away for whoever investigates.
        detail: `Phone shared with ${shared.accounts.length} other listing account(s)` +
          (verified ? `, ${verified} of which verified this number` : ', none verified'),
      })
    }

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

    // Claimed pincode vs India Post, and the pin vs OSM districts. Same
    // contract as the city-distance check above: null means "could not check"
    // (directory unseeded, infra down) and is skippable — the one thing this
    // must never do is take the evaluation down or auto-penalise. High findings
    // are logged for moderation; everything is handed to the AI as evidence.
    const location = await checkListingLocation(property)
    if (location && !location.ok) {
      intelLog('listing.pincode_mismatch', {
        propertyId,
        pincode: property.pincode,
        findings: location.findings.map((f) => f.code),
      })
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
      pincodeFindings: location?.findings?.length
        ? location.findings.map((f) => f.message)
        : undefined,
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
