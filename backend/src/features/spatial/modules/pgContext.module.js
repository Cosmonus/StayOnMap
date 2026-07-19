// PG context — PG only. "Can I eat, get to class or work, and get home safely
// at night?"
//
// PG residents are overwhelmingly students and young workers who don't cook,
// don't own a car, and travel at hours the rest of the city doesn't. That makes
// their questions specific: cheap food within walking distance, a college or
// employment centre in reach, and what the walk home looks like after dark.
import { fact, PROVENANCE } from '../envelope.js'
import { poisNear, pickNearest, OSM_POI_SOURCE } from '../poiProvider.js'
import { walkDisplay, formatDistance } from '../proximity.js'

const WALKABLE = 800
const REACHABLE = 3000

export default {
  key: 'pgContext',
  // v3: nearest facts carry `at` + place for read-time re-anchoring, distance
  // provenance corrected to DERIVED, and the cheap-food signal is real again —
  // fast_food now lands in `food_cheap` instead of colliding into `restaurant`
  // (see poiCategories.js), so this module finally sees what it queries for.
  version: 3, // v2: walk-time phrasing, counts as data
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
        provenance: PROVENANCE.DERIVED,
        source: 'osm-poi',
        count: food.length,
      }))
    }

    const colleges = reach.byCategory?.college ?? []
    if (colleges.length) {
      inputsPresent.push('study_work')
      const college = pickNearest(colleges)
      facts.push(fact({
        key: 'nearest_college',
        label: 'Nearest college or university',
        value: college.distanceM,
        unit: 'm',
        display: `${college.name ?? 'College'} — ${walkDisplay(college.distanceM)}`,
        provenance: PROVENANCE.DERIVED,
        source: 'osm-poi',
        count: colleges.length,
        at: { lat: college.lat, lng: college.lng },
        place: college.name ?? undefined,
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
      const nearest = pickNearest(list)
      facts.push(fact({
        key: `nearest_${key}`,
        label,
        value: nearest.distanceM,
        unit: 'm',
        display: `${nearest.name ? `${nearest.name} — ` : ''}${walkDisplay(nearest.distanceM)}`,
        provenance: PROVENANCE.DERIVED,
        source: 'osm-poi',
        count: list.length,
        at: { lat: nearest.lat, lng: nearest.lng },
        place: nearest.name ?? undefined,
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
      sources: [{ ...OSM_POI_SOURCE, fetchedAt: walk.fetchedAt }],
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
