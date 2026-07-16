// Backfill missing Amenity rows — amenities only, nothing else.
// Safe to run against production (idempotent upserts, no deletes); unlike
// prisma/seed.js it needs no ADMIN_SEED_* env vars and creates no sample data.
// Run: node scripts/seed-amenities.mjs   (from backend/, e.g. via `railway run`)

import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { AMENITIES } from '../prisma/amenities.js'

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL })
const prisma = new PrismaClient({ adapter })

const before = await prisma.amenity.count()
for (const name of AMENITIES) {
  await prisma.amenity.upsert({ where: { name }, update: {}, create: { name } })
}
const after = await prisma.amenity.count()

console.log(`Amenities: ${before} before, ${after} after (${after - before} added, ${AMENITIES.length} canonical)`)
await prisma.$disconnect()
