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
import { roadAccess, SEARCH_RADIUS_M as ROAD_RADIUS_M } from '../roadLookup.js'

// A plot draws on a much wider area than a flat — 5km is a short drive.
const CONTEXT_RADIUS = 5000

// Signs that development has already reached this area. Not a valuation and
// not a forecast: just what exists today, within a drive.
const DEVELOPMENT_MARKERS = ['school', 'hospital', 'supermarket', 'bank', 'fuel', 'college', 'retail']

export default {
  key: 'landContext',
  // v3: nearest facts carry `at` + place for read-time re-anchoring, node/way
  // dedup upstream changes counts, distance provenance corrected to DERIVED.
  // v5 (2026-07-28): road_access landed. Bumped so stored envelopes recompute
  // rather than serving the roadless version for the full 24-day TTL.
  version: 5, // v4 (2026-07-20): corrected retail basket incl. department_store
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
    // Landed 2026-07-28 (RoadSegment + roadLookup.js). The heaviest-weighted
    // input here, because access is the one spatial question that can kill a
    // plot purchase outright.
    { key: 'road_access',   weight: 3 },
    { key: 'flood_history', weight: 3 }, // published as PDFs by city corporations, not an API
    { key: 'water_table',   weight: 2 }, // no open dataset for India
  ],

  async compute({ lat, lng, city }) {
    // Independent upstreams: a road lookup that fails must not cost the POI
    // context, and vice versa.
    const [nearby, roads] = await Promise.all([
      poisNear(lat, lng, CONTEXT_RADIUS, DEVELOPMENT_MARKERS, city),
      roadAccess(lat, lng),
    ])

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

    if (roads?.available) {
      inputsPresent.push('road_access')
      facts.push(...roadFacts(roads))
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
      missing: roads?.available ? MISSING_NOTES : [ROAD_UNAVAILABLE_NOTE, ...MISSING_NOTES],
      inputsPresent,
      sources: [
        ...(nearby.available ? [{ ...OSM_POI_SOURCE, fetchedAt: nearby.fetchedAt }] : []),
        ...(roads?.available ? [OSM_ROAD_SOURCE] : []),
      ],
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
  // Road ACCESS landed 2026-07-28; road WIDTH did not, and the distinction
  // matters — width decides whether a lorry or a fire engine can turn in, and
  // Indian OSM records it only occasionally.
  'Road width is shown only where a mapper recorded one, which is rare. The ' +
  'listing\'s own stated road width is the owner\'s claim, not something we ' +
  'have measured.',
  'Flood history is not available. Indian city corporations publish flood maps ' +
  'as PDFs rather than as data, so there is nothing to query.',
  'Water table depth and soil quality are not available anywhere as open data ' +
  'for India — a local borewell contractor will know more than any website.',
]

const ROAD_UNAVAILABLE_NOTE =
  'Distance to the nearest road is not yet available for this location.'

export const OSM_ROAD_SOURCE = {
  id: 'openstreetmap',
  label: 'OpenStreetMap',
  licence: 'ODbL',
}

/**
 * Road access, as up to two facts.
 *
 * The SECOND fact is the one that earns this feature. A plot 30 m from a track
 * and 900 m from tarmac is not "30 m from a road" in any sense a buyer means,
 * and reporting only the nearest would say exactly that. When both distances
 * match, the driveable fact is redundant and is dropped rather than repeated.
 */
function roadFacts(roads) {
  const { nearest, driveable } = roads
  const out = []

  if (!nearest) {
    return [fact({
      key: 'nearest_road',
      label: 'Nearest road',
      value: null,
      display: `No mapped road within ${ROAD_RADIUS_M / 1000} km`,
      provenance: PROVENANCE.DERIVED,
      source: 'openstreetmap',
      method: 'a search of mapped motorable roads around this plot',
    })]
  }

  const named = nearest.name ? `${nearest.name} (${nearest.label})` : `A ${nearest.label}`
  out.push(fact({
    key: 'nearest_road',
    label: 'Nearest road',
    value: nearest.distanceM,
    unit: 'm',
    place: nearest.name ?? null,
    at: nearest.at,
    display: `${named}, ${nearest.distanceM} m away` +
      // Width is decisive when present and absent most of the time, so it is
      // appended rather than given a fact of its own.
      (nearest.widthM ? ` — ${nearest.widthM} m wide` : ''),
    provenance: PROVENANCE.DERIVED,
    source: 'openstreetmap',
    method: 'straight-line distance from this plot to the nearest mapped road ' +
      'a vehicle can use — not the length of the approach',
    displayStyle: 'distance',
  }))

  // Same road, or same distance: the second fact would just repeat the first.
  const differs = !driveable || driveable.distanceM !== nearest.distanceM
  if (differs) {
    out.push(fact({
      key: 'nearest_driveable_road',
      label: 'Nearest road a car can use',
      value: driveable ? driveable.distanceM : null,
      unit: driveable ? 'm' : null,
      place: driveable?.name ?? null,
      at: driveable?.at ?? null,
      display: driveable
        ? `${driveable.name ? `${driveable.name} — ` : ''}${driveable.distanceM} m away` +
          ` (the nearest ${nearest.label} is closer, at ${nearest.distanceM} m)`
        : `None within ${ROAD_RADIUS_M / 1000} km — the nearest access is a ${nearest.label}`,
      provenance: PROVENANCE.DERIVED,
      source: 'openstreetmap',
      method: 'the nearest mapped road that is not an unsurfaced track',
      displayStyle: 'distance',
    }))
  }

  return out
}

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
