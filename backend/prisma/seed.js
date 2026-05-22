// Seed: amenities + admin account + sample data
// Run: npx prisma db seed

import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

const AMENITIES = [
  'WiFi', 'Parking', 'CCTV', 'AC', 'Lift', 'Gym', 'Power Backup',
  'Kitchen', 'Washing Machine', 'Pet Friendly', 'Furnished', 'Security Guard',
  'Swimming Pool', 'Club House', 'Play Area', 'Garden', 'Intercom',
  'Solar Water Heater', 'Rainwater Harvesting', 'Gas Pipeline', 'Gated Security',
]

async function main() {
  // Seed amenities
  for (const name of AMENITIES) {
    await prisma.amenity.upsert({ where: { name }, update: {}, create: { name } })
  }
  console.log(`Seeded ${AMENITIES.length} amenities`)

  // Seed admin account
  const adminEmail = process.env.ADMIN_SEED_EMAIL ?? 'srigokulkrishnan@gmail.com'
  const adminPassword = process.env.ADMIN_SEED_PASSWORD ?? 'sgokulk@1234'
  const passwordHash = await bcrypt.hash(adminPassword, 12)

  await prisma.admin.upsert({
    where: { email: adminEmail },
    update: {},
    create: { email: adminEmail, passwordHash, name: 'StayOnMap Admin' },
  })
  console.log(`Admin account: ${adminEmail} / ${adminPassword}`)

  // Sample user (for dev only)
  const owner = await prisma.user.upsert({
    where: { email: 'owner@example.com' },
    update: {},
    create: { id: 'seed-owner-001', email: 'owner@example.com', name: 'Ravi Kumar', role: 'OWNER' },
  })

  // Sample property using new schema
  const amenity = await prisma.amenity.findFirst({ where: { name: 'WiFi' } })
  const existing = await prisma.property.findFirst({ where: { ownerId: owner.id } })

  if (!existing) {
    await prisma.property.create({
      data: {
        title: '2BHK Apartment in Koramangala',
        description: 'Spacious 2BHK in the heart of Koramangala with all modern amenities.',
        type: 'APARTMENT',
        furnished: 'SEMI',
        status: 'ACTIVE',
        bhk: 2,
        rent: 28000,
        deposit: 56000,
        maintenance: 1500,
        area: 1100,
        totalFloors: 4,
        facingDirection: 'EAST',
        address: '5th Cross, Koramangala',
        city: 'Bengaluru',
        state: 'Karnataka',
        pincode: '560034',
        lat: 12.9352,
        lng: 77.6245,
        ownerId: owner.id,
        images: {
          create: [{ url: 'https://placehold.co/800x600', isPrimary: true, order: 0 }],
        },
        amenities: amenity
          ? { create: [{ amenityId: amenity.id }] }
          : undefined,
      },
    })
    console.log('Sample property created')
  }

  console.log('Seed complete')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
