// Terrain — "where does the water go?"
//
// The honest framing of a question this platform gets asked constantly and has
// never been able to answer. Every prior attempt at flood risk in this codebase
// was refused for the same reason (see .claude/maps.md): India publishes flood
// zones as municipal PDFs and Bhuvan map images, not as anything queryable, so
// a "flood risk: MEDIUM" badge would be invented.
//
// What CAN be said truthfully is where this spot sits relative to the ground
// around it. A place several metres below its surroundings is where water
// collects — that is drainage, which is a fact about terrain, not a prediction
// about floods. The module says exactly that much and names the gap.
//
// Type framing matters here more than in most modules. The same -4m reading is
// a monsoon warning for a ground-floor flat, a stock-damage risk for a shop,
// and a site-levelling cost for a plot — so the assessment varies by type while
// the facts, which are properties of the ground, do not.
//
// See docs/spatial-intelligence.md §5.8.
import { fact, PROVENANCE } from '../envelope.js'
import { elevation, SRTM_SOURCE } from '../providers.js'
import { ALL_TYPES, RESIDENTIAL_TYPES } from '../propertyTypes.js'

// Below this, the difference is inside SRTM's own vertical error (~±16m
// absolute, but far better relatively over short distances) and saying
// anything about it would be reading noise.
const MEANINGFUL_RELATIVE_M = 1.5

export default {
  key: 'terrain',
  version: 1,
  // Water finds every property type. A warehouse floods, a plot needs
  // levelling, a guest cancels when the road is knee-deep.
  appliesTo: ALL_TYPES,
  // The assessment — not the facts — differs per type, so each type needs its
  // own stored envelope. Cheap: the provider result is cached per coordinate
  // for six months, so a second type costs an extra JSON slot, not a refetch.
  variesByType: true,
  // Terrain is the most stable thing this layer measures.
  ttlHours: 90 * 24,
  // No inherent inference ceiling: SRTM is a radar measurement, not a model.
  // What holds this module down is the two inputs below that don't exist yet,
  // which is the honest mechanism rather than a hand-picked cap.
  maxConfidence: 1,

  inputs: [
    { key: 'srtm_elevation', weight: 3 },
    { key: 'terrain_ring',   weight: 2 },
    // Declared, absent, deliberate. These are what would turn "this ground is
    // low" into "this place floods", and until they exist the module should
    // not read as a complete answer to the question it raises.
    { key: 'water_distance', weight: 2 }, // needs OSM water polygon ingestion
    { key: 'flood_history',  weight: 3 }, // no parcel-level data exists for India
  ],

  async compute({ lat, lng, propertyType }) {
    const terrain = await elevation(lat, lng)

    if (!terrain) {
      return {
        facts: [],
        assessment: null,
        missing: ['Elevation data was unavailable for this location.', ...DEFERRED_NOTES],
        inputsPresent: [],
        sources: [],
      }
    }

    const facts = [
      fact({
        key: 'elevation',
        label: 'Height above sea level',
        value: terrain.elevationM,
        unit: 'm',
        display: `${terrain.elevationM} m above sea level`,
        // A radar observation of the ground, resampled to a 30m grid. Not a
        // model output, and not arithmetic over one either.
        provenance: PROVENANCE.MEASURED,
        source: 'srtm',
      }),
    ]

    const inputsPresent = ['srtm_elevation']

    if (terrain.relativeM != null) {
      inputsPresent.push('terrain_ring')

      facts.push(fact({
        key: 'relative_height',
        label: 'Compared with the surrounding area',
        value: terrain.relativeM,
        unit: 'm',
        display: describeRelative(terrain.relativeM),
        provenance: PROVENANCE.DERIVED,
        source: 'srtm',
        method: `this point's height minus the average of ${terrain.sampleCount - 1} ` +
          'readings taken 750 m out in eight directions',
      }))

      facts.push(fact({
        key: 'local_relief',
        label: 'How hilly it is here',
        value: terrain.reliefM,
        unit: 'm',
        display: terrain.reliefM <= 5
          ? `${terrain.reliefM} m between the highest and lowest ground nearby — essentially flat`
          : `${terrain.reliefM} m between the highest and lowest ground within 750 m`,
        provenance: PROVENANCE.DERIVED,
        source: 'srtm',
        method: 'the range between the highest and lowest of the surrounding readings',
      }))
    }

    return {
      facts,
      assessment: assess(terrain, propertyType),
      missing: [
        ...DEFERRED_NOTES,
        // The load-bearing caveat. Someone reading "sits 4 m lower than its
        // surroundings" will hear "this floods", and the two are not the same
        // claim — drainage is about ground, flooding is also about drains,
        // pumps and what got built upstream last year.
        'This describes the shape of the ground, not flood risk. Whether water ' +
        'actually collects here also depends on drainage, stormwater works and ' +
        'recent construction, none of which are published as data anywhere we ' +
        'can read. Ask locally, and ask about last monsoon specifically.',
      ],
      inputsPresent,
      sources: [SRTM_SOURCE],
    }
  },
}

const DEFERRED_NOTES = [
  'Distance to the nearest river, lake or drainage channel is not yet available.',
  'Recorded flood history is not shown: no parcel-level flood record is ' +
  'published for Indian cities in a form anyone can query, and we would rather ' +
  'show nothing than a risk level we invented.',
]

function describeRelative(relativeM) {
  if (Math.abs(relativeM) < MEANINGFUL_RELATIVE_M) {
    return 'Level with the surrounding area'
  }
  const magnitude = Math.abs(relativeM).toFixed(1)
  return relativeM < 0
    ? `About ${magnitude} m lower than the ground around it`
    : `About ${magnitude} m higher than the ground around it`
}

/**
 * The same terrain, framed for who is asking.
 *
 * Kept as one function with a per-type sentence rather than four modules: the
 * measurement is identical and only the consequence differs, so duplicating
 * the module would duplicate everything except the part that varies.
 */
function assess(terrain, propertyType) {
  const rel = terrain.relativeM

  if (rel == null) {
    return {
      label: `${terrain.elevationM} m above sea level`,
      detail: 'We could not read the surrounding ground, so there is nothing to ' +
        'compare this height against.',
    }
  }

  const low = rel <= -MEANINGFUL_RELATIVE_M
  const high = rel >= MEANINGFUL_RELATIVE_M

  const label = low ? 'Sits lower than the ground around it'
    : high ? 'Sits higher than the ground around it'
    : 'Level ground'

  const base = low
    ? `About ${Math.abs(rel).toFixed(1)} m below its surroundings — in heavy rain, water runs towards ground like this.`
    : high
      ? `About ${rel.toFixed(1)} m above its surroundings — water runs away from ground like this.`
      : 'The ground here is level with everything around it, so rainwater has no particular reason to collect or drain.'

  return { label, detail: `${base} ${consequence(low, high, propertyType)}`.trim() }
}

function consequence(low, high, propertyType) {
  if (!low && !high) return ''

  if (propertyType === 'LAND') {
    return low
      ? 'For a plot, budget for levelling or raised plinth work, and check what the ' +
        'drainage looks like before the monsoon rather than after.'
      : 'For a plot, that is the easier side of the trade — less levelling, better natural drainage.'
  }

  if (propertyType === 'COMMERCIAL') {
    return low
      ? 'Worth asking specifically about waterlogging: a shop or godown on low ground ' +
        'risks stock at floor level, and a day of standing water outside is a day closed.'
      : 'That is helpful for a shop or godown — less exposure to standing water at floor level.'
  }

  if (propertyType === 'SHORT_STAY') {
    return low
      ? 'Worth knowing for monsoon bookings: approach roads on low ground are the first ' +
        'to become impassable, and guests cancel on access, not on rain.'
      : 'Helpful during the monsoon — approach roads on higher ground stay usable longer.'
  }

  if (propertyType === 'PG' || RESIDENTIAL_TYPES.includes(propertyType)) {
    return low
      ? 'Worth asking the owner what happened here last monsoon, and preferring an ' +
        'upper floor if the answer is vague.'
      : 'That generally works in your favour during the monsoon.'
  }

  return ''
}
