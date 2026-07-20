// Environment — "what am I breathing, and how does that change across the year?"
//
// This module has the widest honesty gradient in the layer, so what it does
// NOT claim is as designed as what it does:
//
//   Air quality      ships now — modelled, and labelled as modelled
//   Climate normals  ships now — 30-year ERA5, at the resolution the source
//                                actually has (see ../climate.js)
//   Tree cover       deferred  — needs ESA WorldCover raster ingestion
//   Water bodies     deferred  — needs OSM polygon ingestion
//   Noise            deferred  — no measured data exists for India
//   Urban heat       NOT SHIPPING — see the note at the bottom of this file
//
// See docs/spatial-intelligence.md §5.4, and §5.10 for the climate normals.
import { fact, PROVENANCE } from '../envelope.js'
import { airQuality, OPEN_METEO_SOURCE, ERA5_SOURCE } from '../providers.js'
import { getNormals, summarise } from '../climate.js'
import { ALL_TYPES } from '../propertyTypes.js'
import { nearestStations, stationConfidenceFactor } from '../cpcbProvider.js'
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
  version: 3, // v2: type gating. v3: 30-year climate normals
  // Air and flood exposure matter to every type — a warehouse floods too, and
  // a plot's air is what its future building breathes.
  appliesTo: ALL_TYPES,
  ttlHours: 12, // air quality genuinely moves; everything else here is deferred
  // Capped because every fact this module currently emits is model output.
  // The ceiling rises when a real CPCB station reading or a WorldCover raster
  // lands, and not before.
  maxConfidence: 0.60,

  inputs: [
    { key: 'air_quality_model', weight: 3 },
    { key: 'climate_normals',   weight: 2 },
    // Declared, absent, and deliberately so — each holds confidence down until
    // the data actually exists rather than letting a thin module look complete.
    { key: 'cpcb_station',      weight: 2 }, // needs a data.gov.in API key
    { key: 'tree_cover',        weight: 2 }, // needs ESA WorldCover ingestion
    { key: 'water_distance',    weight: 1 }, // needs OSM water polygon ingestion
  ],

  async compute({ lat, lng }) {
    // Independent upstreams, so one being slow or down must not serialise or
    // sink the other. Either can be null; each missing one lowers confidence.
    const [aq, normals, stations] = await Promise.all([
      airQuality(lat, lng),
      getNormals(lat, lng),
      // Null whenever there is no data.gov.in key, no feed, or no station
      // within 10 km — which to this module all mean the same thing.
      nearestStations(lat, lng),
    ])

    if (!aq && !normals) {
      return {
        facts: [],
        assessment: null,
        missing: ['Air quality and climate data were unavailable for this location.', ...DEFERRED_NOTES],
        inputsPresent: [],
        sources: [],
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

    // Climate normals — the long view. Air quality answers "what is it like
    // now"; these answer "what is it like to live through a year here", which
    // is a different question and the one a lease actually commits you to.
    if (normals) {
      const c = summarise(normals)

      facts.push(fact({
        key: 'annual_temp',
        label: 'Average temperature',
        value: c.meanTemp,
        unit: '°C',
        display: `${c.meanTemp}°C year-round, peaking around ${c.hottestTemp}°C in ${c.hottestMonth}`,
        provenance: PROVENANCE.DERIVED,
        source: 'era5',
        method: 'average of 30 years of daily temperatures (1991-2020) from the ' +
          'ERA5 reanalysis — a modelled reconstruction from satellite and station ' +
          'records, at roughly city resolution rather than street resolution',
      }))

      facts.push(fact({
        key: 'annual_rainfall',
        label: 'Annual rainfall',
        value: c.annualPrecip,
        unit: 'mm',
        display: `${c.annualPrecip} mm a year, heaviest in ${c.wettestMonth} (${c.wettestPrecip} mm)`,
        provenance: PROVENANCE.DERIVED,
        source: 'era5',
        method: 'average of 30 years of yearly totals (1991-2020) from the ERA5 reanalysis',
      }))

      // The concentration figure is the one that changes a decision. Two
      // cities with identical annual totals are different places to live if
      // one delivers its rain across four months and the other across twelve.
      if (c.monsoonConcentration != null) {
        facts.push(fact({
          key: 'rain_concentration',
          label: 'How the rain arrives',
          value: c.monsoonConcentration,
          unit: '%',
          display: c.monsoonConcentration >= 70
            ? `${c.monsoonConcentration}% of the year's rain falls in just four months`
            : `Rain is spread fairly evenly — the wettest four months bring ${c.monsoonConcentration}%`,
          provenance: PROVENANCE.DERIVED,
          source: 'era5',
          method: "share of the year's rainfall falling in the four wettest months",
        }))
      }
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
    if (normals) inputsPresent.push('climate_normals')
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
    if (normals) sources.push(ERA5_SOURCE)
    // Only cite a source we actually showed something from.
    if (stationFacts.length) sources.push(CPCB_SOURCE)

    return {
      facts,
      assessment: assess(aq, normals),
      missing: [
        // The headline caveat. A modelled value presented as a station reading
        // is exactly the kind of false precision this layer exists to prevent.
        ...(aq ? [
          'Air quality figures are modelled values for this coordinate, not ' +
          'readings from a monitoring station at this address — treat them as a ' +
          'good indication of the area, not a measurement of the building.',
        ] : ['Air quality data was unavailable for this location.']),
        ...(normals ? [
          // Stated plainly because the number LOOKS street-level sitting on a
          // property page, and it is not. See ../climate.js's header.
          'Rainfall and temperature are regional figures — every listing within ' +
          'a few kilometres will show the same values, because that is the ' +
          'resolution the underlying climate record actually has.',
        ] : ['Long-term rainfall and temperature records were unavailable for this location.']),
        ...DEFERRED_NOTES,
      ],
      inputsPresent,
      sources,
      confidenceFactors,
    }
  },
}

const DEFERRED_NOTES = [
  'Tree cover, green space and distance to water are not yet available for ' +
  'this location.',
  // Named explicitly because "we didn't build it" and "it cannot be built" are
  // different, and a renter deserves to know which one they're looking at.
  'Noise levels are not shown: no measured noise data exists for Indian ' +
  'cities, and we would rather show nothing than a number we invented.',
]

function assess(aq, normals) {
  // Air leads when we have it: it is the more locally variable of the two, and
  // the one a renter can actually act on by choosing a different street.
  if (!aq) {
    if (!normals) return null
    const c = summarise(normals)
    return {
      label: 'Climate on record, air quality unknown',
      detail: `${c.meanTemp}°C on average with ${c.annualPrecip} mm of rain a year, ` +
        `heaviest in ${c.wettestMonth}. We could not read air quality here.`,
    }
  }

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

  if (normals) {
    const c = summarise(normals)
    parts.push(`Around ${c.meanTemp}°C year-round with ${c.annualPrecip} mm of rain, ` +
      `concentrated in ${c.wettestMonth}.`)
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
