// Seed: amenities + admin account + sample properties across India
// Run: npx prisma db seed

import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

// ─── Amenities ────────────────────────────────────────────────────
const AMENITIES = [
  'WiFi', 'Parking', 'CCTV', 'AC', 'Lift', 'Gym', 'Power Backup',
  'Kitchen', 'Washing Machine', 'Pet Friendly', 'Furnished', 'Security Guard',
  'Swimming Pool', 'Club House', 'Play Area', 'Garden', 'Intercom',
  'Solar Water Heater', 'Rainwater Harvesting', 'Gas Pipeline', 'Gated Security',
]

// ─── Sample Properties ────────────────────────────────────────────
// 15 properties across 6 cities — all ACTIVE so they appear on the map
const PROPERTIES = [
  // ── Bengaluru ──────────────────────────────────────────────────
  {
    title: '2 BHK in Koramangala',
    description: 'Spacious 2BHK flat in the heart of Koramangala. Walking distance to cafes, restaurants, and tech parks. West-facing with excellent cross-ventilation. Building has 24/7 security and power backup.',
    type: 'APARTMENT', furnished: 'SEMI', bhk: 2,
    rent: 28000, deposit: 56000, maintenance: 1500, area: 1100,
    totalFloors: 6, floor: 3, facingDirection: 'WEST',
    address: '5th Cross, Koramangala 5th Block', city: 'Bengaluru', state: 'Karnataka', pincode: '560095',
    landmark: 'Near Forum Mall',
    lat: 12.9352, lng: 77.6245,
    amenityNames: ['WiFi', 'Parking', 'CCTV', 'Power Backup', 'Security Guard'],
    images: [
      { url: 'https://placehold.co/800x600/4f46e5/ffffff?text=Koramangala+2BHK', isPrimary: true, order: 0 },
      { url: 'https://placehold.co/800x600/6366f1/ffffff?text=Living+Room', isPrimary: false, order: 1 },
      { url: 'https://placehold.co/800x600/818cf8/ffffff?text=Bedroom', isPrimary: false, order: 2 },
    ],
    rules: { smokingAllowed: false, petsAllowed: false, bachelorAllowed: true, visitorsAllowed: true, nonVegAllowed: true, genderPreference: 'ANY' },
  },
  {
    title: '3 BHK Villa in Indiranagar',
    description: 'Independent 3BHK villa with a private garden. Premium locality, walking distance to 100 Feet Road and metro. Recently renovated with modular kitchen and wooden flooring throughout.',
    type: 'VILLA', furnished: 'FULLY', bhk: 3,
    rent: 65000, deposit: 195000, maintenance: 3000, area: 2200,
    totalFloors: 2, floor: 1, facingDirection: 'EAST',
    address: '12th Main, Indiranagar', city: 'Bengaluru', state: 'Karnataka', pincode: '560038',
    landmark: 'Near Indiranagar Metro',
    lat: 12.9784, lng: 77.6408,
    amenityNames: ['WiFi', 'Parking', 'Garden', 'AC', 'Washing Machine', 'CCTV'],
    images: [
      { url: 'https://placehold.co/800x600/0f766e/ffffff?text=Indiranagar+Villa', isPrimary: true, order: 0 },
      { url: 'https://placehold.co/800x600/0d9488/ffffff?text=Garden+View', isPrimary: false, order: 1 },
    ],
    rules: { smokingAllowed: false, petsAllowed: true, bachelorAllowed: false, familyPreferred: true, visitorsAllowed: true, nonVegAllowed: true, genderPreference: 'ANY' },
  },
  {
    title: '1 BHK in HSR Layout',
    description: 'Cozy 1BHK in a quiet residential area of HSR Layout. Ideal for working professionals. Close to Agara Lake, restaurants and supermarkets. Society with gym and swimming pool.',
    type: 'APARTMENT', furnished: 'FULLY', bhk: 1,
    rent: 18000, deposit: 36000, maintenance: 1000, area: 650,
    totalFloors: 5, floor: 2, facingDirection: 'NORTH',
    address: 'Sector 2, HSR Layout', city: 'Bengaluru', state: 'Karnataka', pincode: '560102',
    landmark: 'Near Agara Lake',
    lat: 12.9116, lng: 77.6389,
    amenityNames: ['WiFi', 'Gym', 'Swimming Pool', 'Lift', 'AC', 'Power Backup'],
    images: [
      { url: 'https://placehold.co/800x600/1d4ed8/ffffff?text=HSR+1BHK', isPrimary: true, order: 0 },
      { url: 'https://placehold.co/800x600/2563eb/ffffff?text=Kitchen', isPrimary: false, order: 1 },
    ],
    rules: { smokingAllowed: false, petsAllowed: false, bachelorAllowed: true, visitorsAllowed: true, nonVegAllowed: true, genderPreference: 'ANY' },
  },
  {
    title: 'PG for Girls in Marathahalli',
    description: 'Well-maintained girls PG with homely meals included. Attached bathrooms, AC rooms, high-speed WiFi. 5 minutes from Outer Ring Road IT corridor. Biometric entry, CCTV throughout.',
    type: 'PG', furnished: 'FULLY', sharing: 2,
    rent: 9500, deposit: 9500, maintenance: 0, area: 0,
    totalFloors: 3, floor: 1, facingDirection: 'SOUTH',
    address: 'Marathahalli Bridge Road', city: 'Bengaluru', state: 'Karnataka', pincode: '560037',
    landmark: 'Near Marathahalli Bridge',
    lat: 12.9592, lng: 77.6974,
    amenityNames: ['WiFi', 'AC', 'CCTV', 'Security Guard', 'Kitchen', 'Power Backup'],
    images: [
      { url: 'https://placehold.co/800x600/7c3aed/ffffff?text=Girls+PG+Marathahalli', isPrimary: true, order: 0 },
      { url: 'https://placehold.co/800x600/8b5cf6/ffffff?text=Room', isPrimary: false, order: 1 },
    ],
    rules: { smokingAllowed: false, petsAllowed: false, bachelorAllowed: false, visitorsAllowed: false, curfewTime: '22:00', genderPreference: 'FEMALE' },
  },

  // ── Mumbai ─────────────────────────────────────────────────────
  {
    title: '2 BHK Sea-View Flat in Bandra West',
    description: 'Premium 2BHK with partial sea view on Carter Road. Fully furnished with high-end interiors. Building has concierge, gymnasium and rooftop terrace. 5-minute walk to Bandstand.',
    type: 'APARTMENT', furnished: 'FULLY', bhk: 2,
    rent: 85000, deposit: 255000, maintenance: 5000, area: 950,
    totalFloors: 18, floor: 12, facingDirection: 'WEST',
    address: 'Carter Road, Bandra West', city: 'Mumbai', state: 'Maharashtra', pincode: '400050',
    landmark: 'Near Bandstand Promenade',
    lat: 19.0596, lng: 72.8295,
    amenityNames: ['WiFi', 'Parking', 'Gym', 'CCTV', 'Lift', 'AC', 'Security Guard', 'Swimming Pool'],
    images: [
      { url: 'https://placehold.co/800x600/0369a1/ffffff?text=Bandra+Sea+View', isPrimary: true, order: 0 },
      { url: 'https://placehold.co/800x600/0284c7/ffffff?text=Living+Room', isPrimary: false, order: 1 },
      { url: 'https://placehold.co/800x600/0ea5e9/ffffff?text=Balcony+View', isPrimary: false, order: 2 },
    ],
    rules: { smokingAllowed: false, petsAllowed: true, bachelorAllowed: true, visitorsAllowed: true, nonVegAllowed: true, genderPreference: 'ANY' },
  },
  {
    title: '1 BHK in Powai near Hiranandani',
    description: 'Well-maintained 1BHK in a gated society near Hiranandani. Access to club house, pool and landscaped gardens. Close to Powai Lake and multiple MNCs. Excellent connectivity via JVLR.',
    type: 'APARTMENT', furnished: 'SEMI', bhk: 1,
    rent: 35000, deposit: 70000, maintenance: 2500, area: 720,
    totalFloors: 14, floor: 7, facingDirection: 'EAST',
    address: 'Hiranandani Gardens, Powai', city: 'Mumbai', state: 'Maharashtra', pincode: '400076',
    landmark: 'Near Powai Lake',
    lat: 19.1176, lng: 72.9060,
    amenityNames: ['WiFi', 'Parking', 'Gym', 'Swimming Pool', 'Club House', 'Lift', 'CCTV', 'Gated Security'],
    images: [
      { url: 'https://placehold.co/800x600/065f46/ffffff?text=Powai+1BHK', isPrimary: true, order: 0 },
      { url: 'https://placehold.co/800x600/047857/ffffff?text=Society+View', isPrimary: false, order: 1 },
    ],
    rules: { smokingAllowed: false, petsAllowed: false, bachelorAllowed: true, visitorsAllowed: true, nonVegAllowed: true, genderPreference: 'ANY' },
  },
  {
    title: '2 BHK in Andheri East',
    description: 'Spacious 2BHK near Andheri metro station. Easy access to BKC and airport. Society with jogging track and kids play area. Both bedrooms with attached bathrooms.',
    type: 'APARTMENT', furnished: 'UNFURNISHED', bhk: 2,
    rent: 42000, deposit: 84000, maintenance: 2000, area: 1050,
    totalFloors: 10, floor: 5, facingDirection: 'NORTH',
    address: 'Marol Naka, Andheri East', city: 'Mumbai', state: 'Maharashtra', pincode: '400059',
    landmark: 'Near Andheri Metro',
    lat: 19.1136, lng: 72.8697,
    amenityNames: ['Parking', 'Lift', 'CCTV', 'Power Backup', 'Play Area', 'Security Guard'],
    images: [
      { url: 'https://placehold.co/800x600/92400e/ffffff?text=Andheri+2BHK', isPrimary: true, order: 0 },
      { url: 'https://placehold.co/800x600/b45309/ffffff?text=Master+Bedroom', isPrimary: false, order: 1 },
    ],
    rules: { smokingAllowed: false, petsAllowed: false, bachelorAllowed: true, familyPreferred: false, visitorsAllowed: true, nonVegAllowed: true, genderPreference: 'ANY' },
  },

  // ── Hyderabad ──────────────────────────────────────────────────
  {
    title: '3 BHK in Gachibowli IT Hub',
    description: 'Modern 3BHK apartment in a premium gated society, steps from the IT corridor. Fully furnished with AC in all rooms, modular kitchen and premium fixtures. Daily housekeeping available.',
    type: 'APARTMENT', furnished: 'FULLY', bhk: 3,
    rent: 40000, deposit: 120000, maintenance: 3000, area: 1650,
    totalFloors: 20, floor: 15, facingDirection: 'EAST',
    address: 'Financial District, Gachibowli', city: 'Hyderabad', state: 'Telangana', pincode: '500032',
    landmark: 'Near DLF Cyber City',
    lat: 17.4400, lng: 78.3489,
    amenityNames: ['WiFi', 'Parking', 'Gym', 'Swimming Pool', 'AC', 'Lift', 'CCTV', 'Power Backup', 'Club House', 'Gated Security'],
    images: [
      { url: 'https://placehold.co/800x600/1e1b4b/ffffff?text=Gachibowli+3BHK', isPrimary: true, order: 0 },
      { url: 'https://placehold.co/800x600/312e81/ffffff?text=City+View', isPrimary: false, order: 1 },
      { url: 'https://placehold.co/800x600/3730a3/ffffff?text=Kitchen', isPrimary: false, order: 2 },
    ],
    rules: { smokingAllowed: false, petsAllowed: true, bachelorAllowed: true, visitorsAllowed: true, nonVegAllowed: true, genderPreference: 'ANY' },
  },
  {
    title: '2 BHK in Hitech City',
    description: 'Well-connected 2BHK near Hitech City metro. Society amenities include pool, gym and badminton court. Property is semi-furnished with wardrobes and modular kitchen. Quiet floor.',
    type: 'APARTMENT', furnished: 'SEMI', bhk: 2,
    rent: 25000, deposit: 50000, maintenance: 1800, area: 1080,
    totalFloors: 8, floor: 4, facingDirection: 'WEST',
    address: 'Madhapur, Hitech City', city: 'Hyderabad', state: 'Telangana', pincode: '500081',
    landmark: 'Near Hitech City Metro',
    lat: 17.4474, lng: 78.3762,
    amenityNames: ['WiFi', 'Parking', 'Gym', 'Swimming Pool', 'Lift', 'CCTV'],
    images: [
      { url: 'https://placehold.co/800x600/166534/ffffff?text=Hitech+City+2BHK', isPrimary: true, order: 0 },
      { url: 'https://placehold.co/800x600/15803d/ffffff?text=Bedroom', isPrimary: false, order: 1 },
    ],
    rules: { smokingAllowed: false, petsAllowed: false, bachelorAllowed: true, visitorsAllowed: true, nonVegAllowed: true, genderPreference: 'ANY' },
  },

  // ── Chennai ────────────────────────────────────────────────────
  {
    title: '2 BHK Independent House in Adyar',
    description: 'Charming independent 2BHK house with a small courtyard in one of Chennai\'s most sought-after localities. Quiet street, excellent water supply, close to Adyar River and Beach.',
    type: 'INDEPENDENT_HOUSE', furnished: 'SEMI', bhk: 2,
    rent: 22000, deposit: 66000, maintenance: 800, area: 1200,
    totalFloors: 1, floor: 1, facingDirection: 'EAST',
    address: '3rd Main Road, Adyar', city: 'Chennai', state: 'Tamil Nadu', pincode: '600020',
    landmark: 'Near Adyar Bus Stand',
    lat: 13.0012, lng: 80.2565,
    amenityNames: ['Parking', 'Garden', 'Gas Pipeline', 'Rainwater Harvesting'],
    images: [
      { url: 'https://placehold.co/800x600/9f1239/ffffff?text=Adyar+House', isPrimary: true, order: 0 },
      { url: 'https://placehold.co/800x600/be123c/ffffff?text=Courtyard', isPrimary: false, order: 1 },
    ],
    rules: { smokingAllowed: false, petsAllowed: true, bachelorAllowed: false, familyPreferred: true, visitorsAllowed: true, nonVegAllowed: false, genderPreference: 'ANY' },
  },
  {
    title: '3 BHK in Anna Nagar',
    description: 'Spacious 3BHK flat in the well-planned Anna Nagar grid. Corner unit with excellent natural light. Recently repainted with new plumbing. Close to Anna Nagar Tower park and metro.',
    type: 'APARTMENT', furnished: 'UNFURNISHED', bhk: 3,
    rent: 30000, deposit: 90000, maintenance: 1500, area: 1450,
    totalFloors: 7, floor: 6, facingDirection: 'NORTH',
    address: '4th Avenue, Anna Nagar West', city: 'Chennai', state: 'Tamil Nadu', pincode: '600040',
    landmark: 'Near Anna Nagar Tower',
    lat: 13.0863, lng: 80.2102,
    amenityNames: ['Parking', 'Lift', 'Power Backup', 'CCTV', 'Security Guard'],
    images: [
      { url: 'https://placehold.co/800x600/134e4a/ffffff?text=Anna+Nagar+3BHK', isPrimary: true, order: 0 },
      { url: 'https://placehold.co/800x600/0f766e/ffffff?text=Living+Room', isPrimary: false, order: 1 },
    ],
    rules: { smokingAllowed: false, petsAllowed: false, bachelorAllowed: false, familyPreferred: true, visitorsAllowed: true, nonVegAllowed: false, genderPreference: 'ANY' },
  },

  // ── Pune ───────────────────────────────────────────────────────
  {
    title: '2 BHK in Baner',
    description: 'Modern 2BHK in a sought-after Baner society. Facing the hills with a great view. Society has a swimming pool, gym, and children\'s play area. Close to Balewadi Stadium and IT parks.',
    type: 'APARTMENT', furnished: 'SEMI', bhk: 2,
    rent: 23000, deposit: 46000, maintenance: 1500, area: 1000,
    totalFloors: 12, floor: 8, facingDirection: 'WEST',
    address: 'Baner-Pashan Link Road', city: 'Pune', state: 'Maharashtra', pincode: '411045',
    landmark: 'Near Balewadi High Street',
    lat: 18.5590, lng: 73.7868,
    amenityNames: ['WiFi', 'Parking', 'Gym', 'Swimming Pool', 'Lift', 'CCTV', 'Play Area', 'Power Backup'],
    images: [
      { url: 'https://placehold.co/800x600/3b0764/ffffff?text=Baner+2BHK', isPrimary: true, order: 0 },
      { url: 'https://placehold.co/800x600/6b21a8/ffffff?text=Hills+View', isPrimary: false, order: 1 },
      { url: 'https://placehold.co/800x600/7e22ce/ffffff?text=Pool', isPrimary: false, order: 2 },
    ],
    rules: { smokingAllowed: false, petsAllowed: false, bachelorAllowed: true, visitorsAllowed: true, nonVegAllowed: true, genderPreference: 'ANY' },
  },
  {
    title: '1 BHK in Kothrud',
    description: 'Compact and clean 1BHK in established Kothrud locality. Perfect for a couple or single professional. Reliable water supply, 24/7 watchman. Close to Kothrud bus depot and market.',
    type: 'APARTMENT', furnished: 'FULLY', bhk: 1,
    rent: 15000, deposit: 30000, maintenance: 800, area: 600,
    totalFloors: 5, floor: 3, facingDirection: 'SOUTH',
    address: 'Dahanukar Colony, Kothrud', city: 'Pune', state: 'Maharashtra', pincode: '411029',
    landmark: 'Near Kothrud Bus Depot',
    lat: 18.5074, lng: 73.8077,
    amenityNames: ['Parking', 'Power Backup', 'CCTV', 'Security Guard', 'Kitchen'],
    images: [
      { url: 'https://placehold.co/800x600/1e3a5f/ffffff?text=Kothrud+1BHK', isPrimary: true, order: 0 },
      { url: 'https://placehold.co/800x600/1e40af/ffffff?text=Bedroom', isPrimary: false, order: 1 },
    ],
    rules: { smokingAllowed: false, petsAllowed: false, bachelorAllowed: true, visitorsAllowed: true, nonVegAllowed: true, genderPreference: 'ANY' },
  },

  // ── Delhi NCR ──────────────────────────────────────────────────
  {
    title: '3 BHK in Lajpat Nagar',
    description: 'Spacious 3BHK in South Delhi\'s vibrant Lajpat Nagar. Fully air-conditioned, modular kitchen, two covered parking spots. Well-connected by metro (Lajpat Nagar station). Great market access.',
    type: 'APARTMENT', furnished: 'FULLY', bhk: 3,
    rent: 55000, deposit: 165000, maintenance: 4000, area: 1800,
    totalFloors: 5, floor: 4, facingDirection: 'NORTH',
    address: 'Central Market, Lajpat Nagar 2', city: 'Delhi', state: 'Delhi', pincode: '110024',
    landmark: 'Near Lajpat Nagar Metro',
    lat: 28.5706, lng: 77.2387,
    amenityNames: ['WiFi', 'Parking', 'AC', 'Lift', 'CCTV', 'Power Backup', 'Security Guard', 'Intercom'],
    images: [
      { url: 'https://placehold.co/800x600/78350f/ffffff?text=Lajpat+Nagar+3BHK', isPrimary: true, order: 0 },
      { url: 'https://placehold.co/800x600/92400e/ffffff?text=Living+Room', isPrimary: false, order: 1 },
      { url: 'https://placehold.co/800x600/b45309/ffffff?text=Kitchen', isPrimary: false, order: 2 },
    ],
    rules: { smokingAllowed: false, petsAllowed: false, bachelorAllowed: false, familyPreferred: true, visitorsAllowed: true, nonVegAllowed: true, genderPreference: 'ANY' },
  },
  {
    title: '2 BHK in Dwarka Sector 10',
    description: 'Well-maintained 2BHK in Dwarka\'s planned sector 10. Society with 24/7 water supply, power backup and children park. Direct metro connectivity on Blue Line. Nearby schools and malls.',
    type: 'APARTMENT', furnished: 'SEMI', bhk: 2,
    rent: 28000, deposit: 56000, maintenance: 2000, area: 1100,
    totalFloors: 12, floor: 6, facingDirection: 'EAST',
    address: 'Sector 10, Dwarka', city: 'Delhi', state: 'Delhi', pincode: '110075',
    landmark: 'Near Dwarka Sector 10 Metro',
    lat: 28.5823, lng: 77.0500,
    amenityNames: ['Parking', 'Lift', 'CCTV', 'Power Backup', 'Play Area', 'Security Guard', 'Gated Security'],
    images: [
      { url: 'https://placehold.co/800x600/14532d/ffffff?text=Dwarka+2BHK', isPrimary: true, order: 0 },
      { url: 'https://placehold.co/800x600/166534/ffffff?text=Bedroom', isPrimary: false, order: 1 },
    ],
    rules: { smokingAllowed: false, petsAllowed: false, bachelorAllowed: false, familyPreferred: true, visitorsAllowed: true, nonVegAllowed: true, genderPreference: 'ANY' },
  },
]

// ─── Main ──────────────────────────────────────────────────────────
async function main() {
  // 1. Seed amenities
  for (const name of AMENITIES) {
    await prisma.amenity.upsert({ where: { name }, update: {}, create: { name } })
  }
  console.log(`✓ ${AMENITIES.length} amenities seeded`)

  // 2. Seed admin account
  const adminEmail    = process.env.ADMIN_SEED_EMAIL    ?? 'srigokulkrishnan@gmail.com'
  const adminPassword = process.env.ADMIN_SEED_PASSWORD ?? 'sgokulk@1234'
  const passwordHash  = await bcrypt.hash(adminPassword, 12)
  await prisma.admin.upsert({
    where:  { email: adminEmail },
    update: {},
    create: { email: adminEmail, passwordHash, name: 'StayOnMap Admin' },
  })
  console.log(`✓ Admin account: ${adminEmail}`)

  // 3. Seed demo owner (fixed id so re-running is idempotent)
  const owner = await prisma.user.upsert({
    where:  { email: 'demo.owner@stayonmap.in' },
    update: {},
    create: {
      id:    'seed-owner-001',
      email: 'demo.owner@stayonmap.in',
      name:  'Ravi Kumar',
      role:  'OWNER',
    },
  })
  console.log(`✓ Demo owner: ${owner.email}`)

  // 4. Seed properties
  const amenityMap = {}
  const allAmenities = await prisma.amenity.findMany()
  for (const a of allAmenities) amenityMap[a.name] = a.id

  let created = 0
  for (const prop of PROPERTIES) {
    const exists = await prisma.property.findFirst({
      where: { title: prop.title, ownerId: owner.id },
    })
    if (exists) continue

    const { amenityNames, images, rules, ...rest } = prop

    await prisma.property.create({
      data: {
        ...rest,
        status:  'ACTIVE',
        ownerId: owner.id,
        availableFrom: new Date(),
        images: {
          create: images,
        },
        amenities: {
          create: amenityNames
            .filter(n => amenityMap[n])
            .map(n => ({ amenityId: amenityMap[n] })),
        },
        rules: { create: rules },
        // Seed a basic trust score so TrustBadge renders
        trustScore: {
          create: {
            overallScore:      3.8,
            safetyScore:       4.0,
            cleanlinessScore:  3.9,
            neighborhoodScore: 3.7,
            totalReviews:      0,
            recommendPercent:  0,
          },
        },
        riskScore: {
          create: {
            score: 5,
            level: 'LOW',
          },
        },
      },
    })
    created++
  }

  console.log(`✓ ${created} new properties created (${PROPERTIES.length - created} already existed)`)
  console.log('✓ Seed complete')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
