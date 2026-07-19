// Reading and writing 30-year climate normals.
//
// The one design decision worth understanding before touching this file: these
// rows are keyed at geohash precision 5 (~4.9 km), not the layer's usual
// precision 7 (~153 m).
//
// ERA5's native grid is roughly 28 km. Storing its output per 153 m cell would
// take one real number and present it as ~33,000 distinct-looking ones, which
// is the same failure the urban-heat note in environment.module.js refuses to
// ship: a city-wide value wearing the costume of a street-level one. Precision
// 5 is still finer than the source, but it is close enough that a user reading
// two nearby listings gets the same figure — because in reality it IS the same
// figure.
//
// The practical effect is that a whole city needs a handful of upstream calls
// rather than one per cell, which is why these can be fetched lazily at
// materialisation time without a seeding script.
import { prisma } from '../../lib/prisma.js'
import { encode, decode } from '../../lib/geohash.js'
import { intelLog, intelError } from '../../lib/intelLog.js'
import { climateNormals } from './providers.js'

/** ~4.9km. See the file header for why this is not 7. */
export const NORMALS_PRECISION = 5

export const VARIABLES = { TEMP_MEAN: 'temp_mean', PRECIP_SUM: 'precip_sum' }

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

export function monthName(month) {
  return MONTHS[month - 1] ?? null
}

/**
 * Reshape stored rows into per-variable arrays indexed by month.
 * @returns {{ tempMean: (number|null)[], precipSum: (number|null)[] }}
 */
function toSeries(rows) {
  const tempMean = Array(12).fill(null)
  const precipSum = Array(12).fill(null)
  for (const row of rows) {
    const i = row.month - 1
    if (i < 0 || i > 11) continue
    if (row.variable === VARIABLES.TEMP_MEAN) tempMean[i] = row.value
    if (row.variable === VARIABLES.PRECIP_SUM) precipSum[i] = row.value
  }
  return { tempMean, precipSum }
}

/** A series is usable only if we have all twelve months of both variables. */
function isComplete({ tempMean, precipSum }) {
  return tempMean.every((v) => v != null) && precipSum.every((v) => v != null)
}

/**
 * Normals for a coordinate, fetching and persisting them on first ask.
 *
 * Read-through rather than seeded by a script, because unlike POIs the volume
 * is tiny and the data never changes — a script would be a ceremony around
 * about nine rows per city.
 *
 * Never throws: a module treats null as a missing input, which lowers its
 * confidence honestly rather than failing the cell.
 *
 * @returns {{ geohash, tempMean, precipSum }|null}
 */
export async function getNormals(lat, lng) {
  const geohash = encode(lat, lng, NORMALS_PRECISION)

  try {
    const existing = await prisma.weatherNormal.findMany({ where: { geohash } })
    if (existing.length) {
      const series = toSeries(existing)
      if (isComplete(series)) return { geohash, ...series }
      // A partial set means an earlier run was interrupted. Refetching is
      // cheaper than reasoning about which months are missing.
    }
  } catch (err) {
    intelError('spatial.normals_read_failed', err, { geohash })
    return null
  }

  // Fetch for the CELL's centre, not the caller's exact coordinate, so every
  // property in the cell resolves to the same stored row rather than each one
  // writing its own near-identical copy.
  const centre = decode(geohash)
  const fetched = await climateNormals(centre.lat, centre.lng)
  if (!fetched) return null

  const series = { tempMean: fetched.tempMean, precipSum: fetched.precipSum }
  if (!isComplete(series)) {
    intelError('spatial.normals_incomplete', new Error('upstream returned gaps'), { geohash })
    return null
  }

  await persist(geohash, centre, series)
  return { geohash, ...series }
}

async function persist(geohash, centre, series) {
  const rows = []
  for (let m = 0; m < 12; m++) {
    rows.push({ variable: VARIABLES.TEMP_MEAN, month: m + 1, value: series.tempMean[m] })
    rows.push({ variable: VARIABLES.PRECIP_SUM, month: m + 1, value: series.precipSum[m] })
  }

  try {
    // Upsert per row rather than createMany: two cells racing on the same
    // precision-5 geohash is normal (they are only 153m apart), and the unique
    // constraint would make the loser's whole batch fail.
    await Promise.all(rows.map((row) => prisma.weatherNormal.upsert({
      where: { geohash_variable_month: { geohash, variable: row.variable, month: row.month } },
      create: { geohash, lat: centre.lat, lng: centre.lng, ...row },
      update: { value: row.value, ingestedAt: new Date() },
    })))
    intelLog('spatial.normals_stored', { geohash, rows: rows.length })
  } catch (err) {
    // The data is still returned to the caller — failing to cache it is not a
    // reason to withhold a correct answer from this request.
    intelError('spatial.normals_write_failed', err, { geohash })
  }
}

/**
 * Annual figures plus the seasonal shape.
 *
 * The shape is the point. An annual rainfall total describes Mumbai and
 * Bengaluru almost identically; that Mumbai delivers most of its total in four
 * months is the part that decides whether a ground-floor flat is a problem.
 */
export function summarise({ tempMean, precipSum }) {
  const annualPrecip = Math.round(precipSum.reduce((s, v) => s + v, 0))
  const meanTemp = Math.round((tempMean.reduce((s, v) => s + v, 0) / 12) * 10) / 10

  const hottestIdx = tempMean.indexOf(Math.max(...tempMean))
  const wettestIdx = precipSum.indexOf(Math.max(...precipSum))

  // How concentrated the rain is: the share falling in the wettest four
  // months. Four because that is roughly the length of an Indian monsoon, so
  // the number reads as "is the rain a season or is it year-round".
  const sorted = [...precipSum].sort((a, b) => b - a)
  const topFour = sorted.slice(0, 4).reduce((s, v) => s + v, 0)
  const concentration = annualPrecip > 0 ? Math.round((topFour / annualPrecip) * 100) : null

  return {
    meanTemp,
    annualPrecip,
    hottestMonth: monthName(hottestIdx + 1),
    hottestTemp: tempMean[hottestIdx],
    wettestMonth: monthName(wettestIdx + 1),
    wettestPrecip: Math.round(precipSum[wettestIdx]),
    monsoonConcentration: concentration,
  }
}
