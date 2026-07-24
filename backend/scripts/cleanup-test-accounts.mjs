#!/usr/bin/env node
// Removes the two throwaway accounts created by scripts/seed-test-accounts.mjs
// and everything cascading from them (listings, appointments, conversations,
// messages, saved listings, scores — all onDelete: Cascade in schema.prisma).
//
// Dry run (default): prints what would be deleted, deletes nothing.
//   node scripts/cleanup-test-accounts.mjs
// Actually delete:
//   node scripts/cleanup-test-accounts.mjs --confirm
import 'dotenv/config'
import { prisma } from '../src/lib/prisma.js'

const confirm = process.argv.includes('--confirm')

const TEST_EMAILS = ['test1@stayonmap.test', 'test2@stayonmap.test']

const users = await prisma.user.findMany({
  where: { email: { in: TEST_EMAILS } },
  select: { id: true, email: true, role: true, _count: { select: { properties: true } } },
})

if (users.length === 0) {
  console.log('No test accounts found — nothing to do (already cleaned up?)')
  await prisma.$disconnect()
  process.exit(0)
}

console.log('Would delete:')
users.forEach((u) => console.log(`  User ${u.email} (${u.role}) — ${u._count.properties} listing(s) + all appointments, chats, saves via cascade`))

if (!confirm) {
  console.log('\nDry run only — rerun with --confirm to actually delete.')
  await prisma.$disconnect()
  process.exit(0)
}

await prisma.user.deleteMany({ where: { id: { in: users.map((u) => u.id) } } })
console.log(`\nDone: deleted ${users.length} account(s) and everything cascading from them.`)
await prisma.$disconnect()
