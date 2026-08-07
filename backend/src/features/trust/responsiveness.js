// How responsive an owner is to visit requests.
//
// WHAT THIS REPLACED, because the old number was worse than useless. Until
// 2026-08-07 `responseRate` was `accepted / (accepted + rejected)` — an
// ACCEPTANCE rate wearing a response rate's name, printed to renters on the
// mobile owner card as "62% response rate". An owner who replied to every
// request within an hour and declined half of them scored 50, identical to one
// who ignored half and answered the rest. It measured agreement and called it
// responsiveness, so the honest "sorry, it's taken" was penalised exactly like
// silence — and silence is the only one of the two a renter actually suffers
// from. It fed 30 of OwnerTrust's 100 points.
//
// The fix is the obvious one once stated: count whether the owner ANSWERED,
// and how fast. Declining promptly is responding.
//
// Two rules hold this together:
//
// 1. SILENCE HAS TO BE COUNTABLE. An ignored request stays PENDING forever, so
//    a formula that only looks at decided rows can never see the very
//    behaviour it exists to measure — which is precisely how the old one
//    dodged it. Unanswered requests are in the denominator here.
//
// 2. THE CLOCK STARTS, BUT IT HAS TO RUN OUT FIRST. A request made an hour ago
//    is not being ignored; it is in flight. Nothing counts against an owner
//    until GRACE_HOURS has passed, so a burst of new requests can never dent
//    the score of someone who is simply asleep.
//
// Pure functions on plain rows, in their own file, because trust.service.js is
// globally mocked in tests/setup.js — anything exported from there is
// unreachable to a unit test by construction.

// A request younger than this is in flight, not ignored. Two days spans a
// weekend for the many owners who are not running this as a business.
export const GRACE_HOURS = 48

const HOUR_MS = 60 * 60 * 1000

// The owner has answered when they accept, decline, or move the slot. All
// three are answers; only the first two used to count.
const OWNER_ANSWERED = new Set(['ACCEPTED', 'REJECTED', 'RESCHEDULED'])

// With nothing to judge, an owner is neither good nor bad at this. 50 is the
// same neutral the old formula used for an owner with no appointments — the
// alternative, 0, would rank every brand-new owner below one who ignores
// people, and the alternative 100 would make silence the profitable strategy
// until the first request arrives.
export const NEUTRAL_RATE = 50

const hoursBetween = (from, to) => (new Date(to) - new Date(from)) / HOUR_MS

function median(values) {
  if (!values.length) return null
  const sorted = [...values].sort((a, b) => a - b)
  const mid = sorted.length >> 1
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

/**
 * Did the owner ever answer this request?
 *
 * `respondedAt` is the truth and is stamped the first time the owner acts.
 * Rows that predate that column (2026-08-07) have none, so their STATUS is the
 * only evidence available — a decided row was decided by somebody. Those rows
 * can say whether an owner answered but not how fast, which is why the speed
 * half below reads `respondedAt` alone rather than falling back to `updatedAt`.
 * `updatedAt` moves on every later edit, so an owner who answered in ten
 * minutes and added a note a week later would measure as a week.
 */
const wasAnswered = (a) => Boolean(a.respondedAt) || OWNER_ANSWERED.has(a.status)

/**
 * Was this request left hanging long enough to count as ignored?
 *
 * Two shapes qualify:
 *   PENDING past the grace window   — still waiting, and has waited too long.
 *   CANCELLED with no response      — the renter gave up. This is the case the
 *                                     denominator would otherwise lose, and it
 *                                     is the one that matters most: a renter
 *                                     who waits three days and withdraws is
 *                                     evidence of exactly the behaviour being
 *                                     measured. Cancelling inside the grace
 *                                     window is the renter changing their own
 *                                     mind and is not held against anyone.
 */
function wasIgnored(a, now) {
  if (wasAnswered(a)) return false
  if (a.status === 'PENDING') return hoursBetween(a.createdAt, now) > GRACE_HOURS
  if (a.status === 'CANCELLED') return hoursBetween(a.createdAt, a.updatedAt ?? now) > GRACE_HOURS
  return false
}

// Speed is a MULTIPLIER on the rate, never its own additive term. An owner who
// answers everything slowly still answered everything, and should outrank one
// who answers half of it instantly — a separate additive speed term would let
// a fast, selective owner beat a slower, reliable one, which is the same
// mistake the acceptance rate made in a new costume.
//
// The bands are deliberately coarse and generous. Nothing here can be measured
// to the hour across owners in different time zones, businesses and sleep
// schedules, so the ladder rewards "same day" and stops caring after that.
export function speedFactor(medianHours) {
  // No measurable response yet (all legacy rows, or none answered) is not
  // slowness. Absent evidence must not read as bad evidence.
  if (medianHours === null) return 1
  if (medianHours <= 6) return 1
  if (medianHours <= 24) return 0.95
  if (medianHours <= 72) return 0.85
  return 0.75
}

/**
 * @param appointments rows with { status, createdAt, updatedAt, respondedAt }
 * @param now injectable so the grace window is testable without waiting 48h
 * @returns {{ responseRate, medianHours, speedFactor, answered, ignored }}
 *          `responseRate` is 0-100 and now means what its name says: the share
 *          of requests this owner actually answered. Speed is reported
 *          separately so the score can weight it without the stored number
 *          becoming a blend nobody can explain to the owner it describes.
 */
export function ownerResponsiveness(appointments = [], now = new Date()) {
  const answered = appointments.filter(wasAnswered)
  const ignored  = appointments.filter((a) => wasIgnored(a, now))

  const judged = answered.length + ignored.length
  const responseRate = judged > 0 ? (answered.length / judged) * 100 : NEUTRAL_RATE

  // Only rows with a real stamp — see wasAnswered's note on legacy rows.
  const hours = answered
    .filter((a) => a.respondedAt)
    .map((a) => Math.max(0, hoursBetween(a.createdAt, a.respondedAt)))

  const medianHours = median(hours)

  return {
    responseRate,
    medianHours,
    speedFactor: speedFactor(medianHours),
    answered: answered.length,
    ignored: ignored.length,
  }
}
