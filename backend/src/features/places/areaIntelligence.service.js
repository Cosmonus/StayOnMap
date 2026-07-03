// Live, API-computed neighborhood intelligence for an arbitrary lat/lng —
// unlike backend/src/data/area-profiles.json (hand-authored estimates for
// ~16 named neighborhoods, Chennai/Bengaluru only), this works for ANY
// coordinate in any city by querying Google directly. Uses the same
// server-side GOOGLE_MAPS_KEY as trust.service.js (unrestricted — see
// docs/google-maps-api-setup.md).
//
// Deliberately does NOT compute flood risk — there is no live API for this
// in India (flood-zone data is published as static maps/PDFs by city
// corporations and ISRO's Bhuvan portal, not a queryable service). Flood
// risk stays a manually-curated value in area-profiles.json until someone
// digitizes a real source.
import { env } from '../../config/env.js'
import { cacheGet, cacheSet as redisCacheSet } from '../../lib/redis.js'

const NEARBY_URL = 'https://maps.googleapis.com/maps/api/place/nearbysearch/json'
const DISTANCE_MATRIX_URL = 'https://maps.googleapis.com/maps/api/distancematrix/json'

// ~1km grid cell, cached for a day — this data doesn't meaningfully change
// faster than that, and it saves real API cost on repeat map/property views.
// Redis-backed (shared across horizontally-scaled instances) when REDIS_URL
// is set; recomputes every time otherwise.
function cacheKey(lat, lng, type) {
  const r = (n) => Math.round(Number(n) * 100) / 100
  return `area-intel:${type}:${r(lat)},${r(lng)}`
}

// computeTraffic legitimately caches a `null` result ("unavailable") — bare
// cacheGet can't tell that apart from a cache miss, since both are `null`.
// Wrapping in { v } makes a real cached null distinguishable (returns
// undefined on true miss, not null).
async function getCached(key) {
  const wrapped = await cacheGet(key)
  return wrapped ? wrapped.v : undefined
}
async function cacheSet(key, value, ttlSeconds = 24 * 60 * 60) {
  await redisCacheSet(key, { v: value }, ttlSeconds)
  return value
}

function haversineMeters(lat1, lng1, lat2, lng2) {
  const R = 6371000
  const toRad = (d) => (d * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

async function nearbySearch(lat, lng, { type, keyword, radius }) {
  if (!env.googleMapsKey) return []
  const params = new URLSearchParams({ location: `${lat},${lng}`, radius: String(radius), key: env.googleMapsKey })
  if (type) params.set('type', type)
  if (keyword) params.set('keyword', keyword)
  try {
    const data = await fetch(`${NEARBY_URL}?${params.toString()}`).then((r) => r.json())
    if (data.status !== 'OK') return []
    return data.results ?? []
  } catch {
    return []
  }
}

function nearestOf(lat, lng, places) {
  if (!places.length) return null
  const withDist = places.map((p) => ({
    name: p.name,
    lat: p.geometry.location.lat,
    lng: p.geometry.location.lng,
    distanceM: Math.round(haversineMeters(lat, lng, p.geometry.location.lat, p.geometry.location.lng)),
  }))
  withDist.sort((a, b) => a.distanceM - b.distanceM)
  return withDist[0]
}

function scoreFromCount(count, capAt) {
  return Math.min(10, Math.round((count / capAt) * 10))
}

// ── Transit: metro/rail/bus station counts + nearest of each ──────────────────
export async function computeTransit(lat, lng) {
  const key = cacheKey(lat, lng, 'transit')
  const cached = await getCached(key)
  if (cached !== undefined) return cached

  const [metro, rail, bus] = await Promise.all([
    nearbySearch(lat, lng, { type: 'subway_station', radius: 2000 }),
    nearbySearch(lat, lng, { type: 'train_station', radius: 3000 }),
    nearbySearch(lat, lng, { type: 'bus_station', radius: 1000 }),
  ])

  return cacheSet(key, {
    metroScore: scoreFromCount(metro.length, 3),
    railScore: scoreFromCount(rail.length, 2),
    busScore: scoreFromCount(bus.length, 8),
    nearestMetro: nearestOf(lat, lng, metro),
    nearestRail: nearestOf(lat, lng, rail),
    nearestBus: nearestOf(lat, lng, bus),
  })
}

// ── Nearby essentials: raw counts, no scoring — UI decides how to show these ──
export async function computeEssentials(lat, lng) {
  const key = cacheKey(lat, lng, 'essentials')
  const cached = await getCached(key)
  if (cached !== undefined) return cached

  const types = ['hospital', 'school', 'supermarket', 'pharmacy', 'atm']
  const results = await Promise.all(types.map((type) => nearbySearch(lat, lng, { type, radius: 1500 })))
  const essentials = Object.fromEntries(types.map((type, i) => [type, results[i].length]))

  return cacheSet(key, essentials)
}

// ── IT corridor: keyword search since there's no dedicated Places type ───────
export async function computeItCorridor(lat, lng) {
  const key = cacheKey(lat, lng, 'it')
  const cached = await getCached(key)
  if (cached !== undefined) return cached

  const results = await nearbySearch(lat, lng, { keyword: 'IT park OR tech park OR software company', radius: 5000 })

  return cacheSet(key, {
    itScore: scoreFromCount(results.length, 10),
    nearestItPark: nearestOf(lat, lng, results),
  })
}

// ── Traffic: Distance Matrix duration_in_traffic vs. free-flow duration over
// a short fixed probe hop, as a rough local-congestion proxy. Requires the
// Distance Matrix API enabled on GOOGLE_MAPS_KEY (separate from Places/
// Geocoding) — returns null rather than throwing if it isn't, since this is
// the least certain of these signals and shouldn't break the rest.
export async function computeTraffic(lat, lng) {
  const key = cacheKey(lat, lng, 'traffic')
  const cached = await getCached(key)
  if (cached !== undefined) return cached
  if (!env.googleMapsKey) return cacheSet(key, null)

  const destLat = lat + 0.02 // ~2.2km probe hop — arbitrary direction, just needs a nearby destination
  const params = new URLSearchParams({
    origins: `${lat},${lng}`,
    destinations: `${destLat},${lng}`,
    departure_time: 'now',
    key: env.googleMapsKey,
  })

  try {
    const data = await fetch(`${DISTANCE_MATRIX_URL}?${params.toString()}`).then((r) => r.json())
    const el = data.rows?.[0]?.elements?.[0]
    if (data.status !== 'OK' || el?.status !== 'OK' || !el.duration_in_traffic) {
      return cacheSet(key, null, 60 * 60) // shorter TTL — probably a config issue, worth re-checking sooner
    }
    const ratio = el.duration_in_traffic.value / el.duration.value // ~1 = free-flow, higher = more congested
    const score = Math.min(10, Math.max(1, Math.round(ratio * 5)))
    return cacheSet(key, { score, ratio: Math.round(ratio * 100) / 100 })
  } catch {
    return cacheSet(key, null, 60 * 60)
  }
}

export async function computeAreaIntelligence(lat, lng) {
  const [transit, essentials, itCorridor, traffic] = await Promise.all([
    computeTransit(lat, lng),
    computeEssentials(lat, lng),
    computeItCorridor(lat, lng),
    computeTraffic(lat, lng),
  ])
  return { transit, essentials, itCorridor, traffic }
}
