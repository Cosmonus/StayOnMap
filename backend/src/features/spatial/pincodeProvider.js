// What India Post says a pincode is — the ground truth for location claims.
//
// Reads the locally-seeded PincodeDirectory (scripts/fetch-pincode-directory.mjs).
// The critical distinction this module preserves, same as poiProvider's:
//
//   available: false        → the directory has not been seeded here.
//                             "We cannot check" — callers must SKIP the check,
//                             never fail it.
//   available: true, found: null → India Post has no such pincode. That is a
//                             real finding: a typo, or an invented code.
//
// Collapsing those two would turn "we didn't load the data" into "your pincode
// is fake" — an accusation aimed at an owner, made on our own missing homework.
import { prisma } from '../../lib/prisma.js'
import { cacheGet, cacheSet } from '../../lib/redis.js'
import { intelError } from '../../lib/intelLog.js'

const CACHE_TTL_S = 24 * 60 * 60 // pincodes change glacially
const SEEDED_TTL_S = 60 * 60

let seededMemo = null
let seededMemoAt = 0

/** Test-only: the memo is module state, so one test's answer would otherwise
 * outlive it and answer the next test's different fixture. Same lesson as
 * cpcbProvider.resetStationCache, learned the same way. */
export function resetPincodeCache() {
  seededMemo = null
  seededMemoAt = 0
}

/** Is the directory present at all? Cached — this gates every check. */
async function directorySeeded() {
  if (seededMemo !== null && Date.now() - seededMemoAt < SEEDED_TTL_S * 1000) return seededMemo
  const cached = await cacheGet('pincode:seeded')
  if (cached?.v !== undefined) return cached.v
  try {
    const n = await prisma.pincodeDirectory.count()
    const seeded = n > 0
    seededMemo = seeded
    seededMemoAt = Date.now()
    await cacheSet('pincode:seeded', { v: seeded }, SEEDED_TTL_S)
    return seeded
  } catch (err) {
    intelError('spatial.pincode_seeded_check_failed', err)
    return false // fail toward "cannot check", never toward "fake pincode"
  }
}

/**
 * Everything India Post knows about one pincode.
 *
 * @param {string|number} raw
 * @returns {Promise<{available: boolean, found: null|{
 *   pincode, state, districts: string[], taluks: string[],
 *   offices: Array<{name, type}>
 * }}>}
 */
export async function pincodeInfo(raw) {
  const pincode = String(raw ?? '').trim()
  if (!/^\d{6}$/.test(pincode)) return { available: true, found: null }

  if (!(await directorySeeded())) return { available: false, found: null }

  const key = `pincode:info:${pincode}`
  const cached = await cacheGet(key)
  if (cached?.v !== undefined) return { available: true, found: cached.v }

  try {
    const rows = await prisma.pincodeDirectory.findMany({
      where: { pincode },
      select: { officeName: true, officeType: true, district: true, state: true, taluk: true },
    })
    if (!rows.length) {
      await cacheSet(key, { v: null }, CACHE_TTL_S)
      return { available: true, found: null }
    }

    const found = {
      pincode,
      // One state per pincode in practice; take the first, report all districts
      // — a pincode straddling districts is real (route sets, not polygons).
      state: rows[0].state,
      districts: [...new Set(rows.map((r) => r.district))],
      taluks: [...new Set(rows.map((r) => r.taluk).filter(Boolean))],
      offices: rows.map((r) => ({ name: r.officeName, type: r.officeType })),
    }
    await cacheSet(key, { v: found }, CACHE_TTL_S)
    return { available: true, found }
  } catch (err) {
    intelError('spatial.pincode_lookup_failed', err, { pincode })
    return { available: false, found: null }
  }
}
