import { prisma } from '../../lib/prisma.js'
import { requestPasswordReset, stripPasswordHash } from '../auth/auth.service.js'
import { awardPoints } from '../points/points.service.js'
import { SUPPORTED_CITIES } from '../../config/cities.js'

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
