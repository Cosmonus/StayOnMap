import Anthropic from '@anthropic-ai/sdk'
import { prisma } from '../../lib/prisma.js'
import { env } from '../../config/env.js'
import { recalculateRiskScore } from '../trust/trust.service.js'
import { intelLog, intelError } from '../../lib/intelLog.js'

const MODEL = 'claude-haiku-4-5-20251001'

// Exported so a SURFACE can gate on it, not just this module. Every scan below
// short-circuits to an empty result when this is false, so a button that
// triggers one is a picture of a button — the same rule that hides the SMS
// sign-in control where no provider is configured (see lib/smsSender.js's
// smsConfigured).
export function aiEnabled() {
  return env.aiProvider === 'anthropic' && !!env.anthropicApiKey
}

function getClient() {
  return new Anthropic({ apiKey: env.anthropicApiKey })
}

// Extract the first JSON object from a model reply
function parseModelJson(text) {
  const match = text.match(/\{[\s\S]*\}/)
  if (!match) return null
  try { return JSON.parse(match[0]) } catch { return null }
}

/**
 * Score a listing for fraud/bait risk (0-100).
 * `extraContext` carries signals the intelligence layer already computed
 * (market rent benchmark, coordinate-vs-city distance) so the model reasons
 * from evidence instead of guessing market conditions.
 */
export async function scoreFraud(propertyId, extraContext = {}) {
  if (!aiEnabled()) return { score: 0, signals: [] }

  const property = await prisma.property.findUnique({
    where: { id: propertyId },
    select: {
      title: true, type: true, houseStyle: true, rent: true, deposit: true,
      nightlyRate: true, saleOrLease: true, bhk: true, sharing: true, totalBeds: true,
      city: true, address: true, description: true, createdAt: true,
      reports:      { select: { category: true, severity: true } },
      fraudSignals: { where: { resolved: false }, select: { type: true } },
      images:       { select: { url: true } },
    },
  })

  if (!property) return { score: 0, signals: [] }

  const context = JSON.stringify({
    type:         property.type,
    houseStyle:   property.houseStyle ?? undefined,
    title:        property.title,
    rent:         property.rent,
    deposit:      property.deposit,
    nightlyRate:  property.nightlyRate ?? undefined,
    saleOrLease:  property.saleOrLease ?? undefined,
    bhk:          property.bhk ?? undefined,
    sharing:      property.sharing ?? undefined,
    totalBeds:    property.totalBeds ?? undefined,
    city:         property.city,
    address:      property.address,
    description:  property.description?.slice(0, 500),
    listedDaysAgo: Math.floor((Date.now() - new Date(property.createdAt).getTime()) / 86400000),
    reportTypes:  property.reports.map((r) => `${r.severity} ${r.category}`),
    existingSignals: property.fraudSignals.map((s) => s.type),
    imageCount:   property.images.length,
    marketAvgRent:     extraContext.marketAvgRent ?? undefined,
    comparableCount:   extraContext.comparableCount ?? undefined,
    distanceFromCityKm: extraContext.distanceFromCityKm ?? undefined,
    pincodeFindings:    extraContext.pincodeFindings ?? undefined,
  })

  const prompt = `You are the listing-integrity scorer for StayOnMap, an Indian map-first property platform.
Listings span multiple types with different pricing semantics — apply the right heuristics per type:
- APARTMENT / HOUSE / VILLA / INDEPENDENT_HOUSE: monthly rent + deposit. In India a deposit of 2-10x monthly rent is normal; above 10x is anomalous.
- PG: rent is per bed per month ("sharing" = beds per room, "totalBeds" = capacity). Deposits are small.
- SHORT_STAY: priced per night ("nightlyRate"). A missing or nominal monthly rent is NORMAL here — never flag it as bait pricing.
- COMMERCIAL: monthly rent for shops/offices; deposits up to 10-12 months of rent are normal.
- LAND: sale or lease ("saleOrLease"); has no monthly-rent semantics — never apply rent or deposit heuristics.

Red flags to weigh:
- Rent far below comparable active listings (marketAvgRent over comparableCount listings, when provided)
- Deposit-to-rent ratio anomalous FOR THE LISTING TYPE (rules above)
- Vague, templated, or copied-sounding description
- Unresolved fraud signals or HIGH/CRITICAL severity reports already on record
- Coordinates far from the claimed city (distanceFromCityKm, when provided)
- Pincode contradictions from India Post ground truth (pincodeFindings, when provided) — an unknown pincode or a wrong-state pincode is a strong integrity signal
- Zero photos on a listing making strong claims
Base every signal on the data given — do not invent facts. An unremarkable listing scores low with an empty signals array.

Listing data:
${context}

Respond with ONLY valid JSON in this exact format:
{"score": <integer 0-100, 0 = clearly legitimate, 100 = clearly fraudulent>, "signals": ["specific red flag", "..."]}`

  const started = Date.now()
  try {
    const client = getClient()
    const message = await client.messages.create({
      model: MODEL,
      max_tokens: 300,
      messages: [{ role: 'user', content: prompt }],
    })

    const parsed = parseModelJson(message.content[0]?.text ?? '')
    if (!parsed) {
      intelError('ai.fraud_score_unparseable', new Error('no JSON in model reply'), { propertyId })
      return { score: 0, signals: [] }
    }

    const result = {
      score:   Math.min(100, Math.max(0, Number(parsed.score) || 0)),
      signals: Array.isArray(parsed.signals) ? parsed.signals.filter((s) => typeof s === 'string') : [],
    }
    intelLog('ai.fraud_score', { propertyId, score: result.score, signalCount: result.signals.length, ms: Date.now() - started })
    return result
  } catch (err) {
    intelError('ai.fraud_score_failed', err, { propertyId, ms: Date.now() - started })
    return { score: 0, signals: [] }
  }
}

/**
 * Classify a community review as genuine or fake.
 * Wired to POST /api/v1/admin/ai/review-scan/:reviewId — admin-triggered.
 */
export async function detectFakeReview(reviewId) {
  if (!aiEnabled()) return { isFake: false, confidence: 0, reasons: [] }

  const review = await prisma.communityReview.findUnique({
    where: { id: reviewId },
    select: {
      reviewerId: true, reviewerType: true, recommend: true, body: true, createdAt: true,
      ratingsSafety: true, ratingsClean: true, ratingsWater: true, ratingsNoise: true,
      ratingsInternet: true, ratingsParking: true, ratingsNeighborhood: true, ratingsTransport: true,
      ratingsMaintenance: true, ratingsOwnerBehavior: true, ratingsSecurity: true, ratingsPowerBackup: true,
      property: { select: { title: true, city: true, createdAt: true } },
      reviewer: { select: { createdAt: true } },
    },
  })

  if (!review) return { isFake: false, confidence: 0, reasons: [] }

  const ratings = [
    review.ratingsSafety, review.ratingsClean, review.ratingsWater, review.ratingsNoise,
    review.ratingsInternet, review.ratingsParking, review.ratingsNeighborhood, review.ratingsTransport,
    review.ratingsMaintenance, review.ratingsOwnerBehavior, review.ratingsSecurity, review.ratingsPowerBackup,
  ]
  const reviewerReviewCount = await prisma.communityReview.count({ where: { reviewerId: review.reviewerId } })

  const context = JSON.stringify({
    body:             review.body?.slice(0, 800),
    recommend:        review.recommend,
    reviewerType:     review.reviewerType,
    ratingsMin:       Math.min(...ratings),
    ratingsMax:       Math.max(...ratings),
    ratingsAvg:       Math.round((ratings.reduce((s, r) => s + r, 0) / ratings.length) * 10) / 10,
    reviewerAccountAgeDays: Math.floor((Date.now() - new Date(review.reviewer.createdAt).getTime()) / 86400000),
    reviewerTotalReviews:   reviewerReviewCount,
    propertyListedDaysBeforeReview: Math.floor((new Date(review.createdAt) - new Date(review.property.createdAt)) / 86400000),
    propertyCity:     review.property.city,
  })

  const prompt = `You are the review-integrity classifier for StayOnMap, an Indian property platform where tenants and neighbors review properties across 12 rating categories (1-5).

Assess whether this review is fake (paid promotion, owner self-review, competitor sabotage, or bot-generated). Signals of a fake review:
- All 12 ratings identical at an extreme (all 5s or all 1s) with a generic body
- Body text contradicting the ratings (glowing text with 1s, or complaints with 5s)
- recommend flag contradicting both ratings and text
- Templated or promotional language that describes no concrete, verifiable detail
- Brand-new reviewer account whose only activity is this review, posted immediately after the property was listed
A short but specific review from an established account is usually genuine. Judge only from the data given.

Review data:
${context}

Respond with ONLY valid JSON in this exact format:
{"isFake": <true|false>, "confidence": <integer 0-100>, "reasons": ["specific reason", "..."]}`

  const started = Date.now()
  try {
    const client = getClient()
    const message = await client.messages.create({
      model: MODEL,
      max_tokens: 300,
      messages: [{ role: 'user', content: prompt }],
    })

    const parsed = parseModelJson(message.content[0]?.text ?? '')
    if (!parsed) {
      intelError('ai.review_scan_unparseable', new Error('no JSON in model reply'), { reviewId })
      return { isFake: false, confidence: 0, reasons: [] }
    }

    const result = {
      isFake:     parsed.isFake === true,
      confidence: Math.min(100, Math.max(0, Number(parsed.confidence) || 0)),
      reasons:    Array.isArray(parsed.reasons) ? parsed.reasons.filter((r) => typeof r === 'string') : [],
    }
    intelLog('ai.review_scan', { reviewId, isFake: result.isFake, confidence: result.confidence, ms: Date.now() - started })
    return result
  } catch (err) {
    intelError('ai.review_scan_failed', err, { reviewId, ms: Date.now() - started })
    return { isFake: false, confidence: 0, reasons: [] }
  }
}

/**
 * Run a fraud scan and persist the outcome: scores above 70 create (or
 * refresh) a single unresolved AI_FLAGGED signal and recalculate the risk
 * score so the flag actually moves the listing's risk level.
 */
export async function runFraudScan(propertyId, extraContext = {}) {
  const result = await scoreFraud(propertyId, extraContext)
  if (result.score > 70) {
    const detail = `AI fraud score: ${result.score}${result.signals.length ? ` — ${result.signals.join('; ').slice(0, 400)}` : ''}`
    const existing = await prisma.fraudSignal.findFirst({ where: { propertyId, type: 'AI_FLAGGED', resolved: false } })
    if (existing) {
      await prisma.fraudSignal.update({ where: { id: existing.id }, data: { detail } })
    } else {
      await prisma.fraudSignal.create({ data: { propertyId, type: 'AI_FLAGGED', detail } })
    }
    await recalculateRiskScore(propertyId)
  }
  return result
}
