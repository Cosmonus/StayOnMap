/**
 * The human-quotable case reference.
 *
 * `SupportCase.number` is a Postgres SERIAL, so the database owns uniqueness
 * and nothing races. This is only the formatting, kept in one file because it
 * appears in a subject line, a notification, an admin list and a search box —
 * four places that must agree about what "SC-1042" means or a person reading a
 * number off an email cannot find it.
 */

/** 1042 → "SC-1042". */
export const caseRef = (number) => `SC-${number}`

/**
 * "SC-1042" | "sc 1042" | "1042" → 1042, or null.
 *
 * Deliberately forgiving on input and strict on output: people paste the
 * reference out of an email with whatever spacing and case it had, and a search
 * box that only accepts the canonical form is a search box that fails for the
 * one person who most needs it. Anything that is not ultimately a positive
 * integer returns null rather than NaN, so callers can branch on it.
 */
export function parseCaseRef(input) {
  if (input == null) return null
  const digits = String(input).trim().replace(/^sc[\s-]*/i, '')
  if (!/^\d+$/.test(digits)) return null
  const n = Number(digits)
  return Number.isSafeInteger(n) && n > 0 ? n : null
}
