// Environment — "what am I breathing, and how does that change across the year?"
//
// This module has the widest honesty gradient in the layer, so what it does
// NOT claim is as designed as what it does:
//
//   Air quality      ships now — modelled, and labelled as modelled
//   Tree cover       deferred  — needs ESA WorldCover raster ingestion
//   Water bodies     deferred  — needs OSM polygon ingestion
//   Noise            deferred  — no measured data exists for India
//   Urban heat       NOT SHIPPING — see the note at the bottom of this file
//
// See docs/spatial-intelligence.md §5.4.
import { fact, PROVENANCE } from '../envelope.js'
import { airQuality, OPEN_METEO_SOURCE } from '../providers.js'
import { ALL_TYPES } from '../propertyTypes.js'

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
  version: 2, // v2: type gating
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
    // Declared, absent, and deliberately so — each holds confidence down until
    // the data actually exists rather than letting a thin module look complete.
    { key: 'cpcb_station',      weight: 2 }, // needs a data.gov.in API key
    { key: 'tree_cover',        weight: 2 }, // needs ESA WorldCover ingestion
    { key: 'water_distance',    weight: 1 }, // needs OSM water polygon ingestion
  ],

  async compute({ lat, lng }) {
    const aq = await airQuality(lat, lng)

    if (!aq) {
      return {
        facts: [],
        assessment: null,
        missing: ['Air quality data was unavailable for this location.', ...DEFERRED_NOTES],
        inputsPresent: [],
        sources: [],
      }
    }

    const facts = [
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
    ]

    // The 90-day distribution is the fact that actually helps someone choose
    // where to live. Indian air quality is violently seasonal — a July reading
    // says nothing about November — so a single current value presented alone
    // would be true and useless.
    if (aq.medianPm25 != null) {
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

    if (aq.p90Pm25 != null) {
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

    if (aq.currentPm10 != null) {
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

    return {
      facts,
      assessment: assess(aq),
      missing: [
        // The headline caveat. A modelled value presented as a station reading
        // is exactly the kind of false precision this layer exists to prevent.
        'These are modelled values for this coordinate, not readings from a ' +
        'monitoring station at this address — treat them as a good indication ' +
        'of the area, not a measurement of the building.',
        ...DEFERRED_NOTES,
      ],
      inputsPresent: ['air_quality_model'],
      sources: [OPEN_METEO_SOURCE],
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

function assess(aq) {
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
