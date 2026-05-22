import { prisma } from '../../lib/prisma.js'
import { supabase } from '../../lib/supabase.js'

export async function getUserById(id) {
  return prisma.user.findUnique({ where: { id } })
}

const ALLOWED_FIELDS = [
  'name', 'phone', 'avatarUrl', 'bio', 'socialLinks',
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
  return prisma.user.update({ where: { id }, data: update })
}

export async function getSettings(id) {
  return prisma.user.findUnique({
    where: { id },
    select: {
      displayId: true, name: true, phone: true, avatarUrl: true, bio: true,
      socialLinks: true, email: true, role: true,
      listingVisibility: true, contactVisibility: true, showExactLocation: true,
      emailNotifs: true, pushNotifs: true,
    },
  })
}

export async function changePassword(email) {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${process.env.FRONTEND_URL}/reset-password`,
  })
  if (error) throw Object.assign(new Error('Failed to send reset email'), { statusCode: 500 })
}

export async function deleteAccount(id) {
  await prisma.user.delete({ where: { id } })
  const { error } = await supabase.auth.admin.deleteUser(id)
  if (error) {
    // Prisma record already deleted — log but don't throw, account is effectively removed
    console.error('Supabase deleteUser error (non-fatal):', error.message)
  }
}
