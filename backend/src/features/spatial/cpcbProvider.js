// Ground-truth air quality from CPCB's monitoring stations, via data.gov.in.
//
// Everything the environment module says about air today is MODEL output
// (Open-Meteo's reanalysis). This is the one source that is an actual
// instrument reading the actual air, which is why `cpcb_station` is declared as
// an input and left absent: its absence honestly holds the module's confidence
// down rather than letting model output look like measurement.
//
// VERIFIED against a live response 2026-07-20 (3416 records, 488 stations).
//
// That verification immediately caught the bug this file's paranoia was written
// for. The resource's own `field` metadata advertises a column called
// `pollutant_avg`; the records actually carry **`avg_value`**. Reading the
// documented name found every station and every value as null, so the module
// would have degraded to "no station data" — safe, exactly as designed, and
// permanently dark. Both names are accepted now.
//
// Real-response facts worth keeping:
//   - `avg_value` / `min_value` / `max_value`, all strings, `'NA'` for a dead
//     sensor. 271 of 3416 rows were 'NA' on the day this was verified, so that
//     path is normal traffic, not an edge case.
//   - `last_update` is `DD-MM-YYYY HH:mm:ss`, NOT ISO. Handing it to a fact's
//     `observedAt` unconverted produces a date a JS Date constructor reads as
//     the wrong day or as Invalid Date.
//   - pollutant_id spans NO2, CO, NH3, OZONE, SO2 as well as PM2.5/PM10.
//   - All 9 supported cities have at least one station (Delhi 44, Mumbai 23,
//     Hyderabad 11, Bengaluru 10, Kolkata 7, Ahmedabad 7, Chennai 6, Pune 6,
//     Surat 1).
//
// Free, no cost tier, hourly updates. Get a key at data.gov.in (registration is
// free; DigiLocker SSO works) and set DATA_GOV_API_KEY.
import { env } from '../../config/env.js'
import { cacheGet, cacheSet } from '../../lib/redis.js'
import { haversineMeters } from '../../lib/geohash.js'
import { intelError, intelLog } from '../../lib/intelLog.js'

const RESOURCE_ID = '3b01bcb8-0b14-4abf-b6f2-c1bfd384ba69'
const BASE = 'https://api.data.gov.in/resource'

// CPCB stations are sparse — 488 nationally, and most towns have none. An
// earlier version refused anything past 10 km, which left the majority of real
// listings with no reading at all.
//
// That was the wrong shape of honesty. The station's distance is known
// EXACTLY, so it can grade the claim instead of gating it: a reading 2 km away
// is close to your air, one 30 km away is your region's air, and both are more
// informative than silence — provided the card says which it is. The fact
// always names the station and its distance, and `stationConfidenceFactor()`
// below reduces confidence with distance.
//
// The outer bound is not a quality threshold but an identity one: past 60 km
// you are in a different airshed, usually a different city, and the reading has
// stopped being about this place in any sense.
const MAX_STATION_DISTANCE_M = 60_000

// Where a reading stops being local. Bands rather than a curve, for the reason
// CONFIDENCE_BANDS exist — nobody can defend the difference between 11 km and
// 12 km, but "same neighbourhood / same city / same region" is real.
const DISTANCE_BANDS = [
  { maxM: 5_000, multiplier: 1, describe: () => null },
  {
    maxM: 15_000,
    multiplier: 0.85,
    describe: (km, name) =>
      `The nearest air monitor (${name}) is about ${km} km away, so this is ` +
      'your part of the city rather than your street.',
  },
  {
    maxM: Infinity,
    multiplier: 0.6,
    describe: (km, name) =>
      `The nearest air monitor (${name}) is about ${km} km away. Treat this as ` +
      'a regional reading, not a local one.',
  },
]

/**
 * A reducing confidence factor for how far away the monitor is.
 *
 * A multiplier, not a cap, for the same reason freshness is: the magnitude is
 * measured, not guessed. Floored at 0.6 rather than decaying to nothing — a
 * distant real measurement still beats a model, which is what the alternative
 * actually is here.
 *
 * @param {{distanceM: number, name: string|null}|null} station
 * @returns {{key, reason, multiplier}|null}
 */
export function stationConfidenceFactor(station) {
  if (!station || typeof station.distanceM !== 'number') return null

  const band = DISTANCE_BANDS.find((b) => station.distanceM <= b.maxM)
  const km = Math.round(station.distanceM / 1000)
  const reason = band.describe(km, station.name ?? 'the nearest CPCB station')
  if (!reason || band.multiplier >= 1) return null

  return { key: 'station_distance', reason, multiplier: band.multiplier }
}

// Readings update hourly, so anything shorter re-fetches the same numbers.
const CACHE_TTL_S = 60 * 60

// The national feed is a few thousand rows. Fetching it whole once an hour and
// picking the nearest beats a per-city filter whose column values we cannot
// verify without a key.
const ROW_LIMIT = 5000

const NATIONAL_CACHE_KEY = 'spatial:cpcb:national'

/** Numbers arrive as strings, and 'NA' is used for a missing reading. */
function num(v) {
  if (v == null || v === '' || v === 'NA') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

/**
 * `20-07-2026 05:00:00` → `2026-07-20T05:00:00`.
 *
 * Day-first, which `new Date()` will misread as month-first for any day ≤ 12 —
 * silently, and only for a third of the month. Returns null rather than
 * guessing when the shape is unfamiliar; a fact with no `observedAt` is honest,
 * a fact dated four months wrong is not.
 */
export function parseLastUpdate(s) {
  const m = /^(\d{2})-(\d{2})-(\d{4})[ T](\d{2}):(\d{2}):(\d{2})$/.exec(String(s ?? '').trim())
  if (!m) return null
  const [, dd, mm, yyyy, hh, mi, ss] = m
  if (Number(mm) < 1 || Number(mm) > 12 || Number(dd) < 1 || Number(dd) > 31) return null
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}:${ss}`
}

/**
 * Collapse the feed's one-row-per-pollutant shape into one row per station.
 *
 * Tolerant by design: a record missing coordinates or a recognisable pollutant
 * is skipped rather than defaulted, because a defaulted pollutant reading would
 * enter the system carrying MEASURED provenance.
 */
export function groupStations(records) {
  if (!Array.isArray(records)) return []

  const byStation = new Map()

  for (const r of records) {
    const lat = num(r?.latitude ?? r?.lat)
    const lng = num(r?.longitude ?? r?.lon ?? r?.long)
    if (lat === null || lng === null) continue

    const name = r?.station ?? r?.station_name ?? null
    const key = `${name ?? ''}:${lat}:${lng}`

    if (!byStation.has(key)) {
      byStation.set(key, {
        name, lat, lng,
        city: r?.city ?? null,
        observedAt: parseLastUpdate(r?.last_update ?? r?.lastupdate),
        pm25: null, pm10: null,
      })
    }

    const station = byStation.get(key)
    // `avg_value` is what the live feed actually sends; `pollutant_avg` is what
    // the resource's field metadata claims. Accept both — the documented name
    // is the one that would come back if they ever fix the mismatch.
    //
    // This is the CONCENTRATION in µg/m³. AQI sub-indices are a different scale
    // entirely and must never be read as a concentration.
    const value = num(r?.avg_value ?? r?.pollutant_avg ?? r?.avg)
    const id = String(r?.pollutant_id ?? r?.pollutant ?? '').toUpperCase()

    if (value === null) continue
    if (id === 'PM2.5' || id === 'PM25') station.pm25 = value
    else if (id === 'PM10') station.pm10 = value
  }

  // A station with neither particulate reading tells us nothing we asked about.
  return [...byStation.values()].filter((s) => s.pm25 !== null || s.pm10 !== null)
}

/** Fetch and cache the national feed. Null on any failure — never throws. */
async function nationalFeed(fetchImpl = fetch) {
  if (!env.dataGovApiKey) return null

  const cached = await cacheGet(NATIONAL_CACHE_KEY)
  if (cached?.v !== undefined) return cached.v

  try {
    const url = `${BASE}/${RESOURCE_ID}?api-key=${encodeURIComponent(env.dataGovApiKey)}` +
      `&format=json&limit=${ROW_LIMIT}`
    const res = await fetchImpl(url, { signal: AbortSignal.timeout(20_000) })
    if (!res.ok) throw new Error(`data.gov.in → HTTP ${res.status}`)

    const body = await res.json()
    const stations = groupStations(body?.records)

    // Zero stations from a 200 response means the schema moved under us. Say so
    // loudly rather than caching an empty list for an hour.
    if (stations.length === 0) {
      intelError('spatial.cpcb_empty', new Error('no stations parsed from a 200 response'), {
        recordCount: Array.isArray(body?.records) ? body.records.length : null,
      })
      return null
    }

    await cacheSet(NATIONAL_CACHE_KEY, { v: stations }, CACHE_TTL_S)
    intelLog('spatial.cpcb_fetched', { stations: stations.length })
    return stations
  } catch (err) {
    intelError('spatial.cpcb_fetch_failed', err)
    return null
  }
}

/**
 * The nearest CPCB station's particulate readings, if one is close enough.
 *
 * Returns the nearest station anywhere in the country within the airshed bound,
 * NOT only a very close one. Distance travels back with it so the caller can
 * state it on the card and grade confidence by it — see
 * `stationConfidenceFactor`.
 *
 * @returns {Promise<{name, city, lat, lng, distanceM, pm25, pm10, observedAt}|null>}
 *          null when there is no key, no feed, or nothing within the bound —
 *          all of which mean the same thing to a caller: leave `cpcb_station`
 *          absent and let confidence reflect that.
 */
export async function nearestStation(lat, lng, { fetchImpl } = {}) {
  if (typeof lat !== 'number' || typeof lng !== 'number') return null

  const stations = await nationalFeed(fetchImpl)
  if (!stations?.length) return null

  let best = null
  for (const s of stations) {
    const distanceM = haversineMeters(lat, lng, s.lat, s.lng)
    if (best === null || distanceM < best.distanceM) best = { ...s, distanceM: Math.round(distanceM) }
  }

  if (!best || best.distanceM > MAX_STATION_DISTANCE_M) return null
  return best
}
