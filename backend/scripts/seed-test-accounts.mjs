#!/usr/bin/env node
// Seed two throwaway accounts so anyone can log in and play with the app
// without registering or touching a real user's data.
//
//   test1 — OWNER + Business tier — owns the demo listings below, so the owner
//           dashboard, listing manager, incoming appointments and inbox all
//           have real content the moment you log in.
//   test2 — TENANT — has already booked a viewing on one of test1's listings,
//           saved another, and started a chat thread, so the renter side is
//           populated too.
//
// Both share one password (printed at the end). Everything is idempotent —
// re-running never duplicates a user, listing, appointment or message — so it's
// safe to run as often as you like against a dev database.
//
// Run against whatever DATABASE_URL points to:
//   node scripts/seed-test-accounts.mjs                 # dev (reads .env)
//   DATABASE_URL="<public url>" node scripts/seed-test-accounts.mjs   # prod
//
// This writes directly (no dry-run) — the emails are namespaced to
// @stayonmap.test so they can never collide with a real signup, and
// scripts/cleanup-test-accounts.mjs removes exactly these rows again.
import 'dotenv/config'
import bcrypt from 'bcryptjs'
import { prisma } from '../src/lib/prisma.js'
import { encode } from '../src/lib/geohash.js'

// One shared password for both accounts. Satisfies the strongPassword policy
// (auth.validation.js): length ≥ 8, lower + upper + digit + special.
const TEST_PASSWORD = 'Test@1234'

const OWNER = { email: 'test1@stayonmap.test', name: 'Test One (Owner)', city: 'Bengaluru' }
const TENANT = { email: 'test2@stayonmap.test', name: 'Test Two (Renter)', city: 'Bengaluru' }

// One listing per category, so test1's dashboard demonstrates all six property
// types. Coordinates are real localities in supported cities — the spatial
// layer keys on a geohash-7 cell, so a made-up point lands in an empty cell and
// looks like a bug in the layer rather than a fixture choice.
const PROPERTIES = [
  {
    title: '[Demo] 2 BHK in Koramangala',
    description: 'Demo apartment for testing. Spacious 2BHK near Forum Mall with power backup and covered parking.',
    type: 'APARTMENT', furnished: 'SEMI', bhk: 2, bathrooms: 2,
    rent: 27000, deposit: 54000, maintenance: 1500, area: 1050,
    totalFloors: 6, floor: 3, facingDirection: 'EAST',
    address: '5th Block, Koramangala', city: 'Bengaluru', state: 'Karnataka', pincode: '560095',
    landmark: 'Near Forum Mall', lat: 12.9352, lng: 77.6245,
    amenityNames: ['WiFi', 'Parking', 'CCTV', 'Power Backup', 'Lift'],
    image: '4f46e5/Koramangala+2BHK',
  },
  {
    title: '[Demo] Independent house in Adyar',
    description: 'Demo independent house for testing. Quiet street, good water supply, small courtyard.',
    type: 'INDEPENDENT_HOUSE', houseStyle: 'Independent house', furnished: 'SEMI', bhk: 3, bathrooms: 2,
    rent: 32000, deposit: 96000, maintenance: 800, area: 1400,
    totalFloors: 1, floor: 1, facingDirection: 'NORTH',
    address: '3rd Main Road, Adyar', city: 'Chennai', state: 'Tamil Nadu', pincode: '600020',
    landmark: 'Near Adyar Bus Stand', lat: 13.0012, lng: 80.2565,
    amenityNames: ['Parking', 'Garden', 'Water Supply', 'Rainwater Harvesting'],
    image: '0f766e/Adyar+House',
  },
  {
    title: '[Demo] Co-living PG in Gachibowli',
    description: 'Demo PG for testing. Twin-sharing rooms with attached bath, meals included, near the IT corridor.',
    type: 'PG', furnished: 'FULLY', sharing: 2,
    rent: 12000, deposit: 24000, area: 160,
    totalBeds: 20, availableBeds: 6, noticePeriodDays: 30,
    totalFloors: 4, floor: 2,
    address: 'Financial District, Gachibowli', city: 'Hyderabad', state: 'Telangana', pincode: '500032',
    landmark: 'Near DLF Cyber City', lat: 17.4400, lng: 78.3489,
    amenityNames: ['WiFi', 'AC', 'CCTV', 'Housekeeping', 'Power Backup'],
    image: '7c3aed/Gachibowli+PG',
    rules: { genderPreference: 'ANY' },
  },
  {
    title: '[Demo] Retail shop on Linking Road',
    description: 'Demo commercial unit for testing. Ground-floor shopfront on Linking Road with heavy footfall.',
    type: 'COMMERCIAL', furnished: 'UNFURNISHED',
    rent: 180000, deposit: 1080000, maintenance: 8000, area: 600,
    commercialType: 'Retail shop', carpetArea: 500, frontage: 18, powerLoad: '15 kW',
    totalFloors: 4, floor: 0,
    address: 'Linking Road, Bandra West', city: 'Mumbai', state: 'Maharashtra', pincode: '400050',
    landmark: 'Near Bandra Talao', lat: 19.0596, lng: 72.8295,
    amenityNames: ['CCTV', 'Washroom', 'Fire Safety', 'Near Main Road'],
    image: '7c2d12/Linking+Road+Shop',
  },
  {
    title: '[Demo] Residential plot in Baner',
    description: 'Demo land listing for testing. North-facing corner plot, clear title, compound wall built.',
    type: 'LAND', furnished: 'UNFURNISHED',
    // For LAND the wizard labels `rent` "Total price" — not a monthly figure.
    rent: 9500000, deposit: 500000, area: 2400,
    landType: 'Residential', extent: 2400, extentUnit: 'sq.ft', dimensions: '40 x 60 ft',
    roadWidth: 40, approvalStatus: 'RERA', saleOrLease: 'SALE',
    address: 'Baner Road, Baner', city: 'Pune', state: 'Maharashtra', pincode: '411045',
    landmark: 'Near Balewadi High Street', lat: 18.5590, lng: 73.7868,
    amenityNames: ['Corner Plot', 'Boundary Wall', 'Water Supply', 'Near Main Road'],
    image: '365314/Baner+Plot',
  },
  {
    title: '[Demo] Studio near Powai Lake',
    description: 'Demo short-stay for testing. Lake-facing studio set up for a working stay — desk, fast WiFi, kitchenette.',
    type: 'SHORT_STAY', furnished: 'FULLY', bhk: 1, bathrooms: 1,
    rent: 4200, nightlyRate: 4200, weekendRate: 5400, cleaningFee: 900,
    placeType: 'Entire place', maxGuests: 3, beds: 2, minNights: 2, maxNights: 45, instantBook: true,
    deposit: 0, area: 480, totalFloors: 14, floor: 9,
    address: 'Hiranandani Gardens, Powai', city: 'Mumbai', state: 'Maharashtra', pincode: '400076',
    landmark: 'Near Powai Lake', lat: 19.1176, lng: 72.9060,
    amenityNames: ['WiFi', 'AC', 'TV', 'Workspace', 'Kitchen', 'Housekeeping'],
    image: '0c4a6e/Powai+Studio',
  },
]

async function upsertUser({ email, name, city }, { role, isBusiness }) {
  const passwordHash = await bcrypt.hash(TEST_PASSWORD, 12)
  return prisma.user.upsert({
    where: { email },
    // Reset role/business/verified on every run so a re-seed restores a known
    // state even if the account was edited while testing. Password is only set
    // on create — never clobber a password someone changed on a live account.
    update: { name, city, role, isBusiness, isVerified: true },
    create: {
      email, name, city, role, isBusiness, isVerified: true, passwordHash,
      ...(isBusiness && { businessSince: new Date() }),
    },
  })
}

async function seedProperties(ownerId, amenityMap) {
  const created = []
  for (const prop of PROPERTIES) {
    const existing = await prisma.property.findFirst({ where: { title: prop.title, ownerId } })
    if (existing) { created.push(existing); continue }

    const { amenityNames, image, rules, ...rest } = prop
    const property = await prisma.property.create({
      data: {
        ...rest,
        status: 'ACTIVE',
        ownerId,
        geohash: encode(Number(prop.lat), Number(prop.lng)),
        availableFrom: new Date(),
        images: {
          create: [{ url: `https://placehold.co/800x600/${image}`, isPrimary: true, order: 0 }],
        },
        amenities: {
          create: amenityNames.filter((n) => amenityMap[n]).map((n) => ({ amenityId: amenityMap[n] })),
        },
        ...(rules && { rules: { create: rules } }),
        trustScore: {
          create: {
            overallScore: 3.8, safetyScore: 4.0, cleanlinessScore: 3.9,
            neighborhoodScore: 3.7, totalReviews: 0, recommendPercent: 0,
          },
        },
        riskScore: { create: { score: 5, level: 'LOW' } },
      },
    })
    created.push(property)
  }
  return created
}

// Cross-user interactions so both sides of the app have content: an incoming
// appointment, a chat thread, and a saved listing — all from test2 onto test1's
// listings. Each is idempotent via its natural unique key.
async function seedInteractions(owner, tenant, properties) {
  const [apartment, house, , , , studio] = properties

  // A pending viewing request test1 sees as "incoming" and test2 as "outgoing".
  const requestedDate = new Date()
  requestedDate.setDate(requestedDate.getDate() + 3)
  await prisma.appointment.upsert({
    where: { tenantId_propertyId_status: { tenantId: tenant.id, propertyId: apartment.id, status: 'PENDING' } },
    update: {},
    create: {
      propertyId: apartment.id, tenantId: tenant.id, ownerId: owner.id,
      requestedDate, requestedTime: '11:00', contactNumber: '9876500002',
      message: 'Hi, I would like to see this flat this weekend.', status: 'PENDING',
    },
  })

  // A chat thread with a couple of messages, seeded only when new so re-runs
  // don't stack duplicate messages.
  const conversation = await prisma.conversation.upsert({
    where: { propertyId_tenantId: { propertyId: house.id, tenantId: tenant.id } },
    update: {},
    create: { propertyId: house.id, tenantId: tenant.id, ownerId: owner.id },
  })
  const messageCount = await prisma.message.count({ where: { conversationId: conversation.id } })
  if (messageCount === 0) {
    await prisma.message.createMany({
      data: [
        { conversationId: conversation.id, senderId: tenant.id, body: 'Hello! Is this house still available?', isRead: true },
        { conversationId: conversation.id, senderId: owner.id, body: 'Yes it is. When would you like to visit?', isRead: false },
      ],
    })
    await prisma.conversation.update({ where: { id: conversation.id }, data: { lastMessageAt: new Date() } })
  }

  // test2 has the studio in their wishlist.
  await prisma.savedListing.upsert({
    where: { userId_propertyId: { userId: tenant.id, propertyId: studio.id } },
    update: {},
    create: { userId: tenant.id, propertyId: studio.id },
  })
}

async function main() {
  const owner = await upsertUser(OWNER, { role: 'OWNER', isBusiness: true })
  const tenant = await upsertUser(TENANT, { role: 'TENANT', isBusiness: false })
  console.log(`✓ ${owner.email} (OWNER, Business tier)`)
  console.log(`✓ ${tenant.email} (TENANT)`)

  const amenityMap = {}
  for (const a of await prisma.amenity.findMany()) amenityMap[a.name] = a.id
  if (Object.keys(amenityMap).length === 0) {
    console.warn('⚠ No amenities in the DB — run `npx prisma db seed` (or scripts/seed-amenities.mjs) first; listings will have no amenities.')
  }

  const properties = await seedProperties(owner.id, amenityMap)
  console.log(`✓ ${properties.length} demo listings owned by ${owner.email} (one per property type)`)

  await seedInteractions(owner, tenant, properties)
  console.log('✓ Seeded 1 appointment, 1 chat thread, 1 saved listing (test2 → test1)')

  console.log('\n─── Log in with ───────────────────────────────')
  console.log(`  Owner  : ${OWNER.email}   /  ${TEST_PASSWORD}`)
  console.log(`  Renter : ${TENANT.email}   /  ${TEST_PASSWORD}`)
  console.log('───────────────────────────────────────────────')
}

main()
  .catch((err) => { console.error(err); process.exitCode = 1 })
  .finally(() => prisma.$disconnect())
