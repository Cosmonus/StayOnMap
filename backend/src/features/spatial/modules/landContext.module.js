// Land context — LAND only. "Is this plot reachable, is it near anything, and
// is it likely to flood?"
//
// The honest position of this module is that most of what a land buyer needs
// is NOT spatial. Title, patta, DTCP/RERA approval, encumbrance, soil, water
// table — those decide the purchase, and none of them can be derived from a
// coordinate. Several are already fields on the listing (`approvalStatus`,
// `landType`, `roadWidth`, `extent`) and belong to property intelligence, not
// here.
//
// So this module deliberately answers a narrow question well rather than a
// broad one badly, and says plainly what it cannot cover. Getting that boundary
// wrong — implying a coordinate can tell you whether a title is clean — would
// be the most damaging thing this whole layer could do.
import { fact, PROVENANCE } from '../envelope.js'
import { poisNear, pickNearest, poiConfidenceFactors, OSM_POI_SOURCE, OSM_POI_SOURCE_ID } from '../poiProvider.js'
import { CITY_CENTERS, haversineKm } from '../../../config/cityCenters.js'
import { walkDisplay } from '../proximity.js'

// A plot draws on a much wider area than a flat — 5km is a short drive.
const CONTEXT_RADIUS = 5000

// Signs that development has already reached this area. Not a valuation and
// not a forecast: just what exists today, within a drive.
const DEVELOPMENT_MARKERS = ['school', 'hospital', 'supermarket', 'bank', 'fuel', 'college', 'retail']

export default {
  key: 'landContext',
  // v3: nearest facts carry `at` + place for read-time re-anchoring, node/way
  // dedup upstream changes counts, distance provenance corrected to DERIVED.
  version: 3, // v2: walk-time phrasing, counts as data
  appliesTo: ['LAND'],
  ttlHours: 24 * 60, // land context changes on the timescale of construction
  // Low by construction. Everything that decides a land purchase is legal or
  // geotechnical, and this module can see neither.
  maxConfidence: 0.50,

  inputs: [
    { key: 'development_markers', weight: 3 },
    { key: 'city_distance',       weight: 2 },
    // Each needs data we don't have. Named so a thin module cannot look
    // complete — and so nobody mistakes silence here for reassurance.
    { key: 'road_access',   weight: 3 }, // needs OSM road-network ingestion
    { key: 'flood_history', weight: 3 }, // published as PDFs by city corporations, not an API
    { key: 'water_table',   weight: 2 }, // no open dataset for India
  ],

  async compute({ lat, lng, city }) {
    const nearby = await poisNear(lat, lng, CONTEXT_RADIUS, DEVELOPMENT_MARKERS, city)

    const facts = []
    const inputsPresent = []

    // Distance to the city core — the closest honest proxy for how built-up
    // the surroundings are. Explicitly NOT a price or appreciation signal.
    const centre = CITY_CENTERS[city]
    if (centre) {
      inputsPresent.push('city_distance')
      const km = Math.round(haversineKm(lat, lng, centre.lat, centre.lng))
      facts.push(fact({
        key: 'distance_from_city',
        label: `Distance from ${city} centre`,
        value: km,
        unit: 'km',
        display: `about ${km} km`,
        provenance: PROVENANCE.DERIVED,
        source: 'derived',
        method: 'straight-line distance to the city centre — not road distance',
      }))
    }

    if (nearby.available) {
      inputsPresent.push('development_markers')

      facts.push(fact({
        key: 'development_nearby',
        label: 'Built-up activity within 5 km',
        value: nearby.total,
        unit: 'count',
        display: nearby.total === 0
          ? 'nothing mapped within 5 km'
          : `${nearby.total} schools, shops, banks and similar`,
        provenance: PROVENANCE.DERIVED,
        source: 'osm-poi',
        method: 'count of mapped schools, hospitals, shops, banks and fuel stations ' +
          'within 5 km — a rough indication of whether development has reached this area',
        count: nearby.total,
      }))

      for (const [key, label] of [['school', 'Nearest school'], ['hospital', 'Nearest hospital']]) {
        const hits = nearby.byCategory?.[key] ?? []
        if (!hits.length) continue
        const nearest = pickNearest(hits)
        facts.push(fact({
          key: `nearest_${key}`,
          label,
          value: nearest.distanceM,
          unit: 'm',
          display: `${nearest.name ? `${nearest.name} — ` : ''}${walkDisplay(nearest.distanceM)}`,
          provenance: PROVENANCE.DERIVED,
          source: 'osm-poi',
          count: hits.length,
          at: { lat: nearest.lat, lng: nearest.lng },
          place: nearest.name ?? undefined,
        }))
      }
    }

    // "Largely undeveloped surroundings" is the conclusion an incomplete fetch
    // produces too, and it is the one a buyer would act on hardest.
    // Gated on `available`: this module still says something useful with no
    // POIs at all (distance from the city centre needs none), and penalising
    // that result for an incomplete POI fetch would attribute a shortfall to
    // data the answer never used.
    const confidenceFactors = nearby.available
      ? await poiConfidenceFactors(OSM_POI_SOURCE_ID, city)
      : []

    return {
      facts,
      assessment: assess(nearby, centre ? Math.round(haversineKm(lat, lng, centre.lat, centre.lng)) : null),
      missing: MISSING_NOTES,
      inputsPresent,
      sources: nearby.available ? [{ ...OSM_POI_SOURCE, fetchedAt: nearby.fetchedAt }] : [],
      sparselyMapped: nearby.available ? nearby.sparselyMapped : null,
      confidenceFactors,
    }
  },
}

// The most important text in this module. A land buyer who reads a confident
// spatial card and infers the legal position is worse off than one who was
// told nothing.
const MISSING_NOTES = [
  'Nothing here speaks to title, patta, encumbrance or approval status. Those ' +
  'decide a land purchase and cannot be derived from a location — verify them ' +
  'with the seller and the sub-registrar office.',
  'Road access and road width are not shown. The listing\'s own stated road ' +
  'width is the owner\'s claim, not something we have measured.',
  'Flood history is not available. Indian city corporations publish flood maps ' +
  'as PDFs rather than as data, so there is nothing to query.',
  'Water table depth and soil quality are not available anywhere as open data ' +
  'for India — a local borewell contractor will know more than any website.',
]

function assess(nearby, distanceKm) {
  const total = nearby.available ? nearby.total : null

  const label =
    total === null ? 'Limited information for this plot' :
    total >= 40 ? 'Well inside a developed area' :
    total >= 10 ? 'Development has reached this area' :
    total >= 3  ? 'On the edge of development' :
    'Largely undeveloped surroundings'

  const parts = []
  if (distanceKm != null) parts.push(`About ${distanceKm} km from the city centre.`)
  if (total !== null) {
    parts.push(total === 0
      ? 'Nothing mapped within 5 km.'
      : `${total} mapped amenities within 5 km.`)
  }
  parts.push('Legal and geotechnical checks are on you — see below.')

  return { label, detail: parts.join(' ') }
}
