import { prisma } from '../../lib/prisma.js'
import { invalidatePreferences } from '../graph/preferences.js'

// The saved list is the one screen a renter comes BACK to, so it has to tell
// them what changed while they were away. A list that looks identical every
// visit is a folder of links.
//
// Three things it answers that the old flat list could not:
//   still available   how many of these can they actually still rent
//   price moved       "₹2,000 cheaper than when you saved" — the reason to look
//   new matches       how many homes like their saved ones appeared since
//
// Every one is MEASURED. Where the data isn't there — a save made before
// rentAtSave existed, a first-ever visit with no "last looked" to compare to —
// the field comes back null and the client says nothing at all.

// A listing you can still rent. OCCUPIED / INACTIVE / SUSPENDED are all "no
// longer available" from a renter's side, whatever the reason behind them.
const AVAILABLE = 'ACTIVE'

export async function getSavedByUser(userId) {
  const saved = await prisma.savedListing.findMany({
    where: { userId },
    include: {
      property: {
        include: {
          amenities: { include: { amenity: true } },
          trustScore: true,
          images: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  })

  const visits = await (
    // The renter's OWN upcoming visits to these homes — "Visit booked · Sat
    // 11:00" belongs beside the home it is for, not in another tab.
    saved.length
      ? prisma.appointment.findMany({
        where: {
          tenantId: userId,
          propertyId: { in: saved.map((s) => s.propertyId) },
          status: { in: ['ACCEPTED', 'RESCHEDULED'] },
        },
        select: { propertyId: true, requestedDate: true, requestedTime: true, scheduledAt: true, status: true },
        orderBy: { requestedDate: 'asc' },
      })
      : []
  )

  const visitByProperty = new Map()
  for (const v of visits) {
    if (!visitByProperty.has(v.propertyId)) visitByProperty.set(v.propertyId, v)
  }

  const items = saved.map((s) => {
    const rentNow = Number(s.property.rent)
    const rentThen = s.rentAtSave != null ? Number(s.rentAtSave) : null
    return {
      ...s,
      visit: visitByProperty.get(s.propertyId) ?? null,
      // Positive = cheaper than when they saved. null when no starting price was
      // ever recorded, which is NOT the same claim as "unchanged".
      priceDrop: rentThen != null && rentThen !== rentNow ? rentThen - rentNow : null,
      isAvailable: s.property.status === AVAILABLE,
    }
  })

  return items
}

// The counts above the list, and the one thing the list itself cannot say: how
// many homes like these appeared while they were away.
//
// Separate from getSavedByUser because GET /saved must keep returning an ARRAY —
// released mobile builds read it, and reshaping a live response into an object
// would break them for a header line.
//
// This is also where "I looked" is recorded, which is the honest place for it:
// the summary is the thing that reports what changed since last time.
export async function getSavedSummary(userId) {
  const saved = await prisma.savedListing.findMany({
    where: { userId },
    select: {
      propertyId: true,
      property: { select: { status: true, city: true, bhk: true, landmark: true } },
    },
  })

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { savedSeenAt: true } })

  const newMatches = await countNewMatches(userId, saved, user?.savedSeenAt)

  // Stamped AFTER the count is taken, or opening the page would clear the very
  // thing it is about to report.
  await prisma.user
    .update({ where: { id: userId }, data: { savedSeenAt: new Date() } })
    .catch(() => {})

  return {
    savedCount: saved.length,
    availableCount: saved.filter((s) => s.property.status === AVAILABLE).length,
    newMatches,
  }
}

// "3 new 2 BHKs in Koramangala since you last looked."
//
// Built from what they have actually saved — the most common size and area
// across their own list — not from a recommendation model. Returns null on a
// first visit (nothing to compare against) and when nothing new has appeared,
// so the client never has to invent copy for an empty state.
async function countNewMatches(userId, saved, savedSeenAt) {
  if (!savedSeenAt || saved.length === 0) return null

  const mode = (values) => {
    const counts = new Map()
    for (const v of values) {
      if (v === null || v === undefined || v === '') continue
      counts.set(v, (counts.get(v) ?? 0) + 1)
    }
    let best = null
    let bestCount = 0
    for (const [value, count] of counts) {
      if (count > bestCount) { best = value; bestCount = count }
    }
    return best
  }

  const city = mode(saved.map((s) => s.property.city))
  const bhk = mode(saved.map((s) => s.property.bhk))
  const area = mode(saved.map((s) => s.property.landmark)) ?? city
  if (!city) return null

  const count = await prisma.property.count({
    where: {
      status: AVAILABLE,
      city,
      ...(bhk ? { bhk } : {}),
      createdAt: { gt: savedSeenAt },
      // Their own saved ones aren't news.
      id: { notIn: saved.map((s) => s.propertyId) },
      // Nobody is shopping for their own listing.
      ownerId: { not: userId },
    },
  })

  if (count === 0) return null
  return { count, bhk: bhk ?? null, area, city }
}

export async function saveProperty(userId, propertyId) {
  // Read the price NOW so the list can report a change later. Fetched rather
  // than trusted from the client — the client has no business asserting what a
  // listing costs.
  const property = await prisma.property.findUnique({
    where: { id: propertyId },
    select: { rent: true },
  })

  const saved = await prisma.savedListing.upsert({
    where: { userId_propertyId: { userId, propertyId } },
    create: { userId, propertyId, rentAtSave: property?.rent ?? null },
    // Re-saving does NOT reset rentAtSave: the question is "cheaper than when
    // you first saved it", and an unsave/re-save cycle would quietly erase the
    // drop the renter was watching for.
    update: {},
  })

  // Saving is the single strongest signal of intent this platform collects, so
  // recommendations must reflect it NOW rather than up to five minutes later.
  // Without this, somebody who saves three flats and immediately opens "for you"
  // sees a list that ignores all three — which reads as the feature being broken
  // in exactly the moment they are paying attention to it.
  invalidatePreferences(userId).catch(() => {})

  return saved
}

// deleteMany, not delete: unsaving something already unsaved is a no-op, not an
// error. `delete` threw P2025 → an uncaught 500 on the second of two clicks, or
// on a retry over a flaky connection.
export async function unsaveProperty(userId, propertyId) {
  await prisma.savedListing.deleteMany({ where: { userId, propertyId } })
  // Removing a save is a preference signal too — arguably a clearer one than
  // adding it, since it is a decision made after seeing the listing properly.
  invalidatePreferences(userId).catch(() => {})
}
