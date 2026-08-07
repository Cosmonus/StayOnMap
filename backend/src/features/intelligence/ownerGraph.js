// Relationships BETWEEN owner accounts.
//
// Every integrity check the platform had looked at one listing in isolation
// (duplicate address, coordinates vs city, price vs benchmark). None could see
// the pattern that actually matters in Indian rentals: one broker running
// several "owner" accounts. `FraudSignalType.SAME_CONTACT` has been in the
// schema since the trust system was built with nothing producing it.
//
// WHAT MAKES THIS NEWLY POSSIBLE. Phone verification shipped 2026-08-07, and
// with it `phoneVerifiedAt`. That changes the meaning of a shared number
// completely:
//
//   • Two accounts with the same VERIFIED number cannot exist — one number, one
//     verified account, enforced at request and at verify time. So a verified
//     collision is not a thing to detect; it is a thing already prevented.
//   • Two accounts with the same UNVERIFIED number is what we can see, and it is
//     genuinely ambiguous: a family sharing a landline, an owner who mistyped, or
//     one person running three accounts. That ambiguity is the whole reason this
//     produces EVIDENCE FOR REVIEW and never a verdict.
//
// The signal therefore reports how many accounts share the number and whether
// any of them verified it, and lets a moderator decide. It never blocks, never
// suspends, and never says "fraud".
import { prisma } from '../../lib/prisma.js'

// A runaway guard on the scan below, not an expected limit. See the note there
// for what to do when this stops being comfortable.
const MAX_OWNER_SCAN = 5_000

/**
 * Indian mobile numbers, reduced to the 10 digits that identify them.
 *
 * "+91 98765 43210", "098765 43210" and "9876543210" are one number typed three
 * ways, and comparing them as strings finds nothing. Returns null for anything
 * that is not a plausible Indian mobile — a 4-digit extension shared across two
 * accounts is not evidence of anything.
 */
export function normalisePhone(raw) {
  const digits = String(raw ?? '').replace(/\D/g, '')
  if (digits.length < 10) return null
  const last10 = digits.slice(-10)
  // Indian mobile numbers start 6-9. Anything else is a landline or junk, and
  // landlines are legitimately shared — matching on one would be noise.
  return /^[6-9]\d{9}$/.test(last10) ? last10 : null
}

/**
 * Other accounts using this owner's phone number.
 *
 * Scoped to accounts that actually LIST — a tenant who happens to share a number
 * with an owner is a family member, not a signal, and including them would bury
 * the real pattern in noise.
 *
 * @returns {Promise<{phone: string, accounts: Array<{id, name, isVerified, phoneVerified, listings}>}|null>}
 */
export async function findSharedContactOwners(ownerId, phone) {
  const normalised = normalisePhone(phone)
  if (!normalised) return null

  // NORMALISED IN JS, NOT MATCHED IN SQL. The obvious query — `phone: {
  // endsWith: normalised }` — silently misses the most common stored form:
  // "+91 98765 43210" does not end with "9876543210", because of the space. A
  // fraud check that quietly finds nothing is worse than no check, so the
  // comparison happens where the formatting can be stripped.
  //
  // The cost is a scan of accounts that hold listings, which is a small set on
  // this platform and runs on a listing WRITE, not a read path. When it stops
  // being small, promote a normalised column with an index rather than making
  // this cleverer — the same rule CellPoiSummary followed: a real column the
  // moment a lookup needs one, and not before.
  const candidates = await prisma.user.findMany({
    where: {
      id: { not: ownerId },
      phone: { not: null },
      properties: { some: {} },
    },
    select: {
      id: true,
      name: true,
      phone: true,
      isVerified: true,
      phoneVerifiedAt: true,
      _count: { select: { properties: true } },
    },
    take: MAX_OWNER_SCAN,
  })

  const accounts = candidates
    .filter((u) => normalisePhone(u.phone) === normalised)
    .map((u) => ({
      id: u.id,
      name: u.name,
      isVerified: u.isVerified,
      phoneVerified: Boolean(u.phoneVerifiedAt),
      listings: u._count.properties,
    }))

  return accounts.length ? { phone: normalised, accounts } : null
}
