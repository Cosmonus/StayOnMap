// PG context — PG only. "Can I eat, get to class or work, and get home safely
// at night?"
//
// PG residents are overwhelmingly students and young workers who don't cook,
// don't own a car, and travel at hours the rest of the city doesn't. That makes
// their questions specific: cheap food within walking distance, a college or
// employment centre in reach, and what the walk home looks like after dark.
import { fact, PROVENANCE } from '../envelope.js'
import { poisNear, OSM_POI_SOURCE } from '../poiProvider.js'
import { walkDisplay, formatDistance } from '../proximity.js'

const WALKABLE = 800
const REACHABLE = 3000

export default {
  key: 'pgContext',
  // v2: walk-time phrasing ("about a 3 min walk (200 m)"), counts as data,
  // sparselyMapped passthrough. Displays live in the stored envelope, so the
  // bump forces already-computed cells onto the new wording.
  version: 2,
  appliesTo: ['PG'],
  ttlHours: 24 * 30,
  maxConfidence: 0.65,

  inputs: [
    { key: 'food_access',    weight: 3 },
    { key: 'study_work',     weight: 3 },
    { key: 'daily_services', weight: 1 },
    // The question PG residents ask most and the one no dataset answers.
    // Street lighting is patchily mapped in OSM and crime statistics are not
    // published at street level in India. Declared so its absence is visible
    // rather than quietly ignored.
    { key: 'night_safety',   weight: 3 },
  ],

  async compute({ lat, lng, city }) {
    const [walk, reach] = await Promise.all([
      poisNear(lat, lng, WALKABLE, ['food_cheap', 'restaurant', 'cafe', 'laundry', 'pharmacy', 'atm'], city),
      poisNear(lat, lng, REACHABLE, ['college', 'bus_stop'], city),
    ])

    if (!walk.available) {
      return {
        facts: [],
        assessment: null,
        missing: ['Local data has not been loaded for this city yet.', SAFETY_NOTE],
        inputsPresent: [],
        sources: [],
      }
    }

    const facts = []
    const inputsPresent = []

    const food = [
      ...(walk.byCategory?.food_cheap ?? []),
      ...(walk.byCategory?.restaurant ?? []),
      ...(walk.byCategory?.cafe ?? []),
    ].sort((a, b) => a.distanceM - b.distanceM)

    if (food.length) {
      inputsPresent.push('food_access')
      facts.push(fact({
        key: 'food_walkable',
        label: 'Places to eat on foot',
        value: food.length,
        unit: 'count',
        display: `${food.length} within ${formatDistance(WALKABLE)} · nearest ${walkDisplay(food[0].distanceM)}`,
        provenance: PROVENANCE.MEASURED,
        source: 'osm-poi',
        count: food.length,
      }))
    }

    const colleges = reach.byCategory?.college ?? []
    if (colleges.length) {
      inputsPresent.push('study_work')
      facts.push(fact({
        key: 'nearest_college',
        label: 'Nearest college or university',
        value: colleges[0].distanceM,
        unit: 'm',
        display: `${colleges[0].name ?? 'College'} — ${walkDisplay(colleges[0].distanceM)}`,
        provenance: PROVENANCE.MEASURED,
        source: 'osm-poi',
        count: colleges.length,
      }))
    }

    const laundry = walk.byCategory?.laundry ?? []
    const pharmacy = walk.byCategory?.pharmacy ?? []
    const atm = walk.byCategory?.atm ?? []
    if (laundry.length || pharmacy.length || atm.length) inputsPresent.push('daily_services')

    for (const [key, label, list] of [
      ['laundry', 'Laundry', laundry],
      ['pharmacy', 'Pharmacy', pharmacy],
      ['atm', 'ATM', atm],
    ]) {
      if (!list.length) continue
      facts.push(fact({
        key: `nearest_${key}`,
        label,
        value: list[0].distanceM,
        unit: 'm',
        display: walkDisplay(list[0].distanceM),
        provenance: PROVENANCE.MEASURED,
        source: 'osm-poi',
        count: list.length,
      }))
    }

    const missing = [SAFETY_NOTE]
    if (!food.length) {
      missing.push(
        `No food outlets are mapped within ${formatDistance(WALKABLE)}. For a PG with no ` +
        'kitchen that matters — worth checking on a visit.'
      )
    }
    if (!laundry.length) {
      missing.push('No laundry is mapped nearby — OSM coverage of small services in India is thin, so ask rather than assume.')
    }

    return {
      facts,
      assessment: assess(food, colleges),
      missing,
      inputsPresent,
      sources: [OSM_POI_SOURCE],
      sparselyMapped: walk.sparselyMapped,
    }
  },
}

const SAFETY_NOTE =
  'How safe the walk home feels after dark is not shown, and it is the thing ' +
  'PG residents ask about most. Street lighting is barely mapped in India and ' +
  'crime data is not published street by street — visit at night before you ' +
  'decide, and read the community reviews below.'

function assess(food, colleges) {
  const walkableFood = food.filter((f) => f.distanceM <= 400).length

  const label =
    walkableFood >= 5 ? 'Plenty to eat within a few minutes' :
    food.length >= 3  ? 'Some food options on foot' :
    food.length > 0   ? 'Limited food nearby' :
    'No food mapped within walking distance'

  const parts = []
  // Distance-anchored, not a minutes claim: 400 m is ~7 min at the declared
  // walking method, so calling it "a 5-minute walk" would contradict our own
  // arithmetic ten pixels below.
  if (food.length) parts.push(`${walkableFood} places to eat within 400 m.`)
  if (colleges.length) parts.push(`Nearest college is ${formatDistance(colleges[0].distanceM)} away.`)
  else parts.push('No college mapped within 3 km.')

  return { label, detail: parts.join(' ') }
}
