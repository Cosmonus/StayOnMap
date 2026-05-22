import { prisma } from '../../lib/prisma.js'
import { generateUserDisplayId } from '../../utils/idGenerator.js'

export async function syncOrCreateUser(supabaseUser, body) {
  const name = body.name ?? supabaseUser.user_metadata?.name
  const update = { email: supabaseUser.email }
  if (name) update.name = name

  return prisma.user.upsert({
    where: { id: supabaseUser.id },
    create: {
      id: supabaseUser.id,
      displayId: generateUserDisplayId(name, supabaseUser.email),
      email: supabaseUser.email,
      name: name ?? '',
      role: body.role ?? 'TENANT',
    },
    update,
  })
}

export async function getUserById(id) {
  const user = await prisma.user.findUnique({ where: { id } })
  if (!user) return null

  // Auto-upgrade: if role is TENANT but they own properties, fix the inconsistency
  if (user.role === 'TENANT') {
    const hasListings = await prisma.property.count({ where: { ownerId: id } })
    if (hasListings > 0) {
      return prisma.user.update({ where: { id }, data: { role: 'OWNER' } })
    }
  }

  return user
}

export async function updateUserRole(id, role) {
  if (role !== 'OWNER') throw Object.assign(new Error('Can only upgrade to OWNER'), { statusCode: 400 })
  const user = await prisma.user.findUnique({ where: { id }, select: { role: true } })
  if (!user) throw Object.assign(new Error('User not found'), { statusCode: 404 })
  if (user.role === 'OWNER') throw Object.assign(new Error('Already an owner'), { statusCode: 400 })
  return prisma.user.update({ where: { id }, data: { role: 'OWNER' } })
}
