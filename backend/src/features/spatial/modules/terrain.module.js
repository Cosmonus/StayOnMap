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
import { nearestWater, SEARCH_RADIUS_M, OSM_WATER_SOURCE } from '../waterLookup.js'
import { ALL_TYPES, RESIDENTIAL_TYPES } from '../propertyTypes.js'

// Below this, the difference is inside SRTM's own vertical error (~±16m
// absolute, but far better relatively over short distances) and saying
// anything about it would be reading noise.
const MEANINGFUL_RELATIVE_M = 1.5

export default {
  key: 'terrain',
  // v2 (2026-07-28): water_distance landed. The bump is load-bearing — without
  // it, cells already stored keep serving the waterless envelope for the full
  // 90-day TTL, so the new input would reach no property page.
  version: 2,
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
    // `water_distance` landed 2026-07-28 (WaterBody + waterLookup.js). It says
    // where the water IS. `flood_history` — whether water has ever COME here —
    // remains absent, and the two are not the same claim. The module must still
    // not read as a complete answer to the question it raises.
    { key: 'water_distance', weight: 2 },
    { key: 'flood_history',  weight: 3 }, // no parcel-level data exists for India
  ],

  async compute({ lat, lng, propertyType }) {
    // Independent upstreams: a water lookup that fails must not cost the
    // elevation reading, which is the module's primary fact.
    const [terrain, water] = await Promise.all([
      elevation(lat, lng),
      nearestWater(lat, lng),
    ])

    if (!terrain) {
      return {
        facts: [],
        assessment: null,
        missing: ['Elevation data was unavailable for this location.', ...DEFERRED_NOTES],
        inputsPresent: [],
        sources: [],
        unavailableReason: 'The elevation lookup returned nothing for this ' +
          'location. This is an upstream failure on our side, not a statement ' +
          'that the ground here is unmeasured.',
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

    // "We could not look" (null) and "we looked, there is none within 3 km"
    // (available, no body) are different answers, and only the first is a gap.
    // Collapsing them would make an unseeded city look like a desert.
    if (water?.available) {
      inputsPresent.push('water_distance')
      facts.push(waterFact(water.body))
    }

    return {
      facts,
      assessment: assess(terrain, propertyType),
      missing: [
        ...(water?.available ? [] : [WATER_UNAVAILABLE_NOTE]),
        FLOOD_HISTORY_NOTE,
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
      // Only cite a source we actually showed something from.
      sources: [SRTM_SOURCE, ...(water?.available ? [OSM_WATER_SOURCE] : [])],
    }
  },
}

const WATER_UNAVAILABLE_NOTE =
  'Distance to the nearest river, lake or drainage channel is not yet available.'

const FLOOD_HISTORY_NOTE =
  'Recorded flood history is not shown: no parcel-level flood record is ' +
  'published for Indian cities in a form anyone can query, and we would rather ' +
  'show nothing than a risk level we invented.'

// Kept for the no-elevation early return, which has no water reading to report.
const DEFERRED_NOTES = [WATER_UNAVAILABLE_NOTE, FLOOD_HISTORY_NOTE]

/**
 * Where the water is — stated as a location, never as a hazard.
 *
 * This fact sits on the same card as "sits 4 m lower than the ground around
 * it", and a reader will put the two together into "this floods". They are not
 * that claim and this wording must not help them become it: no risk word, no
 * severity, no implication of direction. `FLOOD_HISTORY_NOTE` stays visible
 * directly beneath, and tests/spatial-water.test.js pins the vocabulary.
 */
function waterFact(body) {
  if (!body) {
    return fact({
      key: 'nearest_water',
      label: 'Nearest water',
      // A real answer, not a gap: null value with a display that says so.
      value: null,
      display: `No mapped lake, river or canal within ${SEARCH_RADIUS_M / 1000} km`,
      provenance: PROVENANCE.DERIVED,
      source: 'openstreetmap',
      method: 'a search of mapped water bodies around this address',
    })
  }

  const named = body.name ? `${body.name}` : `An unnamed ${body.label}`
  return fact({
    key: 'nearest_water',
    label: 'Nearest water',
    value: body.distanceM,
    unit: 'm',
    place: body.name ?? null,
    // The mapped edge, so reanchor.js and walkEnrich.js can treat this like
    // every other distance fact rather than a special case.
    at: body.at,
    display: body.inside
      ? `${named} — this location sits on the water`
      : `${named}, ${body.distanceM} m away`,
    // Haversine between measured points is arithmetic, which is the definition
    // of DERIVED. The accuracy pass made this exact correction everywhere else.
    provenance: PROVENANCE.DERIVED,
    source: 'openstreetmap',
    method: 'straight-line distance from this address to the mapped edge of the water body',
    displayStyle: 'distance',
  })
}

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
