// Spatial context service — materialises and serves the per-cell intelligence.
//
// The read path is one indexed lookup. Materialisation, which is where the
// billed calls happen, runs off the request path (fire-and-forget on listing
// create/publish, same pattern as intelligence.service.js's evaluateListing).
//
// This replaces the per-request model in areaIntelligence.service.js, where
// every property view could cost ~11 Google requests and the answer was thrown
// away after 24h. See docs/spatial-intelligence.md §1.
import { prisma } from '../../lib/prisma.js'
import { encode, decode } from '../../lib/geohash.js'
import { cacheGet, cacheSet } from '../../lib/redis.js'
import { intelLog, intelError } from '../../lib/intelLog.js'
import { resolveCity } from '../../config/cityCenters.js'
import { modulesFor, isStale, MODULES_BY_KEY } from './registry.js'
import { buildEnvelope, unavailableEnvelope } from './envelope.js'

// Redis sits in front of Postgres purely to absorb read bursts (a popular
// listing, a map pan). Short TTL — the durable copy is the table, and a stale
// minute here is harmless.
const READ_CACHE_TTL_S = 10 * 60

// A cell that keeps failing is usually bad coordinates or a dead upstream.
// Stop paying to rediscover that.
const MAX_FAILURES = 5

function readCacheKey(geohash) {
  return `spatial:ctx:${geohash}`
}

/**
 * Run every module for a cell, tolerating individual failures.
 *
 * A module that throws yields an UNAVAILABLE envelope rather than taking the
 * cell down — the frontend renders "we don't know this, and why" the same way
 * it renders everything else.
 */
/**
 * Where a module's envelope is stored inside the cell's `modules` JSON.
 *
 * Most modules describe the PLACE, so one envelope serves every listing in the
 * cell. Mobility does not: its destination depends on the property type
 * (employment / arrival / city core), so a shop and the flats above it need
 * different answers from the same coordinate — and a ground-floor shop under
 * flats is normal, not an edge case. Those modules get a per-type slot so the
 * two can't overwrite each other.
 */
export function storageKey(module, propertyType) {
  return module.variesByType ? `${module.key}@${propertyType ?? 'ANY'}` : module.key
}

async function computeModules(cell, previous = {}, propertyType = null) {
  const now = new Date()
  // Only the modules this property type actually needs. A cell holding just
  // apartments never computes `commerce`; the first shop listed there adds it
  // to the same row. Modules accumulate per cell as types appear, which is
  // what keeps type-specific intelligence from multiplying the cost.
  const wanted = modulesFor(propertyType)
  const out = { ...previous }

  await Promise.all(wanted.map(async (module) => {
    const slot = storageKey(module, propertyType)
    const stored = previous[slot]
    // Reuse a still-fresh envelope of the current version. This is what makes
    // module TTLs independent: metro data can sit for a week while a shorter-
    // lived module refreshes, without re-billing the long one.
    if (!isStale(stored, module, now)) {
      out[slot] = stored
      return
    }
    try {
      const result = await module.compute({ ...cell, propertyType })
      out[slot] = buildEnvelope(module, result)
    } catch (err) {
      intelError('spatial.module_failed', err, { geohash: cell.geohash, module: module.key })
      out[slot] = unavailableEnvelope(module, 'This information could not be calculated for this location.')
    }
  }))

  return prune(out)
}

/**
 * Drop envelopes that no longer correspond to a live storage slot.
 *
 * `out` starts as a copy of whatever was stored, so entries survive forever
 * otherwise — including ones orphaned by a module being renamed, removed, or
 * (as happened here) switching to per-type slots, which left a stale plain
 * `mobility` envelope behind that nothing would ever read again.
 *
 * Deliberately keeps EVERY type's slot for a live module: computing for a shop
 * must not delete the flats' mobility answer from the same cell.
 */
function prune(modules) {
  return Object.fromEntries(Object.entries(modules).filter(([slot]) => {
    const [key, type] = slot.split('@')
    const module = MODULES_BY_KEY[key]
    if (!module) return false
    // A per-type module is only valid in a per-type slot, and vice versa.
    return module.variesByType ? Boolean(type) : !type
  }))
}

/** The soonest any module in the set wants to be recomputed. */
function earliestStaleAfter(modules) {
  const times = Object.values(modules)
    .map((m) => new Date(m.staleAfter).getTime())
    .filter((t) => Number.isFinite(t))
  return times.length ? new Date(Math.min(...times)) : new Date(Date.now() + 60 * 60 * 1000)
}

/**
 * Compute (or refresh) a cell and persist it.
 *
 * Safe to call concurrently for the same cell: the upsert is keyed on geohash,
 * so a race costs one redundant computation, not a duplicate row.
 *
 * @param {string} geohash
 * @returns {Promise<object|null>} the stored row's modules, or null if skipped
 */
export async function materialize(geohash, propertyType = null) {
  const started = Date.now()
  try {
    const existing = await prisma.spatialContext.findUnique({ where: { geohash } })

    if (existing && existing.failCount >= MAX_FAILURES) {
      intelLog('spatial.cell_circuit_open', { geohash, failCount: existing.failCount })
      return existing.modules
    }

    const { lat, lng } = decode(geohash)
    const resolved = resolveCity(lat, lng)
    const cell = { geohash, lat, lng, city: resolved?.city ?? null }

    const modules = await computeModules(cell, existing?.modules ?? {}, propertyType)

    // If every module came back unavailable, treat it as a failed run so the
    // circuit breaker can eventually stop retrying — but still store what we
    // have, so the page renders "unknown" rather than nothing.
    const allUnavailable = Object.values(modules).every((m) => m.status === 'UNAVAILABLE')
    const failCount = allUnavailable ? (existing?.failCount ?? 0) + 1 : 0

    const data = {
      lat, lng,
      city: cell.city,
      modules,
      computedAt: new Date(),
      staleAfter: earliestStaleAfter(modules),
      failCount,
    }

    await prisma.spatialContext.upsert({
      where: { geohash },
      create: { geohash, ...data },
      update: data,
    })

    await cacheSet(readCacheKey(geohash), { v: modules }, READ_CACHE_TTL_S)

    intelLog('spatial.cell_materialized', {
      geohash,
      city: cell.city,
      modules: Object.fromEntries(Object.entries(modules).map(([k, m]) => [k, m.confidence.value])),
      allUnavailable,
      ms: Date.now() - started,
    })

    return modules
  } catch (err) {
    intelError('spatial.materialize_failed', err, { geohash })
    return null
  }
}

/**
 * Race a promise against a timeout without leaving a dangling timer.
 * Resolves to `undefined` if the timeout wins; the work keeps running.
 */
function withTimeout(promise, ms) {
  let timer
  const timeout = new Promise((resolve) => { timer = setTimeout(() => resolve(undefined), ms) })
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer))
}

/**
 * Spatial context for a coordinate.
 *
 * A warm cell is one indexed lookup and never touches an external API.
 *
 * A cold cell is the interesting case. Returning null and computing in the
 * background is cheapest, but it means the first person to open a listing in a
 * new area sees an empty section — which reads as "there's nothing to say about
 * this neighbourhood" rather than "we haven't looked yet". So a cold read waits
 * briefly (`waitMs`) for the computation it just started, and falls back to
 * `pending: true` if that takes too long. Cells are warmed at listing
 * create/publish and by scripts/backfill-spatial-context.mjs, so in practice
 * this path is rare.
 *
 * Callers must handle `modules: null, pending: true` — it means "not yet",
 * which is a different thing from "nothing here".
 *
 * @param {number} lat
 * @param {number} lng
 * @param {{ materializeIfMissing?: boolean, waitMs?: number }} [opts]
 * @returns {Promise<{ geohash, city, modules, computedAt, pending }|null>}
 */
export async function getContext(lat, lng, { materializeIfMissing = true, waitMs = 0, propertyType = null } = {}) {
  const geohash = encode(lat, lng)
  const wanted = modulesFor(propertyType)

  // Everything a listing of this type should see is present and current.
  // A cell warmed by an apartment has no `commerce` envelope, so the first
  // shop listed there must trigger a top-up rather than render a gap.
  const hasAllWanted = (modules) =>
    Boolean(modules) && wanted.every((m) => !isStale(modules[storageKey(m, propertyType)], m))

  // Read from the per-type slot, return under the plain key — the frontend
  // never needs to know a module was stored per type.
  const forType = (modules) =>
    Object.fromEntries(
      wanted.map((m) => [m.key, modules[storageKey(m, propertyType)]]).filter(([, v]) => v)
    )

  const cached = await cacheGet(readCacheKey(geohash))
  if (cached?.v && hasAllWanted(cached.v)) {
    return { geohash, city: resolveCity(lat, lng)?.city ?? null, modules: forType(cached.v), computedAt: null, pending: false }
  }

  const row = await prisma.spatialContext.findUnique({ where: { geohash } })

  if (!row || !hasAllWanted(row.modules)) {
    if (!materializeIfMissing) return row ? { geohash, city: row.city, modules: forType(row.modules), computedAt: row.computedAt, pending: false } : null

    const city = resolveCity(lat, lng)?.city ?? null
    const work = materialize(geohash, propertyType).catch(() => null)

    if (waitMs > 0) {
      const modules = await withTimeout(work, waitMs)
      if (modules) return { geohash, city, modules: forType(modules), computedAt: new Date(), pending: false }
    }

    // A partially-warm cell still has something worth showing while the
    // missing modules compute — better than a pending state that hides facts
    // we already hold.
    if (row?.modules) {
      const partial = forType(row.modules)
      if (Object.keys(partial).length > 0) {
        return { geohash, city: row.city, modules: partial, computedAt: row.computedAt, pending: false }
      }
    }

    // Still running. Say so, rather than returning null and letting the UI
    // imply the neighbourhood has nothing worth reporting.
    return { geohash, city, modules: null, computedAt: null, pending: true }
  }

  // A stale row still renders — with its own computedAt on display — while a
  // refresh runs behind it. Showing week-old transit data is better than
  // showing a spinner, and the envelope carries the date so nobody is misled.
  if (row.staleAfter <= new Date() && row.failCount < MAX_FAILURES) {
    materialize(geohash).catch(() => {})
  }

  await cacheSet(readCacheKey(geohash), { v: row.modules }, READ_CACHE_TTL_S)

  return {
    geohash,
    city: row.city,
    modules: forType(row.modules),
    computedAt: row.computedAt,
    pending: false,
  }
}

/**
 * Ensure a listing's cell exists. Called fire-and-forget from
 * properties.service.js on create/publish — by the time anyone views the
 * listing, its neighbourhood is usually already described.
 */
export async function ensureContextForProperty(lat, lng, propertyType = null) {
  try {
    if (lat == null || lng == null) return
    const geohash = encode(Number(lat), Number(lng))
    const existing = await prisma.spatialContext.findUnique({
      where: { geohash },
      select: { modules: true, failCount: true },
    })
    if (existing && existing.failCount >= MAX_FAILURES) return
    // Freshness alone isn't enough: a cell warmed by a flat is "fresh" and
    // still missing every module a shop needs.
    const wanted = modulesFor(propertyType)
    if (existing?.modules && wanted.every((m) => !isStale(existing.modules[storageKey(m, propertyType)], m))) return
    await materialize(geohash, propertyType)
  } catch (err) {
    intelError('spatial.ensure_failed', err, {})
  }
}
