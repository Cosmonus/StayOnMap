// Serves the LEGACY /api/v1/places/area-intelligence contract from owned data.
//
// No code in this repo calls that endpoint any more — web dropped it when the
// spatial layer landed, and mobile kept only getCommute. But **released app
// builds in the wild still call it**, so it cannot be deleted, and until now
// it answered them with the original implementation: ~11 billed Google Nearby
// calls per cache miss, counts that saturate at 20 because the code never
// pages, and a ~1.1 km cache grid that collapses walk-scale differences.
//
// This reproduces the exact response shape from PoiIndex, the metro network
// files and it-corridors.json — free, exhaustive, deduplicated, and the same
// data the current spatial layer serves. Old clients get better numbers
// without shipping an app update.
//
// It intentionally does NOT try to improve the shape. The 0-10 scores here are
// the legacy vocabulary this doc-set criticises (docs/spatial-intelligence.md
// §1.2), reproduced faithfully because old clients render them. New surfaces
// use GET /api/v1/spatial/at, which carries provenance and confidence.
import { poisNear, pickNearest } from '../spatial/poiProvider.js'
import { getMetroNetwork } from '../metro/metro.service.js'
import { getItCorridors } from '../itCorridors/itCorridors.service.js'
import { resolveCity } from '../../config/cityCenters.js'
import { haversineMeters } from '../../lib/geohash.js'

// Radii and score caps copied verbatim from areaIntelligence.service.js so the
// numbers old clients see stay comparable to what they saw before.
const TRANSIT = { metro: 2000, rail: 3000, bus: 1000 }
const CAPS = { metro: 3, rail: 2, bus: 8, it: 10 }
const ESSENTIALS_RADIUS = 1500
const IT_RADIUS = 5000

// The legacy essentials keys, mapped onto our POI vocabulary. `hospital` gains
// clinics because the legacy Google `hospital` type returned both.
const ESSENTIALS = {
  hospital:    ['hospital', 'clinic'],
  police:      ['police'],
  pharmacy:    ['pharmacy'],
  school:      ['school'],
  supermarket: ['supermarket'],
  atm:         ['atm'],
}

function scoreFromCount(count, capAt) {
  return Math.min(10, Math.round((count / capAt) * 10))
}

/** The legacy `nearest*` shape: { name, lat, lng, distanceM }. */
function shape(hit) {
  if (!hit) return null
  return { name: hit.name ?? null, lat: hit.lat, lng: hit.lng, distanceM: hit.distanceM }
}

/** Nearest metro station from the network files — real geometry, zero cost. */
function nearestMetro(lat, lng, city) {
  const network = city ? getMetroNetwork(city) : null
  // A city whose lines aren't running yet (Surat) has stations but no service.
  // The legacy contract has nowhere to express that, so report no metro rather
  // than implying a station you can ride to.
  if (!network?.stations?.length || !network.lines?.length) return null

  let best = null
  for (const s of network.stations) {
    const distanceM = Math.round(haversineMeters(lat, lng, s.lat, s.lng))
    if (!best || distanceM < best.distanceM) best = { name: s.name, lat: s.lat, lng: s.lng, distanceM }
  }
  return best
}

function nearestItPark(lat, lng, city) {
  const corridors = getItCorridors(city)?.features ?? []
  let best = null
  let count = 0
  for (const f of corridors) {
    const [cLng, cLat] = f.geometry.coordinates
    const distanceM = Math.round(haversineMeters(lat, lng, cLat, cLng))
    if (distanceM > IT_RADIUS) continue
    count++
    if (!best || distanceM < best.distanceM) {
      best = { name: f.properties?.name ?? 'IT corridor', lat: cLat, lng: cLng, distanceM }
    }
  }
  return { count, nearest: best }
}

/**
 * Can this coordinate be answered from owned data?
 * False for an unseeded city, which is when the caller should fall back.
 */
export async function canServeLocally(lat, lng) {
  const city = resolveCity(lat, lng)?.city ?? null
  if (!city) return false
  const probe = await poisNear(lat, lng, ESSENTIALS_RADIUS, ['pharmacy'], city)
  return probe.available
}

/**
 * The legacy payload, built from owned data.
 *
 * `traffic` is the one field with no free source — it needs a live Distance
 * Matrix call. Returning null is the contract's existing "unavailable" case
 * (the original returned null whenever the API key or quota was missing), and
 * old clients already handle it. Paying per request to fill it in for builds
 * nobody ships any more is not a trade worth making.
 */
export async function computeAreaIntelligenceLocal(lat, lng) {
  const city = resolveCity(lat, lng)?.city ?? null

  const essentialKeys = [...new Set(Object.values(ESSENTIALS).flat())]
  const [transitPois, essentialPois] = await Promise.all([
    poisNear(lat, lng, TRANSIT.rail, ['railway_station', 'bus_stop'], city),
    poisNear(lat, lng, ESSENTIALS_RADIUS, essentialKeys, city),
  ])

  // Rail and bus have different legacy radii than the single query above, so
  // trim each to its own — one wider query beats two round trips.
  const rail = (transitPois.byCategory?.railway_station ?? []).filter((p) => p.distanceM <= TRANSIT.rail)
  const bus = (transitPois.byCategory?.bus_stop ?? []).filter((p) => p.distanceM <= TRANSIT.bus)

  const metro = nearestMetro(lat, lng, city)
  const metroInRange = metro && metro.distanceM <= TRANSIT.metro ? metro : null

  const essentials = Object.fromEntries(
    Object.entries(ESSENTIALS).map(([key, categories]) => {
      const hits = categories
        .flatMap((c) => essentialPois.byCategory?.[c] ?? [])
        .sort((a, b) => a.distanceM - b.distanceM)
      return [key, { count: hits.length, nearest: shape(pickNearest(hits, { prefer: categories })) }]
    })
  )

  const it = nearestItPark(lat, lng, city)

  return {
    transit: {
      // The legacy score was "how many did Google return, capped" — one
      // station within range is what the count means here, since our metro
      // data is a network rather than a search result.
      metroScore: metroInRange ? scoreFromCount(1, 1) : 0,
      railScore: scoreFromCount(rail.length, CAPS.rail),
      busScore: scoreFromCount(bus.length, CAPS.bus),
      nearestMetro: shape(metroInRange),
      nearestRail: shape(pickNearest(rail)),
      nearestBus: shape(pickNearest(bus)),
    },
    essentials,
    itCorridor: {
      itScore: scoreFromCount(it.count, CAPS.it),
      nearestItPark: it.nearest,
    },
    // See the note above — null is the contract's existing unavailable case.
    traffic: null,
  }
}
