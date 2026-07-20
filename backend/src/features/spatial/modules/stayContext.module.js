// Stay context — SHORT_STAY only. "How do guests get here, and what do they
// do once they have?"
//
// A guest's questions are almost the inverse of a tenant's. Nobody books a
// holiday flat because it has a good school catchment; they book it because
// it's 40 minutes from the airport and near things worth seeing.
import { fact, PROVENANCE } from '../envelope.js'
import { poisNear, pickNearest, poiConfidenceFactors, OSM_POI_SOURCE, OSM_POI_SOURCE_ID } from '../poiProvider.js'
import { walkDisplay, formatDistance } from '../proximity.js'

const ARRIVAL_RADIUS = 60_000 // airports serve a whole metro region
const LOCAL_RADIUS = 2_000    // what a guest will walk to

export default {
  key: 'stayContext',
  // v3: arrival/attraction facts carry `at` + place for read-time
  // re-anchoring, dining unions the food_cheap category (the fast_food fix in
  // poiCategories.js), and distance provenance corrected to DERIVED.
  version: 3, // v2: walk-time phrasing, counts as data
  appliesTo: ['SHORT_STAY'],
  ttlHours: 24 * 30,
  maxConfidence: 0.70,

  inputs: [
    { key: 'arrival_points', weight: 3 },
    { key: 'attractions',    weight: 2 },
    { key: 'dining',         weight: 2 },
    // Guests care about noise more than almost anyone — they're sleeping in an
    // unfamiliar bed for two nights. And it's the one thing we genuinely
    // cannot measure in India. Declared so the gap is visible.
    { key: 'noise_measured', weight: 2 },
  ],

  async compute({ lat, lng, city }) {
    const [arrival, local] = await Promise.all([
      poisNear(lat, lng, ARRIVAL_RADIUS, ['airport', 'railway_station', 'metro_station'], city),
      poisNear(lat, lng, LOCAL_RADIUS, ['attraction', 'restaurant', 'cafe', 'food_cheap', 'hotel'], city),
    ])

    if (!arrival.available) {
      return {
        facts: [],
        assessment: null,
        missing: ['Local data has not been loaded for this city yet.', NOISE_NOTE],
        inputsPresent: [],
        sources: [],
      }
    }

    const facts = []
    const inputsPresent = []

    const airport = pickNearest(arrival.byCategory?.airport ?? [])
    const station = pickNearest(arrival.byCategory?.railway_station ?? [])

    if (airport || station) inputsPresent.push('arrival_points')

    if (airport) {
      facts.push(fact({
        key: 'airport_distance',
        label: 'Nearest airport',
        value: airport.distanceM,
        unit: 'm',
        display: `${airport.name ?? 'Airport'} — ${formatDistance(airport.distanceM)}`,
        provenance: PROVENANCE.DERIVED,
        source: 'osm-poi',
        at: { lat: airport.lat, lng: airport.lng },
        place: airport.name ?? undefined,
        displayStyle: 'distance',
      }))
    }

    if (station) {
      facts.push(fact({
        key: 'station_distance',
        label: 'Nearest railway station',
        value: station.distanceM,
        unit: 'm',
        display: `${station.name ?? 'Station'} — ${formatDistance(station.distanceM)}`,
        provenance: PROVENANCE.DERIVED,
        source: 'osm-poi',
        at: { lat: station.lat, lng: station.lng },
        place: station.name ?? undefined,
        displayStyle: 'distance',
      }))
    }

    const attractions = local.byCategory?.attraction ?? []
    if (attractions.length) {
      inputsPresent.push('attractions')
      const headline = pickNearest(attractions)
      facts.push(fact({
        key: 'attractions_nearby',
        label: 'Things to see within 2 km',
        value: attractions.length,
        unit: 'count',
        display: `${attractions.length} — nearest ${headline.name ?? 'attraction'} ${walkDisplay(headline.distanceM)}`,
        provenance: PROVENANCE.DERIVED,
        source: 'osm-poi',
        count: attractions.length,
      }))
    }

    const dining = [
      ...(local.byCategory?.restaurant ?? []),
      ...(local.byCategory?.cafe ?? []),
      ...(local.byCategory?.food_cheap ?? []),
    ]
    if (dining.length) {
      inputsPresent.push('dining')
      const walkable = dining.filter((d) => d.distanceM <= 500).length
      facts.push(fact({
        key: 'dining_nearby',
        label: 'Places to eat',
        value: dining.length,
        unit: 'count',
        display: `${dining.length} within 2 km · ${walkable} within 500 m`,
        provenance: PROVENANCE.DERIVED,
        source: 'osm-poi',
        count: dining.length,
      }))
    }

    // Competing supply is genuinely useful to a host and mildly useful to a
    // guest, so it's stated flatly rather than framed as good or bad.
    const hotels = local.byCategory?.hotel ?? []
    if (hotels.length) {
      facts.push(fact({
        key: 'other_stays',
        label: 'Other places to stay nearby',
        value: hotels.length,
        unit: 'count',
        display: `${hotels.length} within 2 km`,
        provenance: PROVENANCE.DERIVED,
        source: 'osm-poi',
        count: hotels.length,
      }))
    }

    const missing = [NOISE_NOTE]
    if (!airport) {
      missing.push('No airport is mapped within 60 km of here.')
    }

    // "A residential spot rather than a visitor one" is also what a partial
    // fetch looks like, and a host would price against it.
    const confidenceFactors = await poiConfidenceFactors(OSM_POI_SOURCE_ID, city)

    return {
      facts,
      assessment: assess(airport, attractions.length, dining.length),
      missing,
      inputsPresent,
      sources: [{ ...OSM_POI_SOURCE, fetchedAt: arrival.fetchedAt }],
      confidenceFactors,
      // The local 2 km read, not the 60 km arrival one — a sparse count of
      // airports across a metro region says nothing about mapping quality.
      sparselyMapped: local.sparselyMapped,
    }
  },
}

const NOISE_NOTE =
  'How quiet it is at night is not shown. No measured noise data exists for ' +
  'Indian cities, and for a two-night stay that is exactly the thing a guess ' +
  'would get wrong.'

function assess(airport, attractionCount, diningCount) {
  const label =
    attractionCount >= 3 && diningCount >= 10 ? 'Well placed for visitors' :
    diningCount >= 10 ? 'Plenty to eat nearby, few sights' :
    attractionCount >= 3 ? 'Near the sights, quieter for food' :
    'A residential spot rather than a visitor one'

  const parts = []
  if (airport) parts.push(`Airport is ${formatDistance(airport.distanceM)} away.`)
  if (diningCount) parts.push(`${diningCount} places to eat within 2 km.`)
  if (!attractionCount) parts.push('No mapped attractions within 2 km.')

  return { label, detail: parts.join(' ') }
}
