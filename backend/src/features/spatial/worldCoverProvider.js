// Land cover from space — ESA WorldCover 10 m, read a window at a time.
//
// Closes `tree_cover`, declared and absent on `environment` since that module
// was written (docs/spatial-research-2026-07-28.md #4).
//
// The thing that makes this cheap: WorldCover tiles are Cloud-Optimised
// GeoTIFFs on a public S3 bucket with `Accept-Ranges: bytes`, so a 1 km window
// costs a few HTTP range requests instead of the 127 MB the tile weighs. No
// key, no quota, no bill — measured live 2026-07-28: 10,000 pixels in 3.7 s.
//
// A per-cell network call rather than a bulk ingestion is deliberate, and it
// follows `elevation()` in providers.js, which does exactly this against
// OpenTopoData. Land cover is annual, so the cache TTL is long and the call
// happens once per cell per season, not per page view.
//
// ABSENT IS A SUPPORTED STATE, like every other provider here: S3 down, a
// coordinate outside the tile grid, or a decode failure all return null and the
// module reports the input as missing rather than guessing at a number.
import { fromUrl } from 'geotiff'
import { cacheGet, cacheSet } from '../../lib/redis.js'
import { intelError } from '../../lib/intelLog.js'
import { isWithinIndia } from '../../utils/geo.js'

// Land cover changes on an annual release cycle. Six months.
const CACHE_TTL_S = 180 * 24 * 60 * 60

// 10 m pixels, so 500 m is a 100x100 window — the block a person would call
// "around here". Larger windows blur a leafy street into the arterial beside it.
export const SAMPLE_RADIUS_M = 500
const PIXEL_M = 10

const BUCKET = 'https://esa-worldcover.s3.eu-central-1.amazonaws.com/v200/2021/map'

export const WORLDCOVER_SOURCE = {
  id: 'esa-worldcover',
  label: 'ESA WorldCover 10 m v200 (2021)',
  licence: 'CC-BY 4.0',
}

// WorldCover's own class codes. Kept as ESA's numbers rather than remapped, for
// the reason Boundary.adminLevel gives: they are what the source data and every
// other consumer speak.
export const CLASS = {
  TREE: 10, SHRUB: 20, GRASS: 30, CROP: 40, BUILT: 50,
  BARE: 60, SNOW: 70, WATER: 80, WETLAND: 90, MANGROVE: 95, MOSS: 100,
}

// What counts as green. Cropland is deliberately EXCLUDED: a field is not a
// park, and on a city edge it is the thing most likely to become a building
// site. Counting it as green space would flatter exactly the addresses where
// the claim is least durable.
const GREEN = new Set([CLASS.TREE, CLASS.SHRUB, CLASS.GRASS, CLASS.WETLAND, CLASS.MANGROVE])

// One GeoTIFF handle per tile per process. Constructing it re-reads the file
// directory over HTTP, which is the expensive part; the pixel reads after it
// are small.
const tiffCache = new Map()

/**
 * WorldCover tiles are 3°x3°, named for their south-west corner.
 *
 * India is entirely north and east of the origin, so N/E are hardcoded — a
 * coordinate that would need S or W is outside `isWithinIndia` and rejected
 * before it gets here.
 */
export function tileNameFor(lat, lng) {
  const tLat = Math.floor(lat / 3) * 3
  const tLng = Math.floor(lng / 3) * 3
  return `N${String(tLat).padStart(2, '0')}E${String(tLng).padStart(3, '0')}`
}

async function imageFor(tile) {
  if (tiffCache.has(tile)) return tiffCache.get(tile)
  const url = `${BUCKET}/ESA_WorldCover_10m_2021_v200_${tile}_Map.tif`
  const promise = fromUrl(url)
    .then((t) => t.getImage())
    // Don't cache a rejection: a transient S3 blip would otherwise poison this
    // tile for the life of the process.
    .catch((err) => { tiffCache.delete(tile); throw err })
  tiffCache.set(tile, promise)
  return promise
}

/**
 * Land-cover composition around a point.
 *
 * @returns {{treePct, greenPct, builtPct, waterPct, samplePx, radiusM, clipped}|null}
 *   null means "could not look" — never "nothing grows here".
 */
export async function landCover(lat, lng, radiusM = SAMPLE_RADIUS_M) {
  if (!isWithinIndia(lat, lng)) return null

  const key = `spatial:lc:${Math.round(lat * 1000) / 1000},${Math.round(lng * 1000) / 1000},${radiusM}`
  const cached = await cacheGet(key)
  if (cached !== undefined && cached !== null) return cached.v

  try {
    const img = await imageFor(tileNameFor(lat, lng))
    const [wLng, sLat, eLng, nLat] = img.getBoundingBox()
    const W = img.getWidth()
    const H = img.getHeight()

    const px = Math.round(((lng - wLng) / (eLng - wLng)) * W)
    const py = Math.round(((nLat - lat) / (nLat - sLat)) * H)
    const r = Math.round(radiusM / PIXEL_M)

    // Clamp to the tile. A point within 500 m of a 3° edge gets a one-sided
    // sample rather than an error — reported via `clipped` so a caller can see
    // the window was not square.
    const x0 = Math.max(0, px - r)
    const y0 = Math.max(0, py - r)
    const x1 = Math.min(W, px + r)
    const y1 = Math.min(H, py + r)
    if (x1 <= x0 || y1 <= y0) return null

    const [band] = await img.readRasters({ window: [x0, y0, x1, y1] })

    let tree = 0
    let green = 0
    let built = 0
    let water = 0
    for (const v of band) {
      if (v === CLASS.TREE) tree++
      if (GREEN.has(v)) green++
      if (v === CLASS.BUILT) built++
      if (v === CLASS.WATER) water++
    }

    const total = band.length
    if (!total) return null

    const pct = (n) => Math.round((n / total) * 1000) / 10
    const result = {
      treePct: pct(tree),
      greenPct: pct(green),
      builtPct: pct(built),
      waterPct: pct(water),
      samplePx: total,
      radiusM,
      clipped: x1 - x0 < (r * 2) || y1 - y0 < (r * 2),
    }

    await cacheSet(key, { v: result }, CACHE_TTL_S)
    return result
  } catch (err) {
    intelError('spatial.worldcover_failed', err, { lat, lng })
    return null
  }
}

/** Test seam — the module-level tile handles outlive a single test otherwise. */
export function resetWorldCoverCache() {
  tiffCache.clear()
}
