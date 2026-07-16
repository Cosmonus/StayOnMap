// Removes the synthetic test records left in production by the 2026-07-03
// manual testing pass (see todo.md). Scoped tightly to those exact known
// records — nothing else matches these filters.
//
// Dry run (default): prints what would be deleted, deletes nothing.
//   node scripts/cleanup-test-data.js
// Actually delete:
//   node scripts/cleanup-test-data.js --confirm
//
// Deleting the two test Users cascades (onDelete: Cascade in schema.prisma)
// through their property, appointment, conversation, messages, trust/risk
// scores, notifications — no need to touch those tables directly.
import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL })
const prisma = new PrismaClient({ adapter })
const confirm = process.argv.includes('--confirm')

const TEST_EMAILS = [
  'claude-test-verify-20260703@example.com',
  'claude-test-owner-20260703@example.com',
]
const TEST_PROPERTY_TITLE = 'Claude Test Property Verification'

const users = await prisma.user.findMany({
  where: { email: { in: TEST_EMAILS } },
  select: { id: true, email: true, role: true },
})

if (users.length === 0) {
  console.log('No matching test users found — nothing to do (already cleaned up?)')
  await prisma.$disconnect()
  process.exit(0)
}

const properties = await prisma.property.findMany({
  where: { title: TEST_PROPERTY_TITLE, ownerId: { in: users.map((u) => u.id) } },
  select: { id: true, title: true, city: true },
})

console.log('Would delete:')
users.forEach((u) => console.log(`  User   ${u.email} (${u.role}, id=${u.id})`))
properties.forEach((p) => console.log(`  Property "${p.title}" (${p.city}, id=${p.id}) — plus its appointments, conversation, messages, scores via cascade`))

if (!confirm) {
  console.log('\nDry run only — rerun with --confirm to actually delete.')
  await prisma.$disconnect()
  process.exit(0)
}

await prisma.user.deleteMany({ where: { id: { in: users.map((u) => u.id) } } })
console.log(`\nDone: deleted ${users.length} user(s) and everything cascading from them.`)
await prisma.$disconnect()
