// One-off admin account fixup. Usage:
//   ADMIN_EMAIL=you@example.com ADMIN_PASSWORD=<new password> node scripts/update-admin.js
// Never hardcode a real password here — this file is checked into git.
import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import bcrypt from 'bcryptjs'
import { ADMIN_MIN_PASSWORD_LENGTH } from '../src/features/admin/admin.validation.js'

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL })
const prisma = new PrismaClient({ adapter })

const email    = process.env.ADMIN_EMAIL
const password = process.env.ADMIN_PASSWORD
if (!email || !password) {
  console.error('✗ ADMIN_EMAIL and ADMIN_PASSWORD must both be set in the environment')
  process.exit(1)
}
// Same floor the API enforces — this script exists to rotate away from a weak
// password, so it must not be able to set another one.
if (password.length < ADMIN_MIN_PASSWORD_LENGTH) {
  console.error(`✗ ADMIN_PASSWORD must be at least ${ADMIN_MIN_PASSWORD_LENGTH} characters`)
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
