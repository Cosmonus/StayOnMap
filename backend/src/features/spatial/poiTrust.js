// How much should we trust what we hold about this place?
//
// PURE — no Prisma, no clock it did not receive. Everything the caller needs to
// supply is passed in, so every case can be enumerated in a test rather than
// sampled against a database.
//
// It composes confidence through envelope.js's `applyFactors`, deliberately,
// rather than growing a second scoring idiom. That buys the three rules the
// spatial layer is built on, already enforced by throws:
//
//   1. A factor may only ever REDUCE. There is no knob that makes a score look
//      better, which is what stops "confidence v2" becoming a set of dials
//      someone turns until the cards read well.
//   2. Every factor carries a plain-language REASON. An unexplained penalty is
//      as opaque as an unexplained number.
//   3. `cap` where we know it is worse but not by how much; `multiplier` where
//      we know the magnitude. Picking a multiplier for something unquantified
//      means inventing the magnitude.
//
// What it is NOT: a measurement of the place. It is a measurement of OUR
// KNOWLEDGE of the place, and the reasons array exists so nobody reads it the
// other way.
import { applyFactors, bandFor } from './envelope.js'
import { sourceFor } from './poiSources.js'
import { categoryFreshness } from './dataQuality.js'
import { volatilityFor } from './poiPolicy.js'

/**
 * The attributes we score, split into two groups — and the split is the whole
 * design decision here.
 *
 * CORE is what a spatial layer actually needs: does this place exist, where is
 * it, and what kind of place is it. Those three decide the overall score.
 *
 * ENRICHMENT is scored and reported per attribute but does NOT drag the overall
 * score down. The brief asks for an overall derived from "the relevant
 * attributes rather than arbitrary averaging", and this is the part that makes
 * it non-arbitrary: OSM's phone and opening-hours coverage in India is thin, so
 * averaging them in would make the score mostly a measurement of how often
 * Indian mappers fill in a hours tag. A well-known hospital with no listed
 * phone would score below a random shop that has one, which is exactly
 * backwards for every question this layer is asked.
 *
 * `weight` applies within CORE only. Location leads because a place in the
 * wrong spot is worse than useless on a map — it is actively misleading.
 */
export const ATTRIBUTES = {
  location: { group: 'core', weight: 0.40, label: 'where it is',           valueOf: (p) => (p.lat != null && p.lng != null ? 'set' : null) },
  identity: { group: 'core', weight: 0.35, label: 'what it is called',     valueOf: (p) => p.name ?? p.brand ?? null },
  category: { group: 'core', weight: 0.25, label: 'what kind of place',    valueOf: (p) => p.category ?? null },
  address:  { group: 'enrichment',         label: 'its address',           valueOf: (p) => p.address ?? p.postcode ?? null },
  contact:  { group: 'enrichment',         label: 'how to reach it',       valueOf: (p) => p.phone ?? p.website ?? null },
  hours:    { group: 'enrichment',         label: 'when it is open',       valueOf: (p) => p.openingHours ?? null },
}

export const CORE_ATTRIBUTES = Object.keys(ATTRIBUTES).filter((k) => ATTRIBUTES[k].group === 'core')

// Which recorded conflict attribute bears on which scored attribute.
// `name` conflicts are evidence about identity; `location` about location.
// A category conflict is evidence about the category AND nothing else — a place
// being reclassified says nothing about whether its coordinates are right.
const CONFLICT_TO_ATTRIBUTE = { location: 'location', name: 'identity', category: 'category' }

// A place that has flapped between present and absent this many times is one
// the source itself cannot make up its mind about.
const FLAPPING_EVENTS = 3

/**
 * The conflict penalty.
 *
 * The FIRST conflict is free, and that is the substantive choice here. A single
 * correction is evidence the source is IMPROVING, not that it is unreliable —
 * penalising it would mean scoring a corrected record below one nobody has ever
 * revisited, which rewards neglect. Repeated disagreement on the same attribute
 * is the signal, so the penalty starts at the second.
 *
 * Floored at 0.7: a record that keeps being corrected is less certain, not
 * worthless, and an unbounded penalty would eventually rank a much-edited
 * high-street pharmacy below a never-touched ghost.
 */
export function conflictMultiplier(count) {
  if (count <= 1) return 1
  return Math.max(0.7, Math.round((1 - 0.1 * (count - 1)) * 100) / 100)
}

/**
 * Confidence in ONE attribute of one POI.
 *
 * @param {string} attribute
 * @param {object} poi   { category, fetchedAt, status, ...values }
 * @param {object} ctx
 * @param {string} [ctx.source]                   defaults to 'osm'
 * @param {Record<string, number>} [ctx.conflictCounts]  attribute → count
 * @param {boolean} [ctx.locationWithheld]        we are serving a coordinate
 *                                                the source contradicts
 * @param {number} [ctx.statusEventCount]
 * @param {Date} [ctx.now]
 * @returns {{value: number, band: string, present: boolean, factors: Array, basis: string}}
 */
export function attributeConfidence(attribute, poi, ctx = {}) {
  const spec = ATTRIBUTES[attribute]
  if (!spec) throw new Error(`poiTrust: unknown attribute "${attribute}"`)

  const {
    source = 'osm', conflictCounts = {}, locationWithheld = false,
    statusEventCount = 0, now = new Date(),
  } = ctx

  // An attribute we hold no value for gets 0, and that is an ABSENCE rather
  // than a penalty. The distinction matters downstream: `present: false` is why
  // the enrichment attributes can report honestly without dragging the overall
  // score, and why a dashboard can separate "we don't know" from "we doubt it".
  if (spec.valueOf(poi) == null) {
    return {
      value: 0, band: bandFor(0), present: false, factors: [],
      basis: `we hold no value for ${spec.label}`,
    }
  }

  const src = sourceFor(source)
  const base = src.reliability
  const factors = []

  // ── Freshness. Hours are the exception and it is worth stating: they rot
  // faster than the place they belong to. A hospital does not move, but its
  // OPD timings change with the season, so hours are aged against the VOLATILE
  // band whatever the category — which is the one place this file overrides
  // poiPolicy rather than reading it.
  const freshCategory = attribute === 'hours' ? 'cafe' : poi.category
  const fresh = categoryFreshness(poi.fetchedAt, freshCategory, now)
  if (fresh < 1) {
    const { refreshDays } = volatilityFor(freshCategory)
    factors.push({
      key: 'freshness',
      reason:
        `This has not been re-checked since we last downloaded map data, and ` +
        `a ${spec.label} of this kind is worth re-checking about every ${refreshDays} days.`,
      multiplier: fresh,
    })
  }

  // ── Repeated disagreement about THIS attribute.
  const conflictAttr = Object.entries(CONFLICT_TO_ATTRIBUTE)
    .find(([, mapped]) => mapped === attribute)?.[0]
  const conflicts = conflictAttr ? (conflictCounts[conflictAttr] ?? 0) : 0
  const conflictMult = conflictMultiplier(conflicts)
  if (conflictMult < 1) {
    factors.push({
      key: 'conflicts',
      reason: `Our sources have disagreed about ${spec.label} ${conflicts} times, so it may still be unsettled.`,
      multiplier: conflictMult,
    })
  }

  // ── We are knowingly serving a coordinate the source contradicts.
  //
  // A CAP, not a multiplier. We know this is worse and we do not know by how
  // much: the withheld jump might have been vandalism (our value is right) or a
  // genuine relocation we refused (our value is wrong), and nothing in the row
  // says which. Refusing to claim above a ceiling is defensible; inventing a
  // magnitude is not.
  if (attribute === 'location' && locationWithheld) {
    factors.push({
      key: 'withheld_move',
      reason: 'Map data recently placed this somewhere far enough away that we kept our own position instead. One of the two is wrong.',
      cap: 0.6,
    })
  }

  // ── The source no longer lists this place at all.
  if (poi.status === 'ABSENT_FROM_SOURCE') {
    factors.push({
      key: 'absent',
      reason: 'The latest map data no longer includes this place, so it may have closed or moved.',
      cap: 0.3,
    })
  } else if (statusEventCount >= FLAPPING_EVENTS) {
    factors.push({
      key: 'unstable',
      reason: 'This place has repeatedly appeared and disappeared from map data.',
      multiplier: 0.85,
    })
  }

  const { value, applied } = applyFactors(base, factors)
  const reduced = applied.filter((f) => f.applied).map((f) => f.key)
  return {
    value,
    band: bandFor(value),
    present: true,
    factors: applied,
    basis: reduced.length
      ? `${src.label}, reduced by ${reduced.join(', ')}`
      : `${src.label}`,
  }
}

/**
 * The whole-POI TrustScore, 0-100, with the reasons that produced it.
 *
 * @returns {{
 *   score: number, band: string,
 *   attributes: Record<string, object>,
 *   reasons: Array<{sign: '+'|'-', text: string}>,
 *   completeness: number,
 * }}
 */
export function poiTrustScore(poi, ctx = {}) {
  const attributes = {}
  for (const key of Object.keys(ATTRIBUTES)) {
    attributes[key] = attributeConfidence(key, poi, ctx)
  }

  // Weighted over CORE only — see ATTRIBUTES.
  const coreWeight = CORE_ATTRIBUTES.reduce((s, k) => s + ATTRIBUTES[k].weight, 0)
  const core = CORE_ATTRIBUTES.reduce(
    (s, k) => s + attributes[k].value * ATTRIBUTES[k].weight, 0
  ) / coreWeight

  let value = core
  const reasons = []

  // ── Independent corroboration is the ONE thing allowed to be a plus.
  //
  // And it still is not a multiplier above 1, which the factor rules forbid for
  // good reason. Instead an unverified POI is not penalised and a CONTRADICTED
  // one is — so verification raises a score only in the sense that failing it
  // lowers one. That keeps "we checked and it agreed" from manufacturing
  // certainty out of a single postcode match.
  if (poi.verificationStatus === 'CROSS_CHECKED') {
    reasons.push({ sign: '+', text: `Checked against ${poi.verificationMethod === 'india_post_pincode' ? 'India Post’s pincode directory' : 'an independent source'} and it agreed` })
  } else if (poi.verificationStatus === 'CONTRADICTED') {
    const { value: v } = applyFactors(value, [{
      key: 'contradicted',
      reason: 'An independent source disagrees about where this is.',
      cap: 0.5,
    }])
    value = v
    reasons.push({ sign: '-', text: 'An independent source places this somewhere else' })
  }

  // ── The reasons a person would actually want to read, drawn from the factor
  // chains rather than restated — so a reason can never claim a penalty that
  // was not applied.
  for (const [key, conf] of Object.entries(attributes)) {
    for (const f of conf.factors) {
      if (f.applied) reasons.push({ sign: '-', text: `${ATTRIBUTES[key].label}: ${f.reason}` })
    }
  }
  if (attributes.location.value >= 0.75 && attributes.identity.value >= 0.75) {
    reasons.push({ sign: '+', text: 'Recently-refreshed map data agrees on its name and position' })
  }

  // Reported, never scored — see ATTRIBUTES for why enrichment does not feed
  // the number. "We know six things about this place" and "we trust the three
  // that matter" are different claims and both are worth having.
  const held = Object.values(attributes).filter((a) => a.present).length
  const completeness = Math.round((held / Object.keys(ATTRIBUTES).length) * 100)

  const score = Math.round(value * 100)
  return { score, band: bandFor(value), attributes, reasons, completeness }
}

/**
 * Does India Post agree with where OSM says this place is?
 *
 * The only independent check available today, and it is cheap: PincodeDirectory
 * is already seeded, and the join is one indexed lookup on a column most rows
 * do not even have.
 *
 * Deliberately checks the STATE, not the district or the city. A pincode's
 * delivery area is a route set, not a polygon — India publishes no pincode
 * boundaries — so a pincode legitimately spans districts and straddles city
 * edges, and asserting a district match would manufacture contradictions out of
 * correct data. State is the level at which the claim is safe.
 *
 * @param {string|null} postcode
 * @param {Array<{state: string}>} directoryRows  rows for that pincode
 * @param {string|null} expectedState
 * @returns {{status: string, method: string|null}}
 */
export function verifyByPincode(postcode, directoryRows, expectedState) {
  if (!postcode || !expectedState || !directoryRows?.length) {
    // Not checked is not a finding. A POI with no postcode is not suspicious;
    // it is a POI whose mapper did not fill in an optional tag.
    return { status: 'UNVERIFIED', method: null }
  }
  const norm = (s) => String(s ?? '').toLowerCase().replace(/\s+/g, ' ').trim()
  const states = new Set(directoryRows.map((r) => norm(r.state)))
  return states.has(norm(expectedState))
    ? { status: 'CROSS_CHECKED', method: 'india_post_pincode' }
    : { status: 'CONTRADICTED', method: 'india_post_pincode' }
}
