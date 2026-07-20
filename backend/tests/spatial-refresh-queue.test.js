// The durable refresher schedule, and — more importantly — what happens when it
// can't start.
//
// The queue is an upgrade, not a dependency. A backend that cannot bring up
// pg-boss (no DATABASE_URL, no CREATE SCHEMA rights, an older DB) must still
// refresh cells on the interval that shipped before it existed. The failure
// mode this guards against is a "durability improvement" that quietly leaves
// production with no refresher at all.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Hoisted so the module under test sees the mock at import time.
const { bossMock, PgBossMock } = vi.hoisted(() => {
  const bossMock = {
    on: vi.fn(),
    start: vi.fn().mockResolvedValue(undefined),
    createQueue: vi.fn().mockResolvedValue(undefined),
    work: vi.fn().mockResolvedValue('worker-id'),
    schedule: vi.fn().mockResolvedValue(undefined),
    stop: vi.fn().mockResolvedValue(undefined),
  }
  // `function`, not an arrow: this is invoked with `new`, and an arrow has no
  // [[Construct]] slot.
  return { bossMock, PgBossMock: vi.fn(function () { return bossMock }) }
})

vi.mock('pg-boss', () => ({ default: PgBossMock }))

const { startRefreshQueue, stopRefreshQueue, isQueueRunning } =
  await import('../src/features/spatial/refreshQueue.js')

const CONN = 'postgresql://user:pass@localhost:5432/db'

beforeEach(() => {
  vi.clearAllMocks()
  bossMock.start.mockResolvedValue(undefined)
  bossMock.createQueue.mockResolvedValue(undefined)
  bossMock.work.mockResolvedValue('worker-id')
  bossMock.schedule.mockResolvedValue(undefined)
})

afterEach(async () => { await stopRefreshQueue() })

describe('startRefreshQueue', () => {
  it('registers a recurring job and reports running', async () => {
    const handler = vi.fn().mockResolvedValue({ refreshed: 3 })
    expect(await startRefreshQueue(CONN, handler)).toBe(true)
    expect(isQueueRunning()).toBe(true)
    expect(bossMock.schedule).toHaveBeenCalledOnce()
    expect(bossMock.schedule.mock.calls[0][1]).toBe('*/5 * * * *')
  })

  it('runs exactly one tick at a time', async () => {
    // Concurrent ticks would race on the same "stalest cells" query and pay
    // twice for the same cell — what the Redis lock existed to prevent.
    await startRefreshQueue(CONN, vi.fn())
    expect(bossMock.work.mock.calls[0][1]).toMatchObject({ teamSize: 1, teamConcurrency: 1 })
  })

  it('calls the injected handler, not something of its own', async () => {
    const handler = vi.fn().mockResolvedValue({ refreshed: 1 })
    await startRefreshQueue(CONN, handler)

    const registered = bossMock.work.mock.calls[0][2]
    await registered()
    expect(handler).toHaveBeenCalledOnce()
  })

  it('attaches an error listener before starting', async () => {
    // pg-boss emits on an EventEmitter; an unhandled 'error' is an uncaught
    // exception, i.e. a background queue taking the API process down.
    await startRefreshQueue(CONN, vi.fn())
    expect(bossMock.on).toHaveBeenCalledWith('error', expect.any(Function))
  })

  it('is idempotent — a second call does not schedule twice', async () => {
    await startRefreshQueue(CONN, vi.fn())
    await startRefreshQueue(CONN, vi.fn())
    expect(bossMock.schedule).toHaveBeenCalledOnce()
  })
})

describe('startRefreshQueue — refuses rather than throws', () => {
  it('declines with no connection string', async () => {
    expect(await startRefreshQueue(undefined, vi.fn())).toBe(false)
    expect(isQueueRunning()).toBe(false)
  })

  it('declines with no handler', async () => {
    expect(await startRefreshQueue(CONN, undefined)).toBe(false)
  })

  it('returns false when pg-boss cannot start, and does not throw', async () => {
    // The real case: a DB user without CREATE SCHEMA rights. This must degrade
    // to the interval, not take the boot sequence with it.
    bossMock.start.mockRejectedValue(new Error('permission denied for database'))
    await expect(startRefreshQueue(CONN, vi.fn())).resolves.toBe(false)
    expect(isQueueRunning()).toBe(false)
  })

  it('returns false when the schedule cannot be registered', async () => {
    bossMock.schedule.mockRejectedValue(new Error('relation does not exist'))
    expect(await startRefreshQueue(CONN, vi.fn())).toBe(false)
    expect(isQueueRunning()).toBe(false)
  })
})

describe('stopRefreshQueue', () => {
  it('is safe when the queue never started', async () => {
    await expect(stopRefreshQueue()).resolves.toBeUndefined()
  })

  it('clears running state even if stopping errors', async () => {
    await startRefreshQueue(CONN, vi.fn())
    bossMock.stop.mockRejectedValue(new Error('already closed'))
    await stopRefreshQueue()
    // Otherwise a failed shutdown leaves the module believing a dead queue is
    // live, and startRefresher would never fall back.
    expect(isQueueRunning()).toBe(false)
  })
})
