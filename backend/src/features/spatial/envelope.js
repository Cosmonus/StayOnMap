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
  }
}

/**
 * Confidence = weighted share of declared inputs that were actually available,
 * capped by the module's ceiling.
 *
 *   confidence = (sum of weights present / sum of all weights) * maxConfidence
 *
 * @param {Array<{key: string, weight: number}>} declared  module.inputs
 * @param {string[]} presentKeys  inputs that actually produced data this run
 * @param {number} maxConfidence  module ceiling, 0..1
 */
export function computeConfidence(declared, presentKeys, maxConfidence = 1) {
  const total = declared.reduce((sum, i) => sum + i.weight, 0)
  if (total === 0) return { value: 0, band: 'MINIMAL', basis: 'no inputs declared', inputsPresent: [], inputsMissing: [] }

  const present = new Set(presentKeys)
  const got = declared.filter((i) => present.has(i.key))
  const missing = declared.filter((i) => !present.has(i.key))
  const gotWeight = got.reduce((sum, i) => sum + i.weight, 0)

  // Round to 2dp. Anything finer is noise dressed as precision.
  const value = Math.round((gotWeight / total) * maxConfidence * 100) / 100

  return {
    value,
    band: bandFor(value),
    basis: `${got.length} of ${declared.length} expected inputs available`,
    inputsPresent: got.map((i) => i.key),
    inputsMissing: missing.map((i) => i.key),
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
 */
export function buildEnvelope(module, result) {
  const confidence = computeConfidence(
    module.inputs,
    result.inputsPresent ?? [],
    module.maxConfidence ?? 1
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
