// External data providers for the spatial layer — every billed call the
// modules make goes through here, so cost control, timeouts, caching and
// failure semantics live in exactly one place.
//
// Three things this file guarantees, which modules therefore don't repeat:
//
//   1. A provider NEVER throws. It returns null, and the module reports the
//      input as missing, which lowers confidence honestly. One flaky upstream
//      must not take a whole cell down.
//   2. Every call is counted against a daily budget (env.spatialDailyApiBudget).
//      Cell count is driven by where owners choose to list, so without a
//      ceiling the bill is set by someone else.
//   3. Results are cached under the {v} wrapper, because lib/redis.js's
//      cacheGet collapses "no redis", "cache miss" and "stored null" into a
//      single null — so a cached "this genuinely returned nothing" would
//      otherwise re-bill forever.
import { env } from '../../config/env.js'
import { redis, cacheGet, cacheSet as redisCacheSet } from '../../lib/redis.js'
import { intelLog, intelError } from '../../lib/intelLog.js'

const NEARBY_URL = 'https://maps.googleapis.com/maps/api/place/nearbysearch/json'
const DISTANCE_MATRIX_URL = 'https://maps.googleapis.com/maps/api/distancematrix/json'

// Node's fetch has no default timeout, and materialisation runs off the
// request path where a hang is invisible until it exhausts the pool.
const TIMEOUT_MS = 8_000

// Provider results outlive a single cell computation: adjacent cells 153m
// apart legitimately share upstream answers. A week matches how fast this
// data actually changes.
const PROVIDER_TTL_S = 7 * 24 * 60 * 60

const AIR_QUALITY_URL = 'https://air-quality-api.open-meteo.com/v1/air-quality'
const ELEVATION_URL = 'https://api.opentopodata.org/v1/srtm30m'
const ARCHIVE_URL = 'https://archive-api.open-meteo.com/v1/archive'

export const OSM_SOURCE = { name: 'OpenStreetMap', license: 'ODbL', fetchedAt: '2026-07-05' }
export const OPEN_METEO_SOURCE = { name: 'Open-Meteo (CAMS model)', license: 'CC-BY-4.0', fetchedAt: null }
export const SRTM_SOURCE = { name: 'NASA SRTM 30m via OpenTopoData', license: 'public domain', fetchedAt: null }
export const ERA5_SOURCE = { name: 'ERA5 reanalysis via Open-Meteo', license: 'CC-BY-4.0', fetchedAt: null }
export const GOOGLE_PLACES_SOURCE = { name: 'Google Places', license: 'commercial', fetchedAt: null }
export const GOOGLE_DM_SOURCE = { name: 'Google Distance Matrix', license: 'commercial', fetchedAt: null }

// ── Daily budget ────────────────────────────────────────────────────────────

function budgetKey(now = new Date()) {
  return `spatial:budget:${now.toISOString().slice(0, 10)}`
}

/**
 * Reserve one billed call. Returns false when the day's ceiling is spent.
 *
 * No Redis means no shared counter, so the budget can't be enforced — dev and
 * fresh checkouts run unmetered, same graceful-degradation contract as every
 * other Redis-optional feature here.
 */
async function reserveCall() {
  if (!redis) return true
  try {
    const key = budgetKey()
    const used = await redis.incr(key)
    if (used === 1) await redis.expire(key, 36 * 60 * 60) // outlive the day, self-clean
    if (used > env.spatialDailyApiBudget) {
      // Log once at the boundary, not on every subsequent rejection.
      if (used === env.spatialDailyApiBudget + 1) {
        intelLog('spatial.budget_exhausted', { limit: env.spatialDailyApiBudget })
      }
      return false
    }
    return true
  } catch {
    // A Redis hiccup must not block materialisation — fail open on counting,
    // never fail open on spending money we can't see. Counting is the lesser
    // risk: worst case we slightly overshoot the ceiling for one day.
    return true
  }
}

// ── Cache helpers ({ v } wrapper — see file header) ─────────────────────────

async function getCached(key) {
  const wrapped = await cacheGet(key)
  return wrapped ? wrapped.v : undefined
}

async function setCached(key, value, ttl = PROVIDER_TTL_S) {
  await redisCacheSet(key, { v: value }, ttl)
  return value
}

// Provider cache keys round to 3dp (~110m), roughly one geohash-7 cell, so
// neighbouring cells share upstream answers without smearing across a
// neighbourhood.
function coordKey(lat, lng) {
  const r = (n) => Math.round(Number(n) * 1000) / 1000
  return `${r(lat)},${r(lng)}`
}

async function fetchJson(url, timeoutMs = TIMEOUT_MS) {
  const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) })
  return res.json()
}

// ── Google Places Nearby ────────────────────────────────────────────────────

/**
 * Places near a point.
 * @returns {Array<{name, lat, lng}>|null}  null = we couldn't find out (≠ empty array, which means "none here")
 */
export async function nearbyPlaces(lat, lng, { type, keyword, radius }) {
  if (!env.googleMapsKey) return null

  const cacheId = `spatial:nearby:${type ?? keyword}:${radius}:${coordKey(lat, lng)}`
  const cached = await getCached(cacheId)
  if (cached !== undefined) return cached

  if (!(await reserveCall())) return null

  const params = new URLSearchParams({
    location: `${lat},${lng}`,
    radius: String(radius),
    key: env.googleMapsKey,
  })
  if (type) params.set('type', type)
  if (keyword) params.set('keyword', keyword)

  try {
    const data = await fetchJson(`${NEARBY_URL}?${params}`)
    // ZERO_RESULTS is a real answer — "nothing here" — and must be cached as
    // an empty array, not treated as a failure and retried forever.
    if (data.status === 'ZERO_RESULTS') return setCached(cacheId, [])
    if (data.status !== 'OK') {
      intelError('spatial.nearby_failed', new Error(data.status ?? 'unknown'), { type, keyword })
      return null
    }
    const places = (data.results ?? []).map((p) => ({
      name: p.name,
      lat: p.geometry?.location?.lat ?? null,
      lng: p.geometry?.location?.lng ?? null,
    })).filter((p) => p.lat !== null)
    return setCached(cacheId, places)
  } catch (err) {
    intelError('spatial.nearby_failed', err, { type, keyword })
    return null
  }
}

/** Convenience: just how many. null when we couldn't find out. */
export async function nearbyCount(lat, lng, opts) {
  const places = await nearbyPlaces(lat, lng, opts)
  return places === null ? null : places.length
}

// ── Google Distance Matrix ──────────────────────────────────────────────────

/**
 * Driving time to a destination at a specific departure time.
 *
 * @param {{lat:number,lng:number}} origin
 * @param {{lat:number,lng:number}} destination
 * @param {number} departureTime  Unix seconds; must be in the future for
 *                                duration_in_traffic to be returned at all
 * @returns {{trafficSeconds, freeFlowSeconds, distanceMeters}|null}
 */
export async function distanceMatrix({ origin, destination, departureTime }) {
  if (!env.googleMapsKey) return null

  const cacheId =
    `spatial:dm:${coordKey(origin.lat, origin.lng)}:${coordKey(destination.lat, destination.lng)}:${departureTime}`
  const cached = await getCached(cacheId)
  if (cached !== undefined) return cached

  if (!(await reserveCall())) return null

  const params = new URLSearchParams({
    origins: `${origin.lat},${origin.lng}`,
    destinations: `${destination.lat},${destination.lng}`,
    departure_time: String(departureTime),
    region: 'in',
    key: env.googleMapsKey,
  })

  try {
    const data = await fetchJson(`${DISTANCE_MATRIX_URL}?${params}`)
    const el = data.rows?.[0]?.elements?.[0]
    if (data.status !== 'OK' || el?.status !== 'OK' || !el.duration_in_traffic) {
      // Usually means the Distance Matrix API isn't enabled on the key, which
      // is a config problem worth rechecking sooner than a week.
      intelError('spatial.distance_matrix_failed', new Error(el?.status ?? data.status ?? 'unknown'), {})
      return setCached(cacheId, null, 60 * 60)
    }
    return setCached(cacheId, {
      trafficSeconds: el.duration_in_traffic.value,
      freeFlowSeconds: el.duration.value,
      distanceMeters: el.distance?.value ?? null,
    })
  } catch (err) {
    intelError('spatial.distance_matrix_failed', err, {})
    return setCached(cacheId, null, 60 * 60)
  }
}

// ── Open-Meteo Air Quality ──────────────────────────────────────────────────

/**
 * Air quality for a coordinate: current PM2.5/PM10 plus a 90-day distribution.
 *
 * Free, no API key, ~10k calls/day — so it is NOT counted against the daily
 * budget, which exists to cap metered Google spend. It still gets a long cache
 * TTL out of basic courtesy to a free service.
 *
 * The 90-day history is the point. Today's reading is weather; the median and
 * the 90th percentile are what someone deciding where to live actually needs,
 * because Indian air quality is violently seasonal and a July number says
 * nothing about November.
 *
 * @returns {{ currentPm25, currentPm10, medianPm25, p90Pm25, sampleCount }|null}
 */
export async function airQuality(lat, lng) {
  const cacheId = `spatial:aq:${coordKey(lat, lng)}`
  const cached = await getCached(cacheId)
  if (cached !== undefined) return cached

  const params = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lng),
    current: 'pm2_5,pm10',
    hourly: 'pm2_5',
    past_days: '92',
    forecast_days: '1',
    timezone: 'Asia/Kolkata',
  })

  try {
    // 92 days of hourly readings is a much larger response than the Google
    // endpoints return, and 8s is not enough for it on a slow link.
    const data = await fetchJson(`${AIR_QUALITY_URL}?${params}`, 20_000)
    if (data?.current?.pm2_5 == null) {
      intelError('spatial.air_quality_failed', new Error(data?.reason ?? 'no current reading'), {})
      return setCached(cacheId, null, 60 * 60)
    }

    const series = (data.hourly?.pm2_5 ?? []).filter((v) => v != null).sort((a, b) => a - b)
    const at = (q) => (series.length ? series[Math.floor(series.length * q)] : null)

    return setCached(cacheId, {
      currentPm25: data.current.pm2_5,
      currentPm10: data.current.pm10 ?? null,
      medianPm25: at(0.5),
      p90Pm25: at(0.9),
      sampleCount: series.length,
    }, 6 * 60 * 60) // air quality moves hourly; 6h is a fair compromise
  } catch (err) {
    intelError('spatial.air_quality_failed', err, {})
    return setCached(cacheId, null, 60 * 60)
  }
}

// ── OpenTopoData elevation (NASA SRTM 30m) ──────────────────────────────────

// Terrain does not move. The only reason this expires at all is so a bad
// cached value eventually clears itself.
const ELEVATION_TTL_S = 180 * 24 * 60 * 60

// How far out the surrounding samples sit. 750m is chosen against the source's
// own resolution: SRTM is 30m, so samples this far apart are genuinely
// independent readings rather than the same pixel returned eight times.
const RELIEF_SAMPLE_M = 750

/** Offset a coordinate by metres. Flat-earth maths, correct well under 1km. */
function offsetBy(lat, lng, northM, eastM) {
  return {
    lat: lat + northM / 111_320,
    lng: lng + eastM / (111_320 * Math.cos((lat * Math.PI) / 180)),
  }
}

/**
 * Elevation at a point, plus the terrain immediately around it.
 *
 * One request covers nine samples — the point and a ring at 750m — because the
 * useful facts here are comparative. A bare "14 m above sea level" tells a
 * renter in Chennai nothing; "4 m below everything within 750m" tells them
 * where the water goes.
 *
 * Free, no key, and NOT counted against the daily budget, which exists to cap
 * metered Google spend (same reasoning as airQuality). OpenTopoData's public
 * instance allows 1 call/second and 1000/day, so a 429 is treated as a normal
 * outcome and retried later rather than logged as a fault.
 *
 * @returns {{ elevationM, minAroundM, maxAroundM, reliefM, relativeM, sampleCount }|null}
 *          relativeM: the point's height relative to the mean of its ring —
 *          negative means it sits lower than its surroundings.
 */
export async function elevation(lat, lng) {
  const cacheId = `spatial:elev:${coordKey(lat, lng)}`
  const cached = await getCached(cacheId)
  if (cached !== undefined) return cached

  const d = RELIEF_SAMPLE_M
  const ring = [
    offsetBy(lat, lng, d, 0), offsetBy(lat, lng, -d, 0),
    offsetBy(lat, lng, 0, d), offsetBy(lat, lng, 0, -d),
    offsetBy(lat, lng, d, d), offsetBy(lat, lng, d, -d),
    offsetBy(lat, lng, -d, d), offsetBy(lat, lng, -d, -d),
  ]
  const points = [{ lat, lng }, ...ring]
  const params = new URLSearchParams({
    locations: points.map((p) => `${p.lat.toFixed(6)},${p.lng.toFixed(6)}`).join('|'),
  })

  try {
    const data = await fetchJson(`${ELEVATION_URL}?${params}`, 15_000)
    if (data?.status !== 'OK' || !Array.isArray(data.results)) {
      // Rate-limited or over the daily cap — a normal condition on a free
      // shared instance, not a fault. Short cache so the next cell retries.
      intelError('spatial.elevation_failed', new Error(data?.error ?? data?.status ?? 'unknown'), {})
      return setCached(cacheId, null, 60 * 60)
    }

    const values = data.results.map((r) => r.elevation)
    const centre = values[0]
    // SRTM returns null over water and in voids. A null centre means we have
    // no reading for the actual location, which is not the same as sea level.
    if (centre == null) return setCached(cacheId, null, ELEVATION_TTL_S)

    const around = values.slice(1).filter((v) => v != null)
    if (around.length < 4) {
      // Too few neighbours to say anything comparative. The absolute height is
      // still true, so return it — the module drops the relief facts.
      return setCached(cacheId, {
        elevationM: Math.round(centre),
        minAroundM: null, maxAroundM: null, reliefM: null, relativeM: null,
        sampleCount: 1,
      }, ELEVATION_TTL_S)
    }

    const mean = around.reduce((s, v) => s + v, 0) / around.length
    return setCached(cacheId, {
      elevationM: Math.round(centre),
      minAroundM: Math.round(Math.min(...around)),
      maxAroundM: Math.round(Math.max(...around)),
      reliefM: Math.round(Math.max(...around) - Math.min(...around)),
      relativeM: Math.round((centre - mean) * 10) / 10,
      sampleCount: around.length + 1,
    }, ELEVATION_TTL_S)
  } catch (err) {
    intelError('spatial.elevation_failed', err, {})
    return setCached(cacheId, null, 60 * 60)
  }
}

// ── Open-Meteo archive (ERA5) — 30-year climate normals ─────────────────────

// The WMO standard normals period. Pinned as a constant because changing it
// silently would make old and new rows incomparable while looking identical.
export const NORMALS_PERIOD = { start: '1991-01-01', end: '2020-12-31' }

/**
 * Monthly climate normals for a coordinate: mean temperature and total
 * precipitation, averaged across the 1991-2020 period.
 *
 * Returns per-month values, not an annual figure, because the annual mean is
 * the least useful number here. "1400 mm a year" describes Mumbai and
 * Bengaluru alike; that 80% of Mumbai's falls in four months is the fact
 * somebody choosing a ground-floor flat needs.
 *
 * Free, no key, not budget-counted. The response is 30 years of daily values
 * for two variables — several MB — so the timeout is generous and the result
 * is written to the WeatherNormal table by the caller rather than being
 * re-fetched per cell.
 *
 * @returns {{ tempMean: number[], precipSum: number[] }|null}  12 entries each,
 *          index 0 = January. Nulls inside the arrays where a month had no data.
 */
export async function climateNormals(lat, lng) {
  const cacheId = `spatial:normals:${coordKey(lat, lng)}`
  const cached = await getCached(cacheId)
  if (cached !== undefined) return cached

  const params = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lng),
    start_date: NORMALS_PERIOD.start,
    end_date: NORMALS_PERIOD.end,
    daily: 'temperature_2m_mean,precipitation_sum',
    timezone: 'Asia/Kolkata',
  })

  try {
    const data = await fetchJson(`${ARCHIVE_URL}?${params}`, 90_000)
    const days = data?.daily?.time
    if (!Array.isArray(days) || !days.length) {
      intelError('spatial.normals_failed', new Error(data?.reason ?? 'no daily series'), {})
      return setCached(cacheId, null, 60 * 60)
    }

    const temps = data.daily.temperature_2m_mean ?? []
    const precip = data.daily.precipitation_sum ?? []

    // Accumulate per calendar month. Temperature is a mean of daily means;
    // precipitation is a total per year, then averaged across years — summing
    // all 30 Januaries and dividing by 30 gives a typical January, whereas
    // dividing by the number of DAYS would give a daily rate labelled monthly.
    const tempSum = Array(12).fill(0), tempN = Array(12).fill(0)
    const precipByMonthYear = new Map() // 'month:year' → total mm

    for (let i = 0; i < days.length; i++) {
      const month = Number(days[i].slice(5, 7)) - 1
      const year = days[i].slice(0, 4)
      if (temps[i] != null) { tempSum[month] += temps[i]; tempN[month]++ }
      if (precip[i] != null) {
        const key = `${month}:${year}`
        precipByMonthYear.set(key, (precipByMonthYear.get(key) ?? 0) + precip[i])
      }
    }

    const precipSum = Array(12).fill(null)
    for (let m = 0; m < 12; m++) {
      const totals = [...precipByMonthYear.entries()]
        .filter(([k]) => k.startsWith(`${m}:`))
        .map(([, v]) => v)
      if (totals.length) {
        precipSum[m] = Math.round((totals.reduce((s, v) => s + v, 0) / totals.length) * 10) / 10
      }
    }

    const tempMean = tempSum.map((sum, m) =>
      tempN[m] ? Math.round((sum / tempN[m]) * 10) / 10 : null)

    return setCached(cacheId, { tempMean, precipSum }, PROVIDER_TTL_S)
  } catch (err) {
    intelError('spatial.normals_failed', err, {})
    return setCached(cacheId, null, 60 * 60)
  }
}
