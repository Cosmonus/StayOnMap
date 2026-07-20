// Durable scheduling for the spatial refresher.
//
// What this replaces, and why it was not good enough:
//
//   setInterval lives in one process's memory. A deploy kills it mid-tick and
//   nothing records that the tick was owed — the work is simply skipped until
//   the next boot happens to come round again. A cell that throws is retried
//   only by accident, whenever its staleAfter next comes up. And there is no
//   way to ask "what has this thing been doing", because it left no trace.
//
// pg-boss turns the schedule into rows in the database that already exists. No
// Redis requirement, no second Railway service, no new infrastructure: it
// creates its own `pgboss` schema and polls it. What that buys, concretely:
//
//   - Durability. A deploy mid-tick leaves the job row; it runs after boot.
//   - Retry with backoff, and a terminal failure that is VISIBLE as a row
//     rather than a log line nobody reads.
//   - Single execution across instances, natively. This is why the Redis lock
//     in refresher.js is no longer the load-bearing mechanism — a queue that
//     hands each job to exactly one worker is the thing the lock was
//     approximating. The lock stays for the setInterval fallback path below.
//
// Deliberately NOT a separate worker service. The audit recommends one and it
// is right at scale, but a second always-on Railway service costs money to run
// a job that currently has zero cells to refresh. In-process gets the
// durability and the visibility, which is where the value is today. Splitting
// later is a config change: the handler is already a pure function of the DB.
//
// ⚠ pg-boss creates and migrates its own `pgboss` schema on start(). That is a
// production DB change NOT managed by Prisma migrations. It is idempotent and
// self-applying, but it means the DB user needs CREATE SCHEMA rights.
// NAMED import. pg-boss 12 is an ES module with no default export — a default
// import throws at load time and takes the entire API process with it, because
// this file is reachable from src/index.js's startRefresher().
//
// This shipped broken and the test suite stayed green, because the test mocked
// `{ default: PgBossMock }` — inventing an export shape the real module does not
// have. A mock that describes a module incorrectly does not test integration; it
// asserts the fiction back to you. The test now imports the real package to
// check its shape (see spatial-refresh-queue.test.js).
import { PgBoss } from 'pg-boss'
import { intelLog, intelError } from '../../lib/intelLog.js'

const QUEUE = 'spatial-refresh'

// Matches the interval the setInterval version ran at. The cadence was never
// the problem; the durability was.
const EVERY_5_MIN = '*/5 * * * *'

// One tick at a time, always. Concurrent ticks would race on the same "stalest
// cells" query and pay twice for the same cell — the exact thing the Redis lock
// existed to prevent.
//
// pg-boss 12 renamed these: `teamSize`/`teamConcurrency` are silently ignored
// (checkWorkArgs validates batchSize / localConcurrency and neither rejects nor
// honours unknown keys), so passing them asked for a guarantee the library
// never heard. The v12 defaults happen to serialise, which is why nothing broke
// — protection that works by luck is protection that disappears on an upgrade.
const BATCH_SIZE = 1
const LOCAL_CONCURRENCY = 1

// Longer than the worst realistic tick. A tick that outruns this is assumed
// dead and retried, so it must not be shorter than a slow-but-healthy run.
const EXPIRE_IN_MINUTES = 10

let boss = null

/**
 * Start the durable scheduler.
 *
 * Returns false rather than throwing when the queue can't be brought up —
 * refresher.js falls back to its interval, which is the behaviour that shipped
 * before this file existed. A background refresher failing to start must never
 * be what stops the API serving requests.
 *
 * The tick is INJECTED rather than imported, for two reasons: refresher.js
 * imports this module, so importing it back would be a cycle; and a queue whose
 * work is a parameter can be tested without standing up the thing it schedules.
 *
 * @param {string} connectionString
 * @param {() => Promise<any>} handler  one tick of work
 * @returns {Promise<boolean>} whether the queue is running
 */
export async function startRefreshQueue(connectionString, handler) {
  if (boss) return true
  if (!connectionString || typeof handler !== 'function') return false

  try {
    boss = new PgBoss({
      connectionString,
      // Small: this instance runs one recurring job, not a workload. The API's
      // own Prisma pool is the one that matters and this must not crowd it.
      max: 2,
      // pg-boss's own housekeeping. Left at its defaults except for keeping
      // completed jobs long enough to be worth looking at — the visibility is
      // half the reason for adopting it.
      retentionDays: 7,
    })

    // An error on the boss itself (lost connection, failed maintenance) is not
    // fatal to the API. Without a listener, pg-boss emits on an EventEmitter
    // with no handler, which Node treats as an uncaught exception.
    boss.on('error', (err) => intelError('spatial.queue_error', err))

    await boss.start()
    await boss.createQueue(QUEUE)

    await boss.work(
      QUEUE,
      { batchSize: BATCH_SIZE, localConcurrency: LOCAL_CONCURRENCY },
      // The handler is deliberately the SAME function the interval called.
      // Swapping the scheduler must not also mean rewriting the work, or a
      // regression here would be indistinguishable from a queue bug.
      //
      // Note it is not wrapped in a try/catch: throwing is how a job is marked
      // failed and retried. runRefreshTick catches its own errors and returns
      // { error: true }, so in practice retries come from a crash or a timeout
      // — which are exactly the cases the interval silently swallowed.
      () => handler()
    )

    // Idempotent: re-scheduling the same key replaces the existing schedule
    // rather than stacking a second one on every deploy.
    await boss.schedule(QUEUE, EVERY_5_MIN, null, {
      expireInMinutes: EXPIRE_IN_MINUTES,
      // Singleton by the minute, so two instances booting together cannot
      // both enqueue the same scheduled tick.
      singletonKey: QUEUE,
    })

    intelLog('spatial.queue_started', { queue: QUEUE, cron: EVERY_5_MIN })
    return true
  } catch (err) {
    intelError('spatial.queue_start_failed', err)
    // Shut the instance down before dropping the reference.
    //
    // `start()` opens a pool and `work()` registers a polling worker, so a
    // failure in the LAST step (schedule) used to leave both running and
    // unreachable — stopRefreshQueue short-circuits on `if (!boss) return`.
    // pg-boss schedules are rows in the database, so a schedule left by an
    // earlier deploy keeps enqueuing ticks that the orphaned worker then picks
    // up, while startRefresher sees `false` and ALSO starts the interval. On a
    // deploy without Redis the lock is a no-op, so both would run the same tick.
    if (boss) {
      try { await boss.stop({ graceful: false }) } catch { /* already broken */ }
    }
    boss = null
    return false
  }
}

/** Stop the scheduler. Safe to call when it never started. */
export async function stopRefreshQueue() {
  if (!boss) return
  try {
    await boss.stop({ graceful: true })
  } catch (err) {
    intelError('spatial.queue_stop_failed', err)
  } finally {
    boss = null
  }
}

/** Whether the durable path is the one currently running. */
export function isQueueRunning() {
  return boss !== null
}
