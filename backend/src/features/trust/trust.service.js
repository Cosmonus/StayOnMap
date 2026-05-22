import { prisma } from '../../lib/prisma.js'
import { env } from '../../config/env.js'

// ── In-memory cache for geo-based scores (per ~1km grid cell) ──────────────────
const geoCache = new Map()
function geoCacheKey(lat, lng, type) {
  const r = (n) => Math.round(Number(n) * 100) / 100
  return `${type}:${r(lat)},${r(lng)}`
}

// ── Google Maps API helpers ────────────────────────────────────────────────────
async function googlePlacesCount(lat, lng, type, radius = 1500) {
  if (!env.googleMapsKey) return 0
  try {
    const url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${lat},${lng}&radius=${radius}&type=${type}&key=${env.googleMapsKey}`
    const data = await fetch(url).then(r => r.json())
    return data.results?.length ?? 0
  } catch { return 0 }
}

async function googleElevation(lat, lng) {
  if (!env.googleMapsKey) return null
  try {
    const url = `https://maps.googleapis.com/maps/api/elevation/json?locations=${lat},${lng}&key=${env.googleMapsKey}`
    const data = await fetch(url).then(r => r.json())
    return data.results?.[0]?.elevation ?? null
  } catch { return null }
}

// ── AreaScore (0–10): transit + amenities + safety insights ───────────────────
async function computeAreaScore(lat, lng, propertyId) {
  const cacheKey = geoCacheKey(lat, lng, 'area')
  if (geoCache.has(cacheKey)) return geoCache.get(cacheKey)

  const [transit, hospital, school, supermarket, safetyIssues, totalInsights] = await Promise.all([
    googlePlacesCount(lat, lng, 'transit_station', 1000),
    googlePlacesCount(lat, lng, 'hospital', 2000),
    googlePlacesCount(lat, lng, 'school', 1000),
    googlePlacesCount(lat, lng, 'supermarket', 1000),
    prisma.neighborhoodInsight.count({ where: { propertyId, category: 'SAFETY_CONCERN' } }),
    prisma.neighborhoodInsight.count({ where: { propertyId } }),
  ])

  const transitScore   = Math.min(transit, 5) / 5 * 3
  const amenitiesScore = (Math.min(hospital, 3) + Math.min(school, 3) + Math.min(supermarket, 3)) / 9 * 4
  const safetyPenalty  = totalInsights > 0 ? (safetyIssues / totalInsights) * 3 : 0
  const score = Math.max(0, Math.min(10, transitScore + amenitiesScore + 3 - safetyPenalty))
  const rounded = Math.round(score * 10) / 10

  geoCache.set(cacheKey, rounded)
  setTimeout(() => geoCache.delete(cacheKey), 24 * 60 * 60 * 1000)
  return rounded
}

// ── WaterScore (0–10): review water ratings + shortage insights ────────────────
async function computeWaterScore(propertyId) {
  const [reviews, shortageCount, totalInsights] = await Promise.all([
    prisma.communityReview.findMany({ where: { propertyId, status: 'APPROVED' }, select: { ratingsWater: true } }),
    prisma.neighborhoodInsight.count({ where: { propertyId, category: 'WATER_SHORTAGE' } }),
    prisma.neighborhoodInsight.count({ where: { propertyId } }),
  ])

  let score = 5
  if (reviews.length > 0) {
    const avgWater = reviews.reduce((s, r) => s + (r.ratingsWater ?? 3), 0) / reviews.length
    score = (avgWater / 5) * 10
  }

  if (totalInsights > 0) {
    const shortagePct = shortageCount / totalInsights
    score = score * (1 - shortagePct * 0.4)
  }

  return Math.round(Math.max(0, Math.min(10, score)) * 10) / 10
}

// ── FloodSafe (0–10): elevation proxy, higher = safer ─────────────────────────
async function computeFloodSafe(lat, lng) {
  const cacheKey = geoCacheKey(lat, lng, 'flood')
  if (geoCache.has(cacheKey)) return geoCache.get(cacheKey)

  const elevation = await googleElevation(lat, lng)
  let score = 5

  if (elevation !== null) {
    if (elevation < 2)       score = 2
    else if (elevation < 5)  score = 3
    else if (elevation < 10) score = 5
    else if (elevation < 15) score = 6
    else if (elevation < 20) score = 7
    else if (elevation < 30) score = 8
    else if (elevation < 50) score = 9
    else                     score = 10
  }

  geoCache.set(cacheKey, score)
  setTimeout(() => geoCache.delete(cacheKey), 7 * 24 * 60 * 60 * 1000)
  return score
}

// ── StayScore ─────────────────────────────────────────────────────────────────
export async function recalculateTrustScore(propertyId) {
  const [reviews, votes, riskScore, verification, property] = await Promise.all([
    prisma.communityReview.findMany({ where: { propertyId, status: 'APPROVED' } }),
    prisma.recommendationVote.findMany({ where: { propertyId } }),
    prisma.propertyRiskScore.findUnique({ where: { propertyId } }),
    prisma.ownershipVerification.findUnique({ where: { propertyId } }),
    prisma.property.findUnique({ where: { id: propertyId }, select: { lat: true, lng: true, ownerId: true } }),
  ])

  const totalReviews      = reviews.length
  const recommendCount    = votes.filter(v => v.recommend).length
  const notRecommendCount = votes.filter(v => !v.recommend).length
  const totalVotes        = recommendCount + notRecommendCount
  const recommendPercent  = totalVotes > 0 ? (recommendCount / totalVotes) * 100 : 0

  let overallScore = 0, safetyScore = 0, cleanlinessScore = 0, neighborhoodScore = 0
  if (totalReviews > 0) {
    const avg = (field) => reviews.reduce((s, r) => s + (r[field] ?? 3), 0) / totalReviews
    safetyScore       = avg('ratingsSafety')
    cleanlinessScore  = avg('ratingsClean')
    neighborhoodScore = avg('ratingsNeighborhood')
    overallScore = (
      safetyScore * 0.20 + cleanlinessScore * 0.15 + neighborhoodScore * 0.15 +
      avg('ratingsWater') * 0.07 + avg('ratingsNoise') * 0.07 + avg('ratingsInternet') * 0.07 +
      avg('ratingsParking') * 0.07 + avg('ratingsTransport') * 0.07 + avg('ratingsMaintenance') * 0.07 +
      avg('ratingsOwnerBehavior') * 0.07 + avg('ratingsSecurity') * 0.07 + avg('ratingsPowerBackup') * 0.06
    )
  }

  const isVerified = verification?.status === 'VERIFIED'
  const riskLevel  = riskScore?.level

  let badge = null
  if (riskLevel === 'SUSPICIOUS')      badge = 'SUSPICIOUS'
  else if (riskLevel === 'HIGH')       badge = 'NEEDS_ATTENTION'
  else if (riskLevel === 'MEDIUM')     badge = 'UNDER_REVIEW'
  else if (overallScore >= 4.5 && recommendPercent >= 90 && isVerified) badge = 'HIGHLY_RECOMMENDED'
  else if (overallScore >= 4.0 && isVerified) badge = 'COMMUNITY_TRUSTED'
  else if (isVerified)                 badge = 'VERIFIED_OWNER'

  const lat = property?.lat
  const lng = property?.lng
  const [areaScore, waterScore, floodSafeRating] = await Promise.all([
    lat && lng ? computeAreaScore(lat, lng, propertyId) : Promise.resolve(0),
    computeWaterScore(propertyId),
    lat && lng ? computeFloodSafe(lat, lng) : Promise.resolve(5),
  ])

  const result = await prisma.trustScore.upsert({
    where:  { propertyId },
    create: { propertyId, overallScore, safetyScore, cleanlinessScore, neighborhoodScore, totalReviews, recommendCount, notRecommendCount, recommendPercent, badge, areaScore, waterScore, floodSafeRating },
    update: { overallScore, safetyScore, cleanlinessScore, neighborhoodScore, totalReviews, recommendCount, notRecommendCount, recommendPercent, badge, areaScore, waterScore, floodSafeRating },
  })

  if (property?.ownerId) {
    recalculateOwnerTrust(property.ownerId).catch(() => {})
  }

  return result
}

export async function recalculateRiskScore(propertyId) {
  const [reports, fraudSignals, verification] = await Promise.all([
    prisma.propertyReport.findMany({ where: { propertyId, status: { not: 'DISMISSED' } }, select: { severity: true } }),
    prisma.fraudSignal.count({ where: { propertyId, resolved: false } }),
    prisma.ownershipVerification.findUnique({ where: { propertyId }, select: { status: true } }),
  ])

  const verificationLevel = { VERIFIED: 4, UNDER_REVIEW: 2, PENDING: 1 }[verification?.status ?? ''] ?? 0
  const criticalReports = reports.filter(r => r.severity === 'CRITICAL').length
  const highReports     = reports.filter(r => r.severity === 'HIGH').length
  const medReports      = reports.filter(r => r.severity === 'MEDIUM').length
  const lowReports      = reports.filter(r => r.severity === 'LOW').length

  const score = Math.max(0, (criticalReports * 30) + (highReports * 15) + (medReports * 8) + (lowReports * 3) + (fraudSignals * 20) - (verificationLevel * 10))
  const level = score >= 80 ? 'SUSPICIOUS' : score >= 50 ? 'HIGH' : score >= 20 ? 'MEDIUM' : 'LOW'

  const riskScore = await prisma.propertyRiskScore.upsert({
    where:  { propertyId },
    create: { propertyId, score, level, complaintCount: reports.length, duplicateSignals: fraudSignals, verificationLevel },
    update: { score, level, complaintCount: reports.length, duplicateSignals: fraudSignals, verificationLevel },
  })

  await recalculateTrustScore(propertyId)
  return riskScore
}

// ── OwnerTrust (0–100) ────────────────────────────────────────────────────────
export async function recalculateOwnerTrust(ownerId) {
  const [properties, appointments, verification, highReports] = await Promise.all([
    prisma.property.findMany({ where: { ownerId }, include: { trustScore: { select: { overallScore: true } } } }),
    prisma.appointment.findMany({ where: { ownerId, status: { in: ['ACCEPTED', 'REJECTED', 'CANCELLED'] } } }),
    prisma.ownershipVerification.findFirst({ where: { property: { ownerId }, status: 'VERIFIED' } }),
    prisma.propertyReport.count({ where: { property: { ownerId }, severity: { in: ['HIGH', 'CRITICAL'] }, status: { not: 'DISMISSED' } } }),
  ])

  const accepted     = appointments.filter(a => a.status === 'ACCEPTED').length
  const totalDecided = appointments.filter(a => a.status !== 'CANCELLED').length
  const responseRate = totalDecided > 0 ? (accepted / totalDecided) * 100 : 50

  const scoredProps = properties.filter(p => (p.trustScore?.overallScore ?? 0) > 0)
  const reviewAvg   = scoredProps.length > 0
    ? scoredProps.reduce((s, p) => s + p.trustScore.overallScore, 0) / scoredProps.length
    : 0

  const verificationLevel = verification ? 4 : 0
  const score = Math.round(Math.min(100,
    (responseRate * 0.30) +
    ((reviewAvg / 5) * 40) +
    (verificationLevel * 5) +
    Math.max(0, 10 - highReports * 5)
  ))

  const level = score >= 80 ? 'EXCELLENT' : score >= 60 ? 'HIGH' : score >= 40 ? 'MEDIUM' : score > 0 ? 'LOW' : 'UNRATED'

  return prisma.ownerTrustScore.upsert({
    where:  { ownerId },
    create: { ownerId, score, level, responseRate, reviewAvg, verificationLevel },
    update: { score, level, responseRate, reviewAvg, verificationLevel },
  })
}
