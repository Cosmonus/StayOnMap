// Mobility — "can I actually get to work, and what does a bad day cost me?"
//
// The strongest facts in this module come from data StayOnMap already owns:
// backend/src/data/metro-lines/*.json is 44 real lines and 764 real stations
// pulled from OpenStreetMap, with per-station line associations. Nearest metro
// station and which lines it serves cost zero external calls and are genuine
// measurements. That is a better mobility fact than anything purchasable.
//
// The one paid call is deliberate. See PEAK-HOUR below.
import { getMetroNetwork } from '../../metro/metro.service.js'
import { getItCorridors } from '../../itCorridors/itCorridors.service.js'
import { CITY_CENTERS } from '../../../config/cityCenters.js'
import { COMMUTE_TARGET, ALL_TYPES } from '../propertyTypes.js'
import { haversineMeters } from '../../../lib/geohash.js'
import { fact, PROVENANCE } from '../envelope.js'
import { nearbyCount, distanceMatrix, OSM_SOURCE, GOOGLE_PLACES_SOURCE, GOOGLE_DM_SOURCE } from '../providers.js'
import { poisNear, poiConfidenceFactors, OSM_POI_SOURCE, OSM_POI_SOURCE_ID } from '../poiProvider.js'
import { formatDistance } from '../proximity.js'

// Beyond this, "walking distance to the metro" stops being a useful claim.
const MAX_WALKABLE_METRO_M = 2500

/**
 * PEAK-HOUR: the next Tuesday at 09:00 IST, as a Unix timestamp.
 *
 * The existing computeTraffic() asks Google for `departure_time: 'now'` against
 * a probe point 2.2km due north. So a query at 3am reports light traffic, in a
 * direction nobody drives, and the answer changes depending on when the cache
 * happened to miss. Congestion is a property of the hour, not of when we asked.
 *
 * Tuesday because Monday and Friday are atypical commute days everywhere, and
 * a fixed weekday makes results comparable between cells.
 */
export function nextPeakDeparture(now = new Date()) {
  const IST_OFFSET_MS = 330 * 60 * 1000
  const ist = new Date(now.getTime() + IST_OFFSET_MS)
  const daysAhead = (2 - ist.getUTCDay() + 7) % 7 // 2 = Tuesday

  let target = Date.UTC(
    ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate() + daysAhead, 9, 0, 0
  ) - IST_OFFSET_MS

  if (target <= now.getTime()) target += 7 * 24 * 60 * 60 * 1000
  return Math.floor(target / 1000)
}

function cityCore(lat, lng, city) {
  const centre = CITY_CENTERS[city]
  if (!centre) return null
  return {
    name: `${city} city centre`,
    kind: 'city_core',
    lat: centre.lat,
    lng: centre.lng,
    distanceM: haversineMeters(lat, lng, centre.lat, centre.lng),
  }
}

function nearestEmploymentCentre(lat, lng, city) {
  const corridors = getItCorridors(city)?.features ?? []
  const major = corridors.filter((f) => f.properties?.level === 'major')
  const pool = major.length ? major : corridors

  let best = null
  for (const f of pool) {
    const [cLng, cLat] = f.geometry.coordinates
    const distanceM = haversineMeters(lat, lng, cLat, cLng)
    if (!best || distanceM < best.distanceM) {
      best = { name: f.properties.name, kind: 'employment', lat: cLat, lng: cLng, distanceM }
    }
  }
  return best
}

/**
 * What should the peak-hour drive measure TO, for this kind of listing?
 *
 * The module used to always target the nearest IT corridor. That's right for a
 * flat and meaningless for a holiday rental — guests don't commute to a tech
 * park — and for a plot. One module, a type-aware destination, rather than
 * four near-identical mobility modules. See propertyTypes.js COMMUTE_TARGET.
 */
async function commuteDestination(lat, lng, city, target) {
  if (target === 'arrival') {
    // Guests arrive before they do anything else. Airport first, then a
    // mainline railway station.
    const pois = await poisNear(lat, lng, 60_000, ['airport', 'railway_station'], city)
    const nearest = ['airport', 'railway_station']
      .map((k) => pois.byCategory?.[k]?.[0] && { ...pois.byCategory[k][0], kind: k })
      .filter(Boolean)[0]
    if (nearest) {
      return { name: nearest.name ?? 'nearest arrival point', kind: nearest.kind, lat: nearest.lat, lng: nearest.lng }
    }
    // No arrival point mapped — fall through to the city core rather than
    // silently reporting a commute nobody would make.
    return cityCore(lat, lng, city)
  }

  if (target === 'city_core') return cityCore(lat, lng, city)

  return nearestEmploymentCentre(lat, lng, city) ?? cityCore(lat, lng, city)
}

// How the drive is described, per destination kind. The number is the same
// Distance Matrix call either way; what changes is what it MEANS.
const DRIVE_LABEL = {
  employment:      'Drive to work area (Tue 9am)',
  city_core:       'Drive to city centre (Tue 9am)',
  airport:         'Drive to the airport (Tue 9am)',
  railway_station: 'Drive to the railway station (Tue 9am)',
}

function nearestStation(lat, lng, network) {
  let best = null
  for (const s of network.stations ?? []) {
    const distanceM = haversineMeters(lat, lng, s.lat, s.lng)
    if (!best || distanceM < best.distanceM) best = { ...s, distanceM }
  }
  return best
}

export default {
  key: 'mobility',
  // v5: metro facts carry the station's coordinates (`at`) for read-time
  // re-anchoring, distance/count provenance corrected to DERIVED, observedAt
  // comes from the network file instead of a hardcoded date, and bus counts
  // change under node/way dedup. Stored envelopes hold all of that, so the
  // bump forces existing cells to recompute.
  // v7 (2026-07-26): the assumed `walk_time_metro` fact is gone. The bump is
  // load-bearing, not bookkeeping: envelopes are stored whole, so every cell
  // already materialised still carries the invented walk time until its module
  // version moves and forces a recompute (see registry.js's staleness check).
  version: 7, // v6 (2026-07-20): railway_station now means MAINLINE only; metro is its own category // v4: humanised distances; v3: destination varies by property type
  // Everyone needs to know how to get somewhere — only the destination differs.
  appliesTo: ALL_TYPES,
  // Its DESTINATION depends on the property type, so its envelope must be
  // stored per type — see storageKey() in spatial.service.js.
  variesByType: true,
  // 30 days. Every fact here is stable on that timescale — metro stations don't
  // move, and a neighbourhood's Tuesday-9am congestion doesn't meaningfully
  // change week to week. The refresh interval is what sets the ONGOING cost of
  // the whole layer (one Distance Matrix call per cell per period, the only
  // metered thing left), so a weekly TTL was paying 4x for data that hadn't
  // changed. Shorten this only with a reason.
  ttlHours: 24 * 30,
  maxConfidence: 0.85,

  // Weights express how much each input actually tells you about mobility.
  // bus_gtfs is declared even though nothing provides it today — that is the
  // point: it holds confidence honestly below 1.0 for a city where we cannot
  // say anything about bus frequency, and it becomes present for free the day
  // a GTFS feed is wired in.
  inputs: [
    { key: 'metro_network', weight: 3 },
    { key: 'peak_drive',    weight: 3 },
    { key: 'bus_stops',     weight: 2 },
    { key: 'bus_gtfs',      weight: 1 },
  ],

  async compute({ lat, lng, city, propertyType }) {
    const facts = []
    const inputsPresent = []
    const missing = []
    const sources = []

    // ── Metro: own data, zero cost, genuinely measured ──────────────────────
    const network = city ? getMetroNetwork(city) : null
    let metro = null

    if (network?.stations?.length) {
      inputsPresent.push('metro_network')
      sources.push(OSM_SOURCE)
      metro = nearestStation(lat, lng, network)

      const lineNames = (metro.lines ?? [])
        .map((i) => network.lines?.[i]?.name)
        .filter(Boolean)

      // A city with mapped stations but no line geometry has a network under
      // construction, not one you can ride.
      const operating = Boolean(network.lines?.length)

      // The network file's own fetch date, never a hardcoded one — a metro
      // engine re-promote must not leave facts claiming an older observation.
      const metroObservedAt =
        typeof network.meta?.fetchedAt === 'string' ? network.meta.fetchedAt.slice(0, 10) : null

      facts.push(fact({
        key: 'nearest_metro',
        label: operating ? 'Nearest metro station' : 'Nearest planned metro station',
        value: Math.round(metro.distanceM),
        unit: 'm',
        display: `${metro.name} — ${formatDistance(metro.distanceM)}`,
        // The station's position is MEASURED; the distance to it is arithmetic
        // — DERIVED, per the contract in envelope.js. `at` lets the read path
        // re-derive it from the property instead of the cell centre.
        provenance: PROVENANCE.DERIVED,
        source: 'osm-metro',
        observedAt: metroObservedAt,
        at: { lat: metro.lat, lng: metro.lng },
        place: metro.name,
        displayStyle: 'distance',
      }))

      // No assumed walk time. This used to emit a `walk_time_metro` fact of
      // haversine × 1.35 ÷ 4.8 km/h — "about 40 min on foot" for a station
      // 2.4 km away — which is fiction wherever a rail line, nullah or
      // unbridged arterial sits in between, and it contradicted three things
      // at once: the standing refusal in .claude/spatial.md, walkEnrich.js's
      // own invariant ("No fact ever carries an assumed walk time"), and the
      // promise on our own homepage ("No invented walk times").
      //
      // The distance fact above says "2.4 km" and stands on its own. Walk time
      // returns through walkEnrich.js, which appends a MEASURED time to that
      // same fact once the self-hosted router is up — so this slot is not a
      // gap waiting to be filled by an estimate, it is already spoken for.

      if (lineNames.length) {
        facts.push(fact({
          key: 'metro_lines',
          label: 'Lines served',
          value: lineNames.length,
          unit: 'count',
          display: lineNames.join(', '),
          provenance: PROVENANCE.DERIVED,
          source: 'osm-metro',
          observedAt: metroObservedAt,
        }))
      }

      // Surat has 34 stations and zero line geometry because Surat Metro is
      // still under construction. Say that, rather than implying a network.
      if (!network.lines?.length) {
        missing.push(
          `${city}'s metro network is still under construction — station locations ` +
          'are known but no line is operating yet.'
        )
      }
    } else {
      missing.push(
        city
          ? `No metro or light-rail network data exists for ${city}.`
          : 'This location is outside the cities StayOnMap covers, so no transit network is available.'
      )
    }

    // ── Bus stops: presence only. Presence is not frequency. ────────────────
    // Prefer the self-hosted table. scripts/fetch-osm-pois.mjs already collects
    // `highway=bus_stop` and `amenity=bus_station` under the `bus_stop`
    // category, so this question costs nothing once a city is seeded — Google
    // is only the fallback for a city that isn't.
    const localBus = await poisNear(lat, lng, 800, ['bus_stop'], city)
    const busStops = localBus.available
      ? (localBus.byCategory.bus_stop ?? []).length
      : await nearbyCount(lat, lng, { type: 'bus_station', radius: 800 })

    if (busStops !== null) {
      inputsPresent.push('bus_stops')
      sources.push(localBus.available ? OSM_POI_SOURCE : GOOGLE_PLACES_SOURCE)
      facts.push(fact({
        key: 'bus_stops_800m',
        label: 'Bus stops within 800 m',
        value: busStops,
        unit: 'count',
        // The label already says "within 800 m" — repeating it in the value
        // reads as "none within 800 m within 800 m" on the card.
        display: busStops === 0 ? 'None' : `${busStops} stop${busStops > 1 ? 's' : ''}`,
        // A count is arithmetic over mapped points — DERIVED, per envelope.js.
        provenance: PROVENANCE.DERIVED,
        source: localBus.available ? 'osm-poi' : 'google-places',
        count: busStops,
      }))
    }

    // No Indian city in SUPPORTED_CITIES publishes a bus timetable we can
    // consume today (Delhi's OTD is the closest, and is not wired in). A stop
    // on a map says nothing about whether a bus comes every 5 minutes or twice
    // a day, and pretending otherwise would be the exact failure this layer
    // exists to prevent.
    missing.push(
      'No published bus timetable is available for this city, so bus service ' +
      'frequency is unknown — only stop locations are.'
    )

    // ── PEAK-HOUR drive, to wherever this KIND of listing actually travels ──
    const destination = await commuteDestination(lat, lng, city, COMMUTE_TARGET[propertyType] ?? 'employment')
    if (destination) {
      const dm = await distanceMatrix({
        origin: { lat, lng },
        destination: { lat: destination.lat, lng: destination.lng },
        departureTime: nextPeakDeparture(),
      })

      if (dm) {
        inputsPresent.push('peak_drive')
        sources.push(GOOGLE_DM_SOURCE)

        facts.push(fact({
          key: 'peak_drive_time',
          label: DRIVE_LABEL[destination.kind] ?? 'Peak-hour drive (Tue 9am)',
          value: Math.round(dm.trafficSeconds / 60),
          unit: 'min',
          display: `about ${Math.round(dm.trafficSeconds / 60)} min to ${destination.name}`,
          provenance: PROVENANCE.MEASURED,
          source: 'google-distance-matrix',
          observedAt: new Date().toISOString().slice(0, 10),
        }))

        const ratio = dm.trafficSeconds / dm.freeFlowSeconds
        facts.push(fact({
          key: 'peak_congestion',
          label: 'Rush-hour delay',
          value: Math.round(ratio * 100) / 100,
          unit: 'ratio',
          display: ratio < 1.15
            ? 'barely slower than an empty road'
            : `${Math.round((ratio - 1) * 100)}% slower than an empty road`,
          provenance: PROVENANCE.DERIVED,
          source: 'google-distance-matrix',
        }))
      } else {
        missing.push('Live traffic data was unavailable for this location.')
      }
    }

    // Keyed on where the bus count actually came from: our ETL coverage says
    // nothing about a Google result, so the fallback path earns no factor.
    const confidenceFactors = await poiConfidenceFactors(
      localBus.available ? OSM_POI_SOURCE_ID : 'google-places',
      city
    )

    return {
      facts,
      assessment: assess({ metro, busStops, facts, operating: Boolean(network?.lines?.length) }),
      missing,
      inputsPresent,
      sources: dedupeSources(sources),
      confidenceFactors,
    }
  },
}

// The assessment is a plain-language read of the facts above — it introduces
// no new information, which is why it can be written deterministically rather
// than generated. An LLM's job here (Phase 4) is phrasing, never findings.
function assess({ metro, busStops, facts, operating }) {
  if (!facts.length) return null

  const walkable = metro && metro.distanceM <= 1000
  const nearish = metro && metro.distanceM <= MAX_WALKABLE_METRO_M
  const congestion = facts.find((f) => f.key === 'peak_congestion')?.value ?? null

  let label
  // A station whose line isn't running yet is not metro access, however close
  // it is. Surat has 34 mapped stations and zero operating lines, and this
  // read "Metro nearby, but not a short walk" until someone looked at the
  // rendered output — schema-valid, and wrong about the thing that matters.
  if (metro && !operating) label = 'Metro planned nearby, not yet running'
  else if (walkable) label = 'Metro within walking distance'
  else if (nearish) label = 'Metro nearby, but not a short walk'
  else if (metro) label = 'Car or auto needed to reach the metro'
  else label = 'No metro access'

  const parts = []
  if (metro) {
    parts.push(operating
      ? `Nearest station is ${formatDistance(metro.distanceM)} away.`
      : `Nearest planned station is ${formatDistance(metro.distanceM)} away.`)
  }
  if (busStops === 0) parts.push('No bus stop within 800 m.')
  else if (busStops) parts.push(`${busStops} bus stop${busStops > 1 ? 's' : ''} within 800 m.`)
  if (congestion !== null) {
    parts.push(congestion >= 1.5
      ? 'Rush-hour traffic is heavy here.'
      : congestion >= 1.2 ? 'Moderate rush-hour traffic.' : 'Rush hour adds little to the drive.')
  }

  return { label, detail: parts.join(' ') }
}

function dedupeSources(sources) {
  return [...new Map(sources.map((s) => [s.name, s])).values()]
}
