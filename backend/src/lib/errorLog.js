// The last few server errors, in memory, so the admin panel can answer "is
// something broken right now".
//
// Today nothing surfaces a 5xx anywhere: `SENTRY_DSN` is unset and the only
// record is `console.error` into journalctl on the VM. An operator looking at
// the admin panel cannot tell a broken deploy from a quiet afternoon, which is
// the actual blind spot — not the absence of a vendor.
//
// IN MEMORY, DELIBERATELY, and the limits are the point rather than an
// oversight:
//   - it resets on restart, so it cannot answer "what broke last Tuesday"
//   - it is per-process (there is exactly one today)
//   - it holds 50 errors, so a storm shows a rate and the newest examples
//
// That is the smallest thing that removes the blindness, and it costs no
// vendor, no dependency, no table and no migration. If history turns out to be
// needed, THAT is when a table or Sentry's free tier earns its place — the
// readout will already exist to prove it gets read.
//
// Nothing here is user-facing: messages can carry stack text and internal
// detail, which is exactly why `errorMiddleware` sanitises what it SENDS while
// recording the real thing here, and why the readout is admin-only.

const MAX = 50
const WINDOW_MS = 60 * 60 * 1000

/** @type {{ at: number, status: number, code: string, message: string, path: string }[]} */
const recent = []
let total = 0
const startedAt = Date.now()

export function recordServerError({ status, code, message, path, method }) {
  total += 1
  recent.unshift({
    at: Date.now(),
    status,
    code: code ?? null,
    // Truncated: this is a triage list, not a log aggregator, and a 4KB Prisma
    // error would push everything else off the screen.
    message: String(message ?? '').slice(0, 300),
    path: `${method ?? ''} ${path ?? ''}`.trim(),
  })
  if (recent.length > MAX) recent.length = MAX
}

export function errorStatus() {
  const cutoff = Date.now() - WINDOW_MS
  return {
    lastHour: recent.filter((e) => e.at >= cutoff).length,
    // `total` outlives the 50-entry buffer, so a burst that scrolled off is
    // still visible as a count rather than silently forgotten.
    sinceRestart: total,
    watchingSince: new Date(startedAt).toISOString(),
    kept: MAX,
    recent: recent.slice(0, 20),
  }
}

/** Test seam — the buffer is module state, and a suite must not inherit another's. */
export function _resetErrorLog() {
  recent.length = 0
  total = 0
}
