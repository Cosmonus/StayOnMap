// The envelope — the single shape every spatial intelligence module returns.
//
// Uniformity here is what buys two things that are otherwise expensive:
// the frontend renders all modules with one component (adding a module is a
// backend-only change), and confidence becomes arithmetic instead of a number
// someone typed.
//
// Three rules are enforced in this file rather than left to good intentions.
// They are the difference between "explains the ecosystem" and "generates a
// score", which is the whole point of the layer. See docs/spatial-intelligence.md §5.0.
//
//   1. Every fact declares its provenance, and an ESTIMATED fact must say by
//      what method. Enforced in fact() — a bad fact throws at build time, and
//      tests/spatial-provenance.test.js walks every module's output.
//   2. Confidence is computed from which declared inputs were actually
//      available, never authored. A module cannot report certainty it lacks.
//   3. A module that is inherently inferential declares maxConfidence, which
//      caps it no matter how much data arrives. Noise estimation is 0.45
//      because there is no measured noise data in India and there won't be
//      one next quarter.

/**
 * How a fact came to exist. The UI renders these three visually distinctly —
 * a user scanning a card should be able to tell an observation from an
 * inference without reading the method string.
 */
export const PROVENANCE = {
  /** Someone or something observed this. A station's coordinates, a rent figure. */
  MEASURED: 'MEASURED',
  /** Arithmetic over MEASURED inputs, adding no assumption. Counts, distances. */
  DERIVED: 'DERIVED',
  /** A model or heuristic stands between the data and the claim. Requires `method`. */
  ESTIMATED: 'ESTIMATED',
}

export const STATUS = {
  /** Every required input was available. */
  OK: 'OK',
  /** Usable, but something material is missing. `missing[]` says what. */
  PARTIAL: 'PARTIAL',
  /** Not enough to say anything honest. Renders as "we don't know", not as zero. */
  UNAVAILABLE: 'UNAVAILABLE',
}

// Bands are the primary UI; the raw number is the detail. A bare "61%" implies
// a precision this method does not have.
export const CONFIDENCE_BANDS = [
  { min: 0.75, band: 'HIGH' },
  { min: 0.50, band: 'MODERATE' },
  { min: 0.25, band: 'LOW' },
  { min: 0.00, band: 'MINIMAL' },
]

export function bandFor(value) {
  return CONFIDENCE_BANDS.find((b) => value >= b.min).band
}

/**
 * Build one fact, validating the provenance contract.
 *
 * Throws rather than warns: a fact with no provenance is exactly the
 * unattributed number this layer exists to prevent, and letting it through
 * with a console warning means it ships.
 *
 * @param {object} f
 * @param {string} f.key         stable machine key, e.g. 'nearest_metro'
 * @param {string} f.label       human label, e.g. 'Nearest metro'
 * @param {number|string|null} f.value  the raw value (null = known-absent, see below)
 * @param {string} [f.unit]      'm' | 'min' | 'count' | ...
 * @param {string} f.display     pre-formatted for display, e.g. '420 m (~6 min walk)'
 * @param {string} f.provenance  one of PROVENANCE
 * @param {string} f.source      source id, must appear in the envelope's sources[]
 * @param {string} [f.observedAt] ISO date the underlying data was observed
 * @param {string} [f.method]    REQUIRED for ESTIMATED — plain language, shown to users
 * @param {number} [f.count]     how many of this thing are in range — carried as
 *                               data, not only inside the display string, so the
 *                               UI's summary chips read real numbers instead of
 *                               parsing prose
 * @param {{lat: number, lng: number}} [f.at]  coordinates of the place this fact
 *                               points to. Facts are computed from the geohash
 *                               CELL centre (up to ~108 m from an actual
 *                               property in the cell); carrying the target's
 *                               coordinates lets the read path re-derive the
 *                               distance from the property's own position —
 *                               see reanchor.js. Only ever OSM/owned-data
 *                               coordinates; Google-sourced facts must not
 *                               carry `at` (their content is not persistable).
 * @param {string} [f.place]     the place's name, when known — used by the
 *                               re-anchored display ("Apollo Pharmacy — …")
 * @param {number} [f.withinM]   the radius a `count` refers to, so a rebuilt
 *                               display can restate "N within 1.6 km"
 * @param {string} [f.displayStyle] 'walk' (default — walkDisplay phrasing) or
 *                               'distance' (plain distance, e.g. metro facts
 *                               that pair with a separate walk-time fact)
 */
export function fact(f) {
  if (!f?.key) throw new Error('spatial fact: key is required')
  if (!f.label) throw new Error(`spatial fact ${f.key}: label is required`)
  if (!f.display) throw new Error(`spatial fact ${f.key}: display is required`)
  if (!PROVENANCE[f.provenance]) {
    throw new Error(`spatial fact ${f.key}: provenance must be one of ${Object.keys(PROVENANCE).join(', ')}`)
  }
  if (!f.source) throw new Error(`spatial fact ${f.key}: source is required`)
  if (f.provenance === PROVENANCE.ESTIMATED && !f.method) {
    throw new Error(
      `spatial fact ${f.key}: ESTIMATED facts must carry a plain-language method — ` +
      'an unexplained estimate is indistinguishable from an invented number'
    )
  }
  if (f.at != null && (typeof f.at.lat !== 'number' || typeof f.at.lng !== 'number')) {
    throw new Error(`spatial fact ${f.key}: at must be { lat, lng } numbers when present`)
  }
  return {
    key: f.key,
    label: f.label,
    value: f.value ?? null,
    unit: f.unit ?? null,
    display: f.display,
    provenance: f.provenance,
    source: f.source,
    observedAt: f.observedAt ?? null,
    method: f.method ?? null,
    count: f.count ?? null,
    at: f.at ?? null,
    place: f.place ?? null,
    withinM: f.withinM ?? null,
    displayStyle: f.displayStyle ?? null,
  }
}

/**
 * Apply one confidence factor, enforcing the rule the whole mechanism rests on.
 *
 * A factor may only ever REDUCE. That is not a stylistic preference: input
 * availability is the only signal that has actually been *measured*, and
 * anything else — how fresh the data is, whether the fetch completed, how
 * precisely the cell locates the property — is a reason to trust it less, never
 * a reason to trust it more. Without this rule, "confidence v2" becomes a set
 * of knobs someone turns until the cards look good, which is the failure mode
 * this layer exists to prevent.
 *
 * Two forms, because they answer different questions:
 *   - `multiplier` — we know roughly HOW MUCH worse this is (0 < m <= 1)
 *   - `cap`        — we know it is worse but not by how much, so we refuse to
 *                    claim above a ceiling rather than invent a magnitude
 *
 * @param {number} value  current 0..1 confidence
 * @param {{key: string, reason: string, multiplier?: number, cap?: number}} f
 * @returns {number}
 */
function applyFactor(value, f) {
  if (!f?.key) throw new Error('confidence factor: key is required')
  if (!f.reason) {
    throw new Error(
      `confidence factor ${f.key}: reason is required — an unexplained ` +
      'confidence penalty is as opaque as an unexplained number'
    )
  }
  if (f.multiplier == null && f.cap == null) {
    throw new Error(`confidence factor ${f.key}: needs a multiplier or a cap`)
  }
  if (f.multiplier != null && !(f.multiplier > 0 && f.multiplier <= 1)) {
    throw new Error(
      `confidence factor ${f.key}: multiplier must be in (0, 1] — a factor ` +
      'above 1 would raise confidence above what input availability justifies'
    )
  }
  if (f.cap != null && !(f.cap >= 0 && f.cap <= 1)) {
    throw new Error(`confidence factor ${f.key}: cap must be in [0, 1]`)
  }

  let next = value
  if (f.multiplier != null) next *= f.multiplier
  if (f.cap != null) next = Math.min(next, f.cap)
  return next
}

/**
 * Confidence = weighted share of declared inputs that were actually available,
 * capped by the module's ceiling, then reduced by any applicable factors.
 *
 *   base       = (sum of weights present / sum of all weights) * maxConfidence
 *   confidence = base, reduced by each factor in turn
 *
 * The per-factor breakdown is returned alongside the number, because "why is
 * this 0.48" is the useful half. A bare score invites the reader to treat it as
 * a measurement of the neighbourhood rather than a measurement of our own
 * knowledge of it.
 *
 * @param {Array<{key: string, weight: number}>} declared  module.inputs
 * @param {string[]} presentKeys  inputs that actually produced data this run
 * @param {number} maxConfidence  module ceiling, 0..1
 * @param {Array<{key, reason, multiplier?, cap?}>} [factors]  reducing-only
 */
export function computeConfidence(declared, presentKeys, maxConfidence = 1, factors = []) {
  const total = declared.reduce((sum, i) => sum + i.weight, 0)
  if (total === 0) {
    return {
      value: 0, base: 0, band: 'MINIMAL', basis: 'no inputs declared',
      inputsPresent: [], inputsMissing: [], factors: [],
    }
  }

  const present = new Set(presentKeys)
  const got = declared.filter((i) => present.has(i.key))
  const missing = declared.filter((i) => !present.has(i.key))
  const gotWeight = got.reduce((sum, i) => sum + i.weight, 0)

  // Round to 2dp. Anything finer is noise dressed as precision.
  const round = (n) => Math.round(n * 100) / 100
  const base = round((gotWeight / total) * maxConfidence)

  const applied = []
  let value = base
  for (const f of factors ?? []) {
    const before = value
    // The arithmetic stays UNROUNDED; only the report is rounded.
    //
    // Rounding the running value at each step looks tidier and is wrong in the
    // most dangerous direction: Math.round is half-up, so `round(0.495) = 0.50`
    // RAISES the value. With base 0.50 and two ×0.99 factors, every step
    // rounds back to 0.50 — both reductions report `applied: false`, the basis
    // line stops mentioning them, and confidence ends higher than the factors
    // said it should. A rule enforced by a throw elsewhere in this file would
    // have been quietly undone by a rounding mode.
    //
    // Rounding both ends of the report instead keeps the displayed chain
    // continuous (factor N's `to` is exactly factor N+1's `from`) while
    // `applied` is decided on the real numbers.
    value = applyFactor(value, f)
    // Report every declared factor, including the ones that changed nothing —
    // "coverage was complete, so this did not reduce anything" is information.
    applied.push({
      key: f.key,
      reason: f.reason,
      multiplier: f.multiplier ?? null,
      cap: f.cap ?? null,
      from: round(before),
      to: round(value),
      // Decided on the unrounded values: a factor that genuinely reduced by
      // 0.004 did reduce, whatever the 2dp display shows.
      applied: value < before,
    })
  }
  value = round(value)

  const reduced = applied.filter((f) => f.applied)
  const basis = reduced.length
    ? `${got.length} of ${declared.length} expected inputs available, reduced by ${reduced.map((f) => f.key).join(', ')}`
    : `${got.length} of ${declared.length} expected inputs available`

  return {
    value,
    base,
    band: bandFor(value),
    basis,
    inputsPresent: got.map((i) => i.key),
    inputsMissing: missing.map((i) => i.key),
    factors: applied,
  }
}

/**
 * Assemble a module result into the canonical envelope.
 *
 * @param {object} module  the module definition (key, version, maxConfidence, inputs, ttlHours)
 * @param {object} result  what the module's compute() returned
 * @param {Array} result.facts
 * @param {{label: string, detail: string}} result.assessment
 * @param {string[]} [result.missing]        plain-language "what we don't know"
 * @param {string[]} result.inputsPresent
 * @param {Array<{name,license,fetchedAt}>} [result.sources]
 * @param {boolean|null} [result.sparselyMapped]  true when the area looks
 *        under-mapped in OSM — carried structurally (not only as a missing[]
 *        sentence) so the UI can caveat counts without string-matching prose
 * @param {Array<{key, reason, multiplier?, cap?}>} [result.confidenceFactors]
 *        reducing-only adjustments beyond input availability — e.g. the ETL run
 *        that produced this module's data knew its coverage was incomplete.
 *        See computeConfidence.
 */
export function buildEnvelope(module, result) {
  const confidence = computeConfidence(
    module.inputs,
    result.inputsPresent ?? [],
    module.maxConfidence ?? 1,
    result.confidenceFactors ?? []
  )

  const facts = result.facts ?? []
  // A module with no facts has nothing to say, whatever its inputs reported.
  // Saying so is the honest outcome; a zero score is not.
  const status = facts.length === 0
    ? STATUS.UNAVAILABLE
    : (confidence.inputsMissing.length > 0 ? STATUS.PARTIAL : STATUS.OK)

  const now = new Date()
  // A module that produced nothing must NOT inherit the happy-path TTL. The
  // infrastructure module has a 30-day TTL and returns UNAVAILABLE until the
  // POI table is seeded — so a cell computed before the seed would have kept
  // saying "not loaded for this city" for a month after the data landed.
  // "We have no data" expires quickly; "here is the data" is what lasts.
  const ttlHours = status === STATUS.UNAVAILABLE ? 1 : (module.ttlHours ?? 24)
  const staleAfter = new Date(now.getTime() + ttlHours * 60 * 60 * 1000)

  return {
    key: module.key,
    version: module.version,
    status,
    assessment: result.assessment ?? null,
    facts,
    confidence,
    missing: result.missing ?? [],
    sources: result.sources ?? [],
    sparselyMapped: result.sparselyMapped ?? null,
    // WHY there is nothing, when there is nothing.
    //
    // `unavailableEnvelope` has always carried a reason, but it only fires when
    // a module THROWS. A module that returns normally with zero facts — because
    // an upstream answered with nothing — lands here instead, and until
    // 2026-07-28 that produced an UNAVAILABLE envelope with no way to tell
    // "the provider was down" from "there is genuinely nothing here".
    //
    // That is not hypothetical: Chennai's environment cell reads 0 of 4 inputs
    // in production while Open-Meteo answers that coordinate fine, and the
    // payload cannot say which of the two it is (see
    // docs/spatial-research-2026-07-28.md §4). Only meaningful when UNAVAILABLE.
    unavailableReason: status === STATUS.UNAVAILABLE ? (result.unavailableReason ?? null) : null,
    computedAt: now.toISOString(),
    staleAfter: staleAfter.toISOString(),
  }
}

/**
 * The envelope for a module that could not run at all.
 *
 * Deliberately still an envelope, not a null: the frontend renders "we don't
 * know this, and here's why" the same way it renders everything else. A
 * missing module that silently disappears from the page reads as "nothing to
 * report here", which is a different and false claim.
 */
export function unavailableEnvelope(module, reason) {
  const now = new Date()
  return {
    key: module.key,
    version: module.version,
    status: STATUS.UNAVAILABLE,
    assessment: null,
    facts: [],
    confidence: { value: 0, band: 'MINIMAL', basis: 'no inputs available', inputsPresent: [], inputsMissing: module.inputs.map((i) => i.key) },
    missing: [reason],
    sources: [],
    computedAt: now.toISOString(),
    // Retry sooner than a successful run — a failure is usually transient.
    staleAfter: new Date(now.getTime() + 60 * 60 * 1000).toISOString(),
  }
}
