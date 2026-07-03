// One-off admin account fixup. Usage:
//   ADMIN_EMAIL=you@example.com ADMIN_PASSWORD=<new password> node scripts/update-admin.js
// Never hardcode a real password here — this file is checked into git.
import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

const email    = process.env.ADMIN_EMAIL
const password = process.env.ADMIN_PASSWORD
if (!email || !password) {
  console.error('✗ ADMIN_EMAIL and ADMIN_PASSWORD must both be set in the environment')
  process.exit(1)
}

const hash = await bcrypt.hash(password, 12)

await prisma.admin.deleteMany({ where: { email: 'admin@stayonmap.com' } })
await prisma.admin.upsert({
  where:  { email },
  update: { passwordHash: hash, name: 'StayOnMap Admin' },
  create: { email, passwordHash: hash, name: 'StayOnMap Admin' },
})
console.log(`Done: updated admin account for ${email}`)
await prisma.$disconnect()
