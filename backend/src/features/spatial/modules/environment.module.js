// Environment — "what am I breathing, and how does that change across the year?"
//
// This module has the widest honesty gradient in the layer, so what it does
// NOT claim is as designed as what it does:
//
//   Air quality      ships now — modelled, and labelled as modelled
//   CPCB stations    ships now — the one genuine instrument reading here
//   Tree cover       ships now (2026-07-28) — ESA WorldCover, ESTIMATED
//   Water bodies     ships now (2026-07-28) — OSM polygons
//   Noise            deferred  — no measured data exists for India
//   Urban heat       NOT SHIPPING — see the note at the bottom of this file
//   Climate normals  REMOVED 2026-07-20 — see below
//
// Climate normals were true, well-sourced, correctly labelled, and useless on a
// property page. ERA5's grid is ~28km, so every listing in a city showed the
// SAME temperature and rainfall — and a fact identical across every option in
// the choice set cannot help anyone choose between them. The renter picked the
// city before they opened this page.
//
// The tell was that it shipped with an apology: a `missing[]` note explaining
// that "every listing within a few kilometres will show the same values". A
// fact needing a disclaimer that it says nothing about this address does not
// belong on this address's page. Monsoon concentration is genuinely
// interesting, but it is a CITY-comparison fact and belongs on a city page.
//
// See docs/spatial-intelligence.md §5.4.
import { fact, PROVENANCE } from '../envelope.js'
import { airQuality, OPEN_METEO_SOURCE } from '../providers.js'
import { ALL_TYPES } from '../propertyTypes.js'
import { nearestStations, stationConfidenceFactor } from '../cpcbProvider.js'
import { nearestWater, SEARCH_RADIUS_M, OSM_WATER_SOURCE } from '../waterLookup.js'
import { landCover, SAMPLE_RADIUS_M, WORLDCOVER_SOURCE } from '../worldCoverProvider.js'
import { formatDistance } from '../proximity.js'

// CPCB data is Government of India open data under the National Data Sharing
// and Accessibility Policy — a different licence from OSM's ODbL, so it gets
// its own source line rather than being folded into an existing one.
const CPCB_SOURCE = {
  name: 'CPCB (via data.gov.in)',
  license: 'Government Open Data Licence — India',
  fetchedAt: null,
}

// CPCB's National Air Quality Index PM2.5 breakpoints (24h, µg/m³). India's
// own scale, not the US EPA one — this is an India product and a renter in
// Delhi is served by the categories their government and news actually use.
const AQI_BANDS = [
  { max: 30,  label: 'Good' },
  { max: 60,  label: 'Satisfactory' },
  { max: 90,  label: 'Moderate' },
  { max: 120, label: 'Poor' },
  { max: 250, label: 'Very poor' },
  { max: Infinity, label: 'Severe' },
]

function bandFor(pm25) {
  return AQI_BANDS.find((b) => pm25 <= b.max).label
}

const MODEL_METHOD =
  'from the CAMS atmospheric model via Open-Meteo — a modelled value for these ' +
  'coordinates, not a reading from a monitoring station at this address'

export default {
  key: 'environment',
  // v4: climate normals removed, CPCB station readings added. The bump is what
  // forces every stored envelope to be recomputed — without it, cells would
  // keep serving the temperature and rainfall facts until their TTL expired.
  // v6 (2026-07-28): tree_cover landed too. Same reason for the bump as v4 —
  // without it, stored envelopes keep serving the version without these facts.
  version: 6,
  // Air and flood exposure matter to every type — a warehouse floods too, and
  // a plot's air is what its future building breathes.
  appliesTo: ALL_TYPES,
  ttlHours: 12, // air quality genuinely moves; everything else here is deferred
  // Was 0.60, "capped because every fact this module currently emits is model
  // output — the ceiling rises when a real CPCB station reading or a WorldCover
  // raster lands, and not before". Both have now landed, so this is the
  // module's own stated condition being met rather than a number being tuned.
  // 0.75 not 1.0: the HEADLINE facts here are still modelled air quality, and
  // the ceiling should reflect what the module leads with.
  maxConfidence: 0.75,

  inputs: [
    { key: 'air_quality_model', weight: 3 },
    // Declared, absent, and deliberately so — each holds confidence down until
    // the data actually exists rather than letting a thin module look complete.
    { key: 'cpcb_station',      weight: 2 }, // live — data.gov.in key is set
    { key: 'tree_cover',        weight: 2 }, // landed 2026-07-28
    { key: 'water_distance',    weight: 1 }, // landed 2026-07-28
  ],

  async compute({ lat, lng }) {
    // Independent upstreams, so one being slow or down must not serialise or
    // sink the other. Either can be null; each missing one lowers confidence.
    const [aq, stations, water, cover] = await Promise.all([
      airQuality(lat, lng),
      // { pm25, pm10 }, each the nearest monitor carrying THAT reading — they
      // need not be the same site. Either can be null: no key, no feed, or
      // nothing within the airshed bound all mean the same thing here.
      nearestStations(lat, lng),
      nearestWater(lat, lng),
      landCover(lat, lng),
    ])

    // Air quality failing no longer empties the whole module. Chennai's
    // production cell sat at confidence 0 with "0 of 4 inputs" because one
    // upstream hiccup took the other three down with it via this branch
    // (docs/spatial-research-2026-07-28.md §4) — water is independent of it and
    // should survive.
    if (!aq) {
      const survivors = [
        ...(water?.available ? [waterAmenityFact(water.body)] : []),
        ...(cover ? [treeFact(cover)] : []),
      ]
      return {
        facts: survivors,
        assessment: null,
        missing: [
          'Air quality data was unavailable for this location.',
          ...(cover ? [] : [GREEN_NOTE]),
          ...(water?.available ? [] : [WATER_UNAVAILABLE_NOTE]),
          NOISE_NOTE,
        ],
        inputsPresent: [
          ...(water?.available ? ['water_distance'] : []),
          ...(cover ? ['tree_cover'] : []),
        ],
        sources: [
          ...(water?.available ? [OSM_WATER_SOURCE] : []),
          ...(cover ? [WORLDCOVER_SOURCE] : []),
        ],
        // Only reaches the envelope if this branch also produced no facts —
        // i.e. water and land cover were BOTH unavailable too. Names the
        // upstreams, so an empty card is diagnosable from the payload rather
        // than only from the box.
        unavailableReason: (water?.available || cover)
          ? null
          : 'Air quality, water bodies and land cover all returned nothing for ' +
            'this location. This is an upstream failure on our side, not a ' +
            'statement that the area has no data.',
      }
    }

    const facts = aq ? [
      fact({
        key: 'pm25_now',
        label: 'PM2.5 right now',
        value: aq.currentPm25,
        unit: 'µg/m³',
        display: `${aq.currentPm25} µg/m³ — ${bandFor(aq.currentPm25)}`,
        provenance: PROVENANCE.ESTIMATED,
        source: 'open-meteo',
        method: MODEL_METHOD,
        observedAt: new Date().toISOString().slice(0, 10),
      }),
    ] : []

    // The 90-day distribution is the fact that actually helps someone choose
    // where to live. Indian air quality is violently seasonal — a July reading
    // says nothing about November — so a single current value presented alone
    // would be true and useless.
    if (aq && aq.medianPm25 != null) {
      facts.push(fact({
        key: 'pm25_typical',
        label: 'Typical over the last 90 days',
        value: aq.medianPm25,
        unit: 'µg/m³',
        display: `${aq.medianPm25} µg/m³ — ${bandFor(aq.medianPm25)}`,
        provenance: PROVENANCE.DERIVED,
        source: 'open-meteo',
        method: `median of ${aq.sampleCount} hourly modelled values`,
      }))
    }

    if (aq && aq.p90Pm25 != null) {
      facts.push(fact({
        key: 'pm25_bad_days',
        label: 'On the worst days',
        value: aq.p90Pm25,
        unit: 'µg/m³',
        display: `${aq.p90Pm25} µg/m³ — ${bandFor(aq.p90Pm25)}`,
        provenance: PROVENANCE.DERIVED,
        source: 'open-meteo',
        method: `90th percentile of ${aq.sampleCount} hourly modelled values — ` +
          'roughly the worst 1 day in 10 over the last three months',
      }))
    }

    if (aq && aq.currentPm10 != null) {
      facts.push(fact({
        key: 'pm10_now',
        label: 'PM10 right now',
        value: aq.currentPm10,
        unit: 'µg/m³',
        display: `${aq.currentPm10} µg/m³`,
        provenance: PROVENANCE.ESTIMATED,
        source: 'open-meteo',
        method: MODEL_METHOD,
      }))
    }

    // A real instrument reading real air — the only MEASURED fact this module
    // can emit. Everything else here is model output.
    //
    // The distance is always stated, and it is doing real work: CPCB has 488
    // stations nationally, so for most listings the nearest one is kilometres
    // away. Naming that is what keeps MEASURED from overclaiming, and
    // `stationConfidenceFactor` grades the score by the same number rather than
    // the module pretending a 25 km reading is a 2 km one.
    // Each pollutant comes from its own nearest monitor — they are separate
    // measurements and there is no reason they must share a site. Crediting
    // `cpcb_station` is gated on a fact actually being EMITTED, not on a station
    // merely existing: confidence for a measurement the user never sees is the
    // precise failure this layer exists to prevent.
    const stationFacts = []

    if (stations.pm25) {
      const s = stations.pm25
      stationFacts.push(s)
      facts.push(fact({
        key: 'pm25_station',
        label: 'PM2.5 at the nearest monitor',
        value: s.pm25,
        unit: 'µg/m³',
        display: `${s.pm25} µg/m³ at ${s.name ?? 'the nearest CPCB station'}` +
          ` — ${formatDistance(s.distanceM)} away`,
        provenance: PROVENANCE.MEASURED,
        source: 'cpcb',
        observedAt: s.observedAt ?? null,
        at: { lat: s.lat, lng: s.lng },
        place: s.name ?? undefined,
      }))
    }

    if (stations.pm10) {
      const s = stations.pm10
      stationFacts.push(s)
      facts.push(fact({
        key: 'pm10_station',
        label: 'PM10 at the nearest monitor',
        value: s.pm10,
        unit: 'µg/m³',
        // Names its own distance too: with per-pollutant lookup the two facts
        // can genuinely come from different places, and a reader comparing them
        // needs to know that rather than assume one site.
        display: `${s.pm10} µg/m³ at ${s.name ?? 'the nearest CPCB station'}` +
          ` — ${formatDistance(s.distanceM)} away`,
        provenance: PROVENANCE.MEASURED,
        source: 'cpcb',
        observedAt: s.observedAt ?? null,
        at: { lat: s.lat, lng: s.lng },
        place: s.name ?? undefined,
      }))
    }

    const inputsPresent = []
    if (aq) inputsPresent.push('air_quality_model')
    // Same lookup terrain uses, framed differently: there it is a fact about
    // the ground, here it is open water as green/blue space. One ingestion,
    // two modules — the reason this input was built first.
    if (water?.available) {
      inputsPresent.push('water_distance')
      facts.push(waterAmenityFact(water.body))
    }
    if (cover) {
      inputsPresent.push('tree_cover')
      facts.push(treeFact(cover))
    }
    // Gated on a fact actually being emitted, not on a station existing.
    if (stationFacts.length) inputsPresent.push('cpcb_station')

    // Graded on the CLOSEST monitor we actually used. With per-pollutant
    // lookup the two facts can come from different sites, and penalising the
    // pair by the farther one would understate a reading taken at the door.
    const closest = stationFacts.reduce(
      (best, s) => (best === null || s.distanceM < best.distanceM ? s : best),
      null
    )
    const confidenceFactors = [stationConfidenceFactor(closest)].filter(Boolean)

    const sources = []
    if (aq) sources.push(OPEN_METEO_SOURCE)
    // Only cite a source we actually showed something from.
    if (stationFacts.length) sources.push(CPCB_SOURCE)
    if (water?.available) sources.push(OSM_WATER_SOURCE)
    if (cover) sources.push(WORLDCOVER_SOURCE)

    return {
      facts,
      assessment: assess(aq),
      missing: [
        // The headline caveat. A modelled value presented as a station reading
        // is exactly the kind of false precision this layer exists to prevent.
        ...(aq ? [
          'Air quality figures are modelled values for this coordinate, not ' +
          'readings from a monitoring station at this address — treat them as a ' +
          'good indication of the area, not a measurement of the building.',
        ] : ['Air quality data was unavailable for this location.']),
        ...(cover ? [] : [GREEN_NOTE]),
        ...(water?.available ? [] : [WATER_UNAVAILABLE_NOTE]),
        NOISE_NOTE,
      ],
      inputsPresent,
      sources,
      confidenceFactors,
    }
  },
}

// Tree cover is still absent; distance to water landed 2026-07-28, so this note
// no longer claims it.
const GREEN_NOTE = 'Tree cover and green space are not yet available for this location.'

/**
 * How much of the ground around here is under trees.
 *
 * ESTIMATED, not MEASURED, and the distinction is the point: WorldCover is a
 * CLASSIFICATION of Sentinel imagery, so every pixel carries a model's judgement
 * about what it is looking at. The satellite measured reflectance; a classifier
 * decided "tree". `method` says so plainly.
 *
 * Built-up share rides along in the display because it is what makes the tree
 * figure legible — 16% tree cover means something different at 80% built than
 * it does on a city edge — and it costs nothing extra, coming from the same
 * pixel window.
 */
function treeFact(cover) {
  const km = SAMPLE_RADIUS_M >= 1000 ? `${SAMPLE_RADIUS_M / 1000} km` : `${SAMPLE_RADIUS_M} m`
  return fact({
    key: 'tree_cover',
    label: 'Tree cover nearby',
    value: cover.treePct,
    unit: '%',
    display: `${cover.treePct}% of the ground within ${km} is under tree cover` +
      ` — ${cover.builtPct}% is built on`,
    provenance: PROVENANCE.ESTIMATED,
    source: 'esa-worldcover',
    method: `from ESA WorldCover 2021, a 10 m satellite land-cover classification: ` +
      `the share of ${cover.samplePx} pixels within ${km} classed as tree cover. ` +
      'This is how a classifier read satellite imagery, not a count of trees — ' +
      'it cannot see a courtyard tree or tell a plantation from a park.',
    count: cover.samplePx,
  })
}

// Named explicitly because "we didn't build it" and "it cannot be built" are
// different, and a renter deserves to know which one they're looking at.
const NOISE_NOTE =
  'Noise levels are not shown: no measured noise data exists for Indian ' +
  'cities, and we would rather show nothing than a number we invented.'

const WATER_UNAVAILABLE_NOTE = 'Distance to open water is not yet available for this location.'


/**
 * Open water as amenity, not as hazard.
 *
 * The same measurement `terrain` reports, framed for the question this module
 * asks ("what are you breathing / living beside?"). It carries no risk claim
 * here either — see the note on terrain's `waterFact`.
 */
function waterAmenityFact(body) {
  if (!body) {
    return fact({
      key: 'nearest_water',
      label: 'Open water nearby',
      value: null,
      display: `No mapped lake, river or canal within ${SEARCH_RADIUS_M / 1000} km`,
      provenance: PROVENANCE.DERIVED,
      source: 'openstreetmap',
      method: 'a search of mapped water bodies around this address',
    })
  }

  const named = body.name ?? `An unnamed ${body.label}`
  return fact({
    key: 'nearest_water',
    label: 'Open water nearby',
    value: body.distanceM,
    unit: 'm',
    place: body.name ?? null,
    at: body.at,
    display: body.inside
      ? `${named} — this location sits on the water`
      : `${named}, ${body.distanceM} m away`,
    provenance: PROVENANCE.DERIVED,
    source: 'openstreetmap',
    method: 'straight-line distance from this address to the mapped edge of the water body',
    displayStyle: 'distance',
  })
}

function assess(aq) {
  if (!aq) return null

  const typical = aq.medianPm25 ?? aq.currentPm25
  const band = bandFor(typical)

  const label =
    typical <= 30 ? 'Clean air most of the time' :
    typical <= 60 ? 'Generally acceptable air quality' :
    typical <= 90 ? 'Moderate air pollution' :
    typical <= 120 ? 'Poor air quality — a real consideration' :
    'Heavily polluted air'

  const parts = [`Typically ${typical} µg/m³ PM2.5 (${band.toLowerCase()}).`]
  if (aq.p90Pm25 != null && aq.p90Pm25 > typical * 1.5) {
    parts.push(`Bad days reach ${aq.p90Pm25} µg/m³ — ${bandFor(aq.p90Pm25).toLowerCase()}.`)
  }


  return { label, detail: parts.join(' ') }
}

// URBAN HEAT — deliberately absent, and this note exists so nobody adds it
// casually. The obvious implementation is Open-Meteo's temperature endpoint,
// which returns a city-level value: identical for every cell in Bengaluru, and
// therefore useless for choosing between two neighbourhoods while looking
// exactly like local information. Real urban-heat-island analysis needs
// Landsat/MODIS land-surface-temperature rasters with seasonal compositing.
// Until that exists, built-up percentage from ESA WorldCover is the honest
// partial proxy and belongs in the green-space fact, not in a "heat" score.
