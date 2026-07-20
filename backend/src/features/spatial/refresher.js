// Keeps materialised cells fresh, without adding a job queue.
//
// The backend has no scheduler, no BullMQ, no worker process — the only
// setInterval in src/ is the keep-alive ping in index.js. Adding a queue
// infrastructure to re-run a handful of computations every few minutes would
// be more moving parts than the problem has.
//
// So: an interval that claims the stalest cells under a Redis lock. If this
// ever outgrows itself, Railway cron is a config change rather than a
// refactor, and materialize() is already idempotent either way.
//
// Three properties that matter:
//   - Multi-instance safe. The Redis lock means two Railway instances don't
//     both pay Google for the same cell. Without Redis it still runs, which is
//     correct for single-process dev.
//   - Budget-aware by construction. It refreshes a bounded number of cells per
//     tick and providers.js enforces the daily ceiling underneath.
//   - Circuit-broken. Cells at MAX_FAILURES are excluded by the query, so a
//     permanently broken cell can't monopolise every tick.
import { prisma } from '../../lib/prisma.js'
import { redis } from '../../lib/redis.js'
import { intelLog, intelError } from '../../lib/intelLog.js'
import { materialize, MAX_FAILURES } from './spatial.service.js'
import { startRefreshQueue, stopRefreshQueue, isQueueRunning } from './refreshQueue.js'

const TICK_MS = 5 * 60 * 1000

// Small on purpose. Each cell can cost several billed calls, and a refresher
// that empties the daily budget in its first tick is worse than one that takes
// an hour to catch up.
const CELLS_PER_TICK = 10

// Must exceed the worst realistic tick duration, or a slow tick releases its
// lock mid-run and a second instance starts duplicating work.
const LOCK_TTL_S = 4 * 60
const LOCK_KEY = 'spatial:refresh:lock'


let timer = null

/**
 * Claim the right to run this tick.
 *
 * No Redis → always true. That is right for a single process and wrong for
 * several, but a deploy running multiple instances without Redis already has
 * bigger problems (rate limits and socket fan-out both assume it).
 */
async function acquireLock() {
  if (!redis) return true
  try {
    // SET NX EX — atomic claim that self-releases if this process dies
    // mid-tick, so a crash costs one skipped cycle rather than a stuck lock.
    const res = await redis.set(LOCK_KEY, String(process.pid), 'EX', LOCK_TTL_S, 'NX')
    return res === 'OK'
  } catch {
    // Redis unreachable: skip rather than risk every instance refreshing at
    // once. The next tick tries again, and cells stay readable meanwhile —
    // getContext() serves stale rows quite happily.
    return false
  }
}

async function releaseLock() {
  if (!redis) return
  try { await redis.del(LOCK_KEY) } catch { /* the TTL will clear it */ }
}

export async function runRefreshTick() {
  if (!(await acquireLock())) return { skipped: true, refreshed: 0 }

  const started = Date.now()
  let refreshed = 0

  try {
    const due = await prisma.spatialContext.findMany({
      where: {
        staleAfter: { lte: new Date() },
        failCount: { lt: MAX_FAILURES },
      },
      // Stalest first, so a backlog drains in the order that matters rather
      // than starving the cells that have been wrong longest.
      orderBy: { staleAfter: 'asc' },
      take: CELLS_PER_TICK,
      select: { geohash: true },
    })

    if (due.length === 0) return { skipped: false, refreshed: 0 }

    // Sequential, not Promise.all: this is background work with no user
    // waiting, and serialising it keeps a burst of billed calls from landing
    // on Google all at once.
    for (const cell of due) {
      await materialize(cell.geohash)
      refreshed++
    }

    intelLog('spatial.refresh_tick', { refreshed, ms: Date.now() - started })
    return { skipped: false, refreshed }
  } catch (err) {
    intelError('spatial.refresh_tick_failed', err, { refreshed })
    return { skipped: false, refreshed, error: true }
  } finally {
    await releaseLock()
  }
}

/**
 * Start the background refresher. Idempotent.
 *
 * Prefers the durable pg-boss schedule (refreshQueue.js) and falls back to a
 * plain interval when it can't start — no DATABASE_URL, no CREATE SCHEMA
 * rights, an older DB. The fallback is exactly the behaviour that shipped
 * before the queue existed, so the worst case is "no worse than before"
 * rather than "no refresher".
 *
 * Async now, because bringing up the queue is. Callers that don't await it
 * still get a working refresher; they just don't learn which path won.
 *
 * @returns {Promise<'queue'|'interval'>} which path is running
 */
export async function startRefresher() {
  if (timer || isQueueRunning()) return isQueueRunning() ? 'queue' : 'interval'

  if (await startRefreshQueue(process.env.DATABASE_URL, runRefreshTick)) return 'queue'

  // unref() so the interval never holds the process open — a graceful shutdown
  // shouldn't wait up to five minutes for a timer that does background work.
  timer = setInterval(() => { runRefreshTick().catch(() => {}) }, TICK_MS)
  timer.unref?.()
  intelLog('spatial.refresher_started', {
    tickMs: TICK_MS,
    cellsPerTick: CELLS_PER_TICK,
    // Named so a production log says WHICH scheduler is live. Diagnosing "the
    // refresher isn't running" is materially harder when both paths log the
    // same line.
    path: 'interval',
  })
  return 'interval'
}

export async function stopRefresher() {
  await stopRefreshQueue()
  if (!timer) return
  clearInterval(timer)
  timer = null
}
