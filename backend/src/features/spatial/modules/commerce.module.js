// Commerce — COMMERCIAL only. "Will customers actually walk past this door?"
//
// A shopkeeper's questions are not a renter's. Walkability to a pharmacy is
// irrelevant; what matters is whether there is trade happening on this street
// already, whether the neighbours pull the same customers or different ones,
// and whether anyone can park.
//
// Everything here comes from PoiIndex, so it costs nothing per query. What it
// CANNOT do is measure footfall — nobody sells per-street pedestrian counts for
// India — so it reports retail density as a stated proxy and says so.
import { fact, PROVENANCE } from '../envelope.js'
import { poisNear, pickNearest, OSM_POI_SOURCE } from '../poiProvider.js'
import { formatDistance } from '../proximity.js'

const IMMEDIATE = 300   // the same parade of shops
const CATCHMENT = 1500  // the area a small business draws from

// Businesses that bring people to a street for their own reasons. A shop next
// to a busy restaurant strip inherits its traffic; one next to a warehouse
// does not.
const FOOTFALL_DRIVERS = ['retail', 'restaurant', 'cafe', 'food_cheap', 'supermarket', 'bank', 'atm']
// Things that put people on the street at a predictable hour.
const ANCHORS = ['college', 'school', 'hospital', 'railway_station', 'bus_stop']

const DENSITY_METHOD =
  'count of mapped retail, food and banking premises within 300 m — a proxy for ' +
  'how much trade already happens here, not a measured pedestrian count'

export default {
  key: 'commerce',
  // v3: anchor/fuel facts carry `at` + place for read-time re-anchoring,
  // node/way dedup upstream changes counts, count provenance corrected to
  // DERIVED, and food_cheap actually matches fast food again (poiCategories.js).
  version: 3, // v2: counts as data. The 300 m facts deliberately keep plain
  // distances — a shop on the same parade is not a "walk", it's the same
  // stretch of street.
  appliesTo: ['COMMERCIAL'],
  ttlHours: 24 * 30,
  // Capped: the central claim (trade activity) is a density proxy, and no
  // amount of OSM completeness turns a shop count into a footfall measurement.
  maxConfidence: 0.65,

  inputs: [
    { key: 'retail_density', weight: 3 },
    { key: 'anchors',        weight: 2 },
    { key: 'parking',        weight: 1 },
    // Declared and permanently absent: there is no free or affordable per-street
    // pedestrian count for Indian cities. Holding this open keeps the module
    // honest about the difference between "busy area" and "busy doorway".
    { key: 'footfall_measured', weight: 3 },
  ],

  async compute({ lat, lng, city }) {
    const [immediate, catchment] = await Promise.all([
      poisNear(lat, lng, IMMEDIATE, FOOTFALL_DRIVERS, city),
      poisNear(lat, lng, CATCHMENT, [...FOOTFALL_DRIVERS, ...ANCHORS, 'fuel'], city),
    ])

    if (!immediate.available) {
      return {
        facts: [],
        assessment: null,
        missing: [
          'Local business data has not been loaded for this city yet.',
          FOOTFALL_NOTE,
        ],
        inputsPresent: [],
        sources: [],
      }
    }

    const facts = []
    const inputsPresent = ['retail_density']

    facts.push(fact({
      key: 'trade_density',
      label: 'Businesses on this stretch',
      value: immediate.total,
      unit: 'count',
      display: immediate.total === 0
        ? `nothing mapped within ${formatDistance(IMMEDIATE)}`
        : `${immediate.total} within ${formatDistance(IMMEDIATE)}`,
      provenance: PROVENANCE.DERIVED,
      source: 'osm-poi',
      method: DENSITY_METHOD,
      count: immediate.total,
    }))

    // Same-category neighbours are the ambiguous signal and deserve to be
    // presented as ambiguous: a row of clothing shops is either proven demand
    // or saturated competition, and which one depends on the trade. State the
    // count, don't score it.
    const competing = (immediate.byCategory.retail ?? []).length
    if (competing > 0) {
      facts.push(fact({
        key: 'similar_retail',
        label: 'Other retail nearby',
        value: competing,
        unit: 'count',
        display: `${competing} shop${competing === 1 ? '' : 's'} within ${formatDistance(IMMEDIATE)}`,
        provenance: PROVENANCE.DERIVED,
        source: 'osm-poi',
        count: competing,
      }))
    }

    const anchorHits = ANCHORS
      .map((k) => ({ key: k, list: catchment.byCategory?.[k] ?? [] }))
      .filter((a) => a.list.length > 0)

    if (anchorHits.length) {
      inputsPresent.push('anchors')
      const nearest = anchorHits
        .map((a) => ({ key: a.key, hit: pickNearest(a.list) }))
        .map((a) => ({ key: a.key, distanceM: a.hit.distanceM, name: a.hit.name, lat: a.hit.lat, lng: a.hit.lng }))
        .sort((a, b) => a.distanceM - b.distanceM)[0]

      facts.push(fact({
        key: 'nearest_anchor',
        label: 'Nearest crowd-puller',
        value: nearest.distanceM,
        unit: 'm',
        display: `${ANCHOR_LABEL[nearest.key] ?? nearest.key}${nearest.name ? ` (${nearest.name})` : ''} — ${formatDistance(nearest.distanceM)}`,
        provenance: PROVENANCE.DERIVED,
        source: 'osm-poi',
        at: { lat: nearest.lat, lng: nearest.lng },
        place: nearest.name ? `${ANCHOR_LABEL[nearest.key] ?? nearest.key} (${nearest.name})` : (ANCHOR_LABEL[nearest.key] ?? nearest.key),
        displayStyle: 'distance',
      }))
    }

    const fuel = catchment.byCategory?.fuel ?? []
    if (fuel.length) {
      inputsPresent.push('parking')
      const nearestFuel = pickNearest(fuel)
      facts.push(fact({
        key: 'fuel_nearby',
        label: 'Fuel station nearby',
        value: nearestFuel.distanceM,
        unit: 'm',
        display: `${formatDistance(nearestFuel.distanceM)} away`,
        provenance: PROVENANCE.DERIVED,
        source: 'osm-poi',
        at: { lat: nearestFuel.lat, lng: nearestFuel.lng },
        place: nearestFuel.name ?? undefined,
        displayStyle: 'distance',
      }))
    }

    const missing = [FOOTFALL_NOTE]
    // Parking is the question every Indian shopkeeper asks second and OSM
    // answers worst — on-street parking is almost never mapped.
    missing.push(
      'Customer parking is not shown — on-street parking is rarely mapped in ' +
      'OpenStreetMap, so an absence here means nothing either way.'
    )
    if (immediate.sparselyMapped) {
      missing.push(
        `Only ${immediate.total} businesses mapped within ${formatDistance(IMMEDIATE)} — this area ` +
        'looks lightly mapped, so treat the count as a floor, not a total.'
      )
    }

    return {
      facts,
      assessment: assess(immediate.total, anchorHits.length),
      missing,
      inputsPresent,
      sources: [{ ...OSM_POI_SOURCE, fetchedAt: immediate.fetchedAt }],
      sparselyMapped: immediate.sparselyMapped,
    }
  },
}

const ANCHOR_LABEL = {
  college: 'College', school: 'School', hospital: 'Hospital',
  railway_station: 'Railway station', bus_stop: 'Bus station',
}

const FOOTFALL_NOTE =
  'We cannot tell you how many people walk past this door. No affordable ' +
  'per-street pedestrian data exists for Indian cities, so the figures above ' +
  'describe how much business happens nearby, which is a different thing.'

function assess(density, anchorCount) {
  const label =
    density >= 25 ? 'Busy commercial stretch' :
    density >= 10 ? 'Established local trade' :
    density >= 3  ? 'Quiet parade — a few businesses nearby' :
    'Little existing trade on this stretch'

  const parts = []
  parts.push(density === 0
    ? 'Nothing else is mapped as trading within 300 m.'
    : `${density} businesses mapped within 300 m.`)
  if (anchorCount > 0) parts.push('There is at least one crowd-puller in the catchment.')

  return { label, detail: parts.join(' ') }
}
