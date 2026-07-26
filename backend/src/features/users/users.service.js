import { prisma } from '../../lib/prisma.js'
import { requestPasswordReset, stripPasswordHash } from '../auth/auth.service.js'
import { awardPoints } from '../points/points.service.js'
import { SUPPORTED_CITIES } from '../../config/cities.js'
import { getPoints } from '../points/points.service.js'

// Completeness per docs/points-and-sharing.md: name + avatar + city + phone.
// Deliberately different from requireCompleteProfile's listing gate (which
// excludes avatar and requires a verified email) — this one rewards a filled
// profile, that one guards who may publish a listing.
export function isProfileComplete(u) {
  return Boolean(u?.name && u?.phone && u?.city && u?.avatarUrl)
}

export async function getUserById(id) {
  const user = await prisma.user.findUnique({ where: { id } })
  return user && stripPasswordHash(user)
}

// `city` is editable here but only to a SUPPORTED_CITIES value — the same
// gate signup applies. Users who signed up before city was required (or via
// social login edge cases) can fill it in from Settings; anything else
// (unsupported city, arbitrary text) is silently dropped, mirroring the
// listingVisibility/contactVisibility invalid-value pattern below.
const ALLOWED_FIELDS = [
  'name', 'phone', 'avatarUrl', 'bio', 'socialLinks', 'city',
  'listingVisibility', 'contactVisibility', 'showExactLocation',
  'emailNotifs', 'pushNotifs',
]

const VALID_LISTING_VISIBILITY = ['PUBLIC', 'LOGGED_IN', 'HIDDEN']
const VALID_CONTACT_VISIBILITY = ['EVERYONE', 'LOGGED_IN', 'NOBODY']

export async function updateUser(id, data) {
  const update = {}
  for (const key of ALLOWED_FIELDS) {
    if (data[key] !== undefined) update[key] = data[key]
  }
  if (update.listingVisibility && !VALID_LISTING_VISIBILITY.includes(update.listingVisibility)) {
    delete update.listingVisibility
  }
  if (update.contactVisibility && !VALID_CONTACT_VISIBILITY.includes(update.contactVisibility)) {
    delete update.contactVisibility
  }
  if (update.city !== undefined && !SUPPORTED_CITIES.includes(update.city)) {
    delete update.city
  }
  const user = await prisma.user.update({ where: { id }, data: update })
  // Fire-and-forget — idempotent via the ledger's unique (userId, action, '').
  if (isProfileComplete(user)) awardPoints(id, 'PROFILE_COMPLETED').catch(() => {})
  return stripPasswordHash(user)
}

export async function getSettings(id) {
  return prisma.user.findUnique({
    where: { id },
    select: {
      displayId: true, name: true, phone: true, avatarUrl: true, bio: true,
      socialLinks: true, email: true, role: true, isVerified: true, city: true,
      listingVisibility: true, contactVisibility: true, showExactLocation: true,
      emailNotifs: true, pushNotifs: true,
    },
  })
}

export async function changePassword(email) {
  await requestPasswordReset(email)
}

export async function deleteAccount(id) {
  await prisma.user.delete({ where: { id } })
  // All owned rows (properties, appointments, reviews, etc.) cascade-delete
  // via the existing onDelete: Cascade relations in schema.prisma.
}

// The renter's account screen, in one call. Each row carries a COUNT because a
// bare "Visits" row makes you open it to learn there is nothing there, and the
// counts are cheap to compute here and expensive to assemble on the client.
//
// Every count is of something the renter can act on:
//   confirmedVisits   a visit an owner has accepted — somewhere to be
//   activeLeases      a tenancy running right now
//   reviewableHomes   a place they have actually LIVED IN and not yet reviewed
export async function getAccountSummary(userId) {
  const [user, confirmedVisits, activeLeases, livedIn, reviewed, points] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { name: true, email: true, city: true, avatarUrl: true, role: true } }),
    prisma.appointment.count({ where: { tenantId: userId, status: { in: ['ACCEPTED', 'RESCHEDULED'] } } }),
    prisma.lease.count({ where: { tenantId: userId, status: 'ACTIVE' } }),
    // A lease that reached ACTIVE means they lived there; TERMINATED/EXPIRED
    // mean they have moved on and can speak from the whole tenancy. An OFFERED
    // lease is not a home they have seen the inside of.
    prisma.lease.findMany({
      where: { tenantId: userId, status: { in: ['ACTIVE', 'TERMINATED', 'EXPIRED'] } },
      select: { propertyId: true },
    }),
    prisma.communityReview.findMany({ where: { reviewerId: userId }, select: { propertyId: true } }),
    getPoints(userId),
  ])

  const reviewedIds = new Set(reviewed.map((r) => r.propertyId))
  const reviewableHomes = [...new Set(livedIn.map((l) => l.propertyId))].filter((id) => !reviewedIds.has(id)).length

  return {
    name: user?.name ?? null,
    email: user?.email ?? null,
    city: user?.city ?? null,
    avatarUrl: user?.avatarUrl ?? null,
    role: user?.role ?? 'TENANT',
    points,
    confirmedVisits,
    activeLeases,
    reviewableHomes,
  }
}
