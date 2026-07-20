// Ground-truth air quality from CPCB's monitoring stations, via data.gov.in.
//
// Everything the environment module says about air today is MODEL output
// (Open-Meteo's reanalysis). This is the one source that is an actual
// instrument reading the actual air, which is why `cpcb_station` is declared as
// an input and left absent: its absence honestly holds the module's confidence
// down rather than letting model output look like measurement.
//
// ⚠ SCHEMA IS UNVERIFIED AGAINST A LIVE RESPONSE. There is no data.gov.in key
// in this environment, so the field names below come from the resource's
// published documentation, not from a call that was made and inspected. The
// parser is deliberately tolerant and returns null on anything it doesn't
// recognise — a wrong guess must degrade to "no station data", never to a
// confidently wrong number presented as MEASURED. Verify against a real
// response before trusting the readings (docs/operator-actions.md).
//
// Free, no cost tier, hourly updates. Get a key at data.gov.in (registration is
// free; DigiLocker SSO works) and set DATA_GOV_API_KEY.
import { env } from '../../config/env.js'
import { cacheGet, cacheSet } from '../../lib/redis.js'
import { haversineMeters } from '../../lib/geohash.js'
import { intelError, intelLog } from '../../lib/intelLog.js'

const RESOURCE_ID = '3b01bcb8-0b14-4abf-b6f2-c1bfd384ba69'
const BASE = 'https://api.data.gov.in/resource'

// CPCB stations are sparse — a handful per city, none in most towns. Beyond
// this, a reading is describing somewhere else's air. 10 km is already generous
// for a pollutant that varies street to street; past it the honest answer is
// "no station near you", not a number with a caveat.
const MAX_STATION_DISTANCE_M = 10_000

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
        observedAt: r?.last_update ?? r?.lastupdate ?? null,
        pm25: null, pm10: null,
      })
    }

    const station = byStation.get(key)
    // `pollutant_avg` is the concentration. Sub-indices are a different scale
    // entirely and must never be read as µg/m³ — mixing them is the mistake
    // this whole comment exists to prevent.
    const value = num(r?.pollutant_avg ?? r?.avg)
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
 * @returns {Promise<{name, city, lat, lng, distanceM, pm25, pm10, observedAt}|null>}
 *          null when there is no key, no feed, or no station within range —
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
