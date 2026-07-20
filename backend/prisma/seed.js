// Seed: amenities + admin account + sample properties across India
// Run: npx prisma db seed

import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import bcrypt from 'bcryptjs'
import { AMENITIES } from './amenities.js'
import { ADMIN_MIN_PASSWORD_LENGTH } from '../src/features/admin/admin.validation.js'
import { encode } from '../src/lib/geohash.js'

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL })
const prisma = new PrismaClient({ adapter })

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
    amenityNames: ['WiFi', 'Parking', 'Gym', 'Swimming Pool', 'AC', 'Lift', 'CCTV', 'Power Backup', 'Club House', 'Gated Community'],
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
    amenityNames: ['Parking', 'Lift', 'CCTV', 'Power Backup', 'Play Area', 'Security Guard', 'Gated Community'],
    images: [
      { url: 'https://placehold.co/800x600/14532d/ffffff?text=Dwarka+2BHK', isPrimary: true, order: 0 },
      { url: 'https://placehold.co/800x600/166534/ffffff?text=Bedroom', isPrimary: false, order: 1 },
    ],
    rules: { smokingAllowed: false, petsAllowed: false, bachelorAllowed: false, familyPreferred: true, visitorsAllowed: true, nonVegAllowed: true, genderPreference: 'ANY' },
  },

  // ── The other three categories, and the other five cities ──────────────
  //
  // Added 2026-07-20. Until now the seed produced APARTMENT/HOUSE/VILLA/
  // INDEPENDENT_HOUSE/PG across four cities, so LAND, COMMERCIAL and SHORT_STAY
  // had NO local data at all — which meant landContext, commerce and
  // stayContext (and every per-type branch in the spatial panel) had never been
  // exercised against a real row. CLAUDE.md's rule is that a feature is not done
  // when it works for apartments; a seed that only makes apartments is how that
  // rule quietly stops being testable.
  //
  // Coordinates are real localities, because the spatial layer keys on a
  // geohash-7 cell and intelligence.service.js sanity-checks coordinates against
  // the stated city. A plausible-looking made-up point lands in a cell with no
  // POIs and looks like a bug in the layer rather than a bug in the fixture.
  //
  // NOTE ON `rules`: these fixtures deliberately carry NONE, except the PG,
  // which carries only `genderPreference`. That is exactly what the wizard
  // produces — `buildPayload` sets `payload.rules` only when
  // `fields.genderPreference` exists, and that field appears only in
  // FIELDS.pg. So a real APARTMENT / LAND / COMMERCIAL / SHORT_STAY listing has
  // `rules === null`.
  //
  // The older fixtures above set six or seven rule booleans each, which no
  // listing created through the product can have. That made the seed exercise a
  // state production cannot reach while NEVER exercising `rules === null` — the
  // state the property page actually hits for nearly every listing. The gap is
  // real and worth closing in the wizard; until it is, the fixtures should show
  // what the product does, not what the schema permits.

  // ── Mumbai ─────────────────────────────────────────────────────────────
  {
    title: 'Shop on Linking Road, Bandra West',
    description: 'Ground-floor retail unit on Linking Road with direct shopfront and heavy footfall. Roll-down shutter, mezzanine for storage, and sanctioned three-phase power. Suits apparel, eyewear or a QSR counter.',
    type: 'COMMERCIAL', furnished: 'UNFURNISHED',
    rent: 185000, deposit: 1110000, maintenance: 8000, area: 620,
    commercialType: 'Retail shop', carpetArea: 520, frontage: 18, powerLoad: '15 kW',
    totalFloors: 4, floor: 0,
    address: 'Linking Road, Bandra West', city: 'Mumbai', state: 'Maharashtra', pincode: '400050',
    landmark: 'Near Bandra Talao',
    lat: 19.0596, lng: 72.8295,
    amenityNames: ['Roll-down Shutter', 'Mezzanine', 'Signage Space', 'Near Main Road', '3-Phase Power', 'CCTV', 'Washroom', 'Fire Safety'],
    images: [
      { url: 'https://placehold.co/800x600/7c2d12/ffffff?text=Linking+Road+Shop', isPrimary: true, order: 0 },
      { url: 'https://placehold.co/800x600/9a3412/ffffff?text=Shopfront', isPrimary: false, order: 1 },
    ],
  },
  {
    title: 'Studio near Powai Lake',
    description: 'Compact studio with a lake-facing balcony, five minutes from Hiranandani Gardens. Fully equipped kitchenette, fast WiFi and a proper desk — set up for a working stay rather than a weekend.',
    type: 'SHORT_STAY', furnished: 'FULLY', bhk: 1, bathrooms: 1,
    rent: 4200, nightlyRate: 4200, weekendRate: 5400, cleaningFee: 900,
    placeType: 'Entire place', maxGuests: 3, beds: 2, minNights: 2, maxNights: 45, instantBook: true,
    deposit: 0, area: 480, totalFloors: 14, floor: 9,
    address: 'Central Avenue, Hiranandani Gardens, Powai', city: 'Mumbai', state: 'Maharashtra', pincode: '400076',
    landmark: 'Near Powai Lake',
    lat: 19.1176, lng: 72.9060,
    amenityNames: ['WiFi', 'AC', 'TV', 'Workspace', 'Kitchen', 'Fridge', 'Microwave', 'Washing Machine', 'Balcony', 'Lift', 'Power Backup', 'Housekeeping', 'Breakfast'],
    images: [
      { url: 'https://placehold.co/800x600/0c4a6e/ffffff?text=Powai+Studio', isPrimary: true, order: 0 },
      { url: 'https://placehold.co/800x600/075985/ffffff?text=Lake+View', isPrimary: false, order: 1 },
    ],
  },

  // ── Pune ───────────────────────────────────────────────────────────────
  {
    title: 'Residential plot in Baner',
    description: 'North-facing corner plot on a 40ft internal road in Baner, walking distance to the Mumbai-Bangalore highway service road. Clear title, RERA registered, compound wall already built. Ready to build.',
    // For LAND the wizard labels `rent` "Total price" and `deposit` "Advance"
    // (features/listings/config/onboarding.js PRICING.land) — the column is
    // shared, the label is what differs. Not a monthly figure.
    type: 'LAND', furnished: 'UNFURNISHED',
    rent: 9500000, deposit: 500000, area: 2400,
    landType: 'Residential', extent: 2400, extentUnit: 'sq.ft', dimensions: '40 x 60 ft',
    roadWidth: 40, approvalStatus: 'RERA', saleOrLease: 'SALE',
    address: 'Baner Road, Baner', city: 'Pune', state: 'Maharashtra', pincode: '411045',
    landmark: 'Near Balewadi High Street',
    lat: 18.5590, lng: 73.7868,
    amenityNames: ['Corner Plot', 'Boundary Wall', 'Near Main Road', 'Ready to Build', 'Water Supply', 'Borewell'],
    images: [
      { url: 'https://placehold.co/800x600/365314/ffffff?text=Baner+Plot', isPrimary: true, order: 0 },
      { url: 'https://placehold.co/800x600/4d7c0f/ffffff?text=Road+Frontage', isPrimary: false, order: 1 },
    ],
  },
  {
    title: '3 BHK in Hinjawadi Phase 1',
    description: 'Bright 3BHK in a gated society inside Hinjawadi Phase 1 — walkable to Infosys and Wipro campuses, which is the entire point of living here. Clubhouse, gym and covered parking.',
    type: 'APARTMENT', furnished: 'SEMI', bhk: 3, bathrooms: 3,
    rent: 34000, deposit: 102000, maintenance: 2800, area: 1450,
    totalFloors: 11, floor: 7, facingDirection: 'EAST',
    address: 'Phase 1, Hinjawadi Rajiv Gandhi Infotech Park', city: 'Pune', state: 'Maharashtra', pincode: '411057',
    landmark: 'Near Infosys Phase 1 gate',
    lat: 18.5913, lng: 73.7389,
    amenityNames: ['WiFi', 'Covered Parking', 'Gym', 'Club House', 'Lift', 'Power Backup', 'CCTV', 'Security Guard', 'Gated Community', 'Play Area'],
    images: [
      { url: 'https://placehold.co/800x600/1e3a8a/ffffff?text=Hinjawadi+3BHK', isPrimary: true, order: 0 },
      { url: 'https://placehold.co/800x600/1d4ed8/ffffff?text=Living+Room', isPrimary: false, order: 1 },
    ],
  },

  // ── Kolkata ────────────────────────────────────────────────────────────
  {
    title: 'Heritage flat in Ballygunge',
    description: 'High-ceilinged 3BHK in a low-rise Ballygunge building, the kind with a proper verandah and cross-ventilation that newer towers gave up on. Quiet lane, walking distance to Gariahat market.',
    type: 'APARTMENT', furnished: 'SEMI', bhk: 3, bathrooms: 2,
    rent: 42000, deposit: 84000, maintenance: 2200, area: 1600,
    totalFloors: 4, floor: 2, facingDirection: 'SOUTH',
    address: 'Ballygunge Circular Road', city: 'Kolkata', state: 'West Bengal', pincode: '700019',
    landmark: 'Near Gariahat Market',
    lat: 22.5290, lng: 88.3654,
    amenityNames: ['Parking', 'Lift', 'Power Backup', 'Balcony', 'Water Supply', 'Security Guard', 'Intercom'],
    images: [
      { url: 'https://placehold.co/800x600/581c87/ffffff?text=Ballygunge+3BHK', isPrimary: true, order: 0 },
      { url: 'https://placehold.co/800x600/6b21a8/ffffff?text=Verandah', isPrimary: false, order: 1 },
    ],
  },
  {
    title: 'Ladies PG in Salt Lake Sector V',
    description: 'Women-only PG a few minutes from the Sector V IT offices. Twin-sharing rooms with attached bath, three meals included, and a 10pm entry log rather than a hard curfew.',
    type: 'PG', furnished: 'FULLY',
    rent: 11500, deposit: 23000, area: 180,
    totalBeds: 24, availableBeds: 5, noticePeriodDays: 30, sharing: 2,
    totalFloors: 5, floor: 3,
    address: 'Sector V, Bidhannagar', city: 'Kolkata', state: 'West Bengal', pincode: '700091',
    landmark: 'Near Karunamoyee crossing',
    lat: 22.5697, lng: 88.4312,
    amenityNames: ['WiFi', 'AC', 'Attached Bath', 'Breakfast', 'Lunch', 'Dinner', 'Laundry', 'Housekeeping', 'Power Backup', 'CCTV', 'Security Guard', 'Study Desk', 'Wardrobe'],
    images: [
      { url: 'https://placehold.co/800x600/831843/ffffff?text=Salt+Lake+PG', isPrimary: true, order: 0 },
      { url: 'https://placehold.co/800x600/9d174d/ffffff?text=Twin+Room', isPrimary: false, order: 1 },
    ],
    // Exactly what the wizard writes for a PG, and nothing more: `buildPayload`
    // sets `rules` to `{ genderPreference }` alone. `curfewTime` and the
    // booleans have no control anywhere in the flow.
    rules: { genderPreference: 'FEMALE' },
  },

  // ── Ahmedabad ──────────────────────────────────────────────────────────
  {
    title: 'Agricultural land off Sanand Road',
    description: 'Two acres of irrigated agricultural land with borewell and an existing farm road approach. Panchayat approved, currently under groundnut. Available on long lease rather than sale.',
    // saleOrLease: 'LEASE' here exercises the branch the Baner plot doesn't.
    // `rent` is still the total consideration, NOT a monthly figure — LAND is
    // excluded from LEASE_ELIGIBLE_TYPES, so pricingModel stays RENT and only
    // `saleOrLease` distinguishes the two.
    type: 'LAND', furnished: 'UNFURNISHED',
    rent: 900000, deposit: 200000, area: 87120,
    landType: 'Agricultural', extent: 2, extentUnit: 'acres', dimensions: 'irregular',
    roadWidth: 20, approvalStatus: 'Panchayat', saleOrLease: 'LEASE',
    address: 'Sanand-Nalsarovar Road', city: 'Ahmedabad', state: 'Gujarat', pincode: '382110',
    landmark: 'Near Sanand GIDC',
    lat: 22.9880, lng: 72.3820,
    amenityNames: ['Borewell', 'Water Supply', 'Near Main Road', 'Boundary Wall'],
    images: [
      { url: 'https://placehold.co/800x600/3f6212/ffffff?text=Sanand+Farmland', isPrimary: true, order: 0 },
    ],
  },
  {
    title: '2 BHK in Prahlad Nagar',
    description: 'Well-kept 2BHK in a Prahlad Nagar society with a garden and jogging track. Close to the corporate road offices and a short drive to SG Highway.',
    type: 'APARTMENT', furnished: 'SEMI', bhk: 2, bathrooms: 2,
    rent: 24000, deposit: 72000, maintenance: 1800, area: 1150,
    totalFloors: 9, floor: 4, facingDirection: 'WEST',
    address: 'Prahlad Nagar', city: 'Ahmedabad', state: 'Gujarat', pincode: '380015',
    landmark: 'Near Prahlad Nagar Garden',
    lat: 23.0120, lng: 72.5100,
    amenityNames: ['Parking', 'Lift', 'Garden', 'Jogging Track', 'Power Backup', 'CCTV', 'Security Guard', 'Gated Community'],
    images: [
      { url: 'https://placehold.co/800x600/155e75/ffffff?text=Prahlad+Nagar+2BHK', isPrimary: true, order: 0 },
    ],
  },

  // ── Surat ──────────────────────────────────────────────────────────────
  {
    title: 'Office unit in Vesu',
    description: 'Third-floor office in a Vesu commercial building, currently fitted with cabins and a small pantry. Lift, covered parking and generator backup for the whole floor.',
    type: 'COMMERCIAL', furnished: 'SEMI',
    rent: 55000, deposit: 330000, maintenance: 4500, area: 1200,
    // No `frontage`: createPropertySchema requires it positive, and the wizard
    // omits a blank field entirely rather than sending 0. A fixture carrying a
    // value production cannot produce tests a state that does not exist.
    commercialType: 'Office', carpetArea: 980, powerLoad: '10 kW',
    totalFloors: 7, floor: 3,
    address: 'VIP Road, Vesu', city: 'Surat', state: 'Gujarat', pincode: '395007',
    landmark: 'Near Vesu Cross Road',
    lat: 21.1440, lng: 72.7710,
    amenityNames: ['Lift', 'Covered Parking', 'Power Backup', 'CCTV', 'Washroom', 'AC', 'Fire Safety', 'Signage Space'],
    images: [
      { url: 'https://placehold.co/800x600/1e293b/ffffff?text=Vesu+Office', isPrimary: true, order: 0 },
    ],
  },
  {
    title: '3 BHK in Adajan',
    description: 'Family 3BHK in Adajan with a covered balcony and a society play area. Walking distance to schools, and close to the Tapi riverfront.',
    type: 'APARTMENT', furnished: 'SEMI', bhk: 3, bathrooms: 2,
    rent: 21000, deposit: 63000, maintenance: 1500, area: 1350,
    totalFloors: 8, floor: 5, facingDirection: 'NORTH',
    address: 'Pal Road, Adajan', city: 'Surat', state: 'Gujarat', pincode: '395009',
    landmark: 'Near Tapi Riverfront',
    lat: 21.1959, lng: 72.7933,
    amenityNames: ['Parking', 'Lift', 'Balcony', 'Play Area', 'Power Backup', 'CCTV', 'Security Guard', 'Water Tank'],
    images: [
      { url: 'https://placehold.co/800x600/7f1d1d/ffffff?text=Adajan+3BHK', isPrimary: true, order: 0 },
    ],
  },
]

// ─── Main ──────────────────────────────────────────────────────────
async function main() {
  // 1. Seed amenities
  for (const name of AMENITIES) {
    await prisma.amenity.upsert({ where: { name }, update: {}, create: { name } })
  }
  console.log(`✓ ${AMENITIES.length} amenities seeded`)

  // 2. Seed admin account — no hardcoded fallback password; a real credential
  //    baked into source is exactly the kind of thing that ends up leaked in
  //    git history, so this must come from the environment every time.
  const adminEmail    = process.env.ADMIN_SEED_EMAIL
  const adminPassword = process.env.ADMIN_SEED_PASSWORD
  if (!adminEmail || !adminPassword) {
    console.error('✗ ADMIN_SEED_EMAIL and ADMIN_SEED_PASSWORD must both be set in the environment — no default is provided')
    process.exit(1)
  }
  // Same floor the API and update-admin.js enforce — a seeded admin is a real
  // admin, so it must not be able to start life with a weak password.
  if (adminPassword.length < ADMIN_MIN_PASSWORD_LENGTH) {
    console.error(`✗ ADMIN_SEED_PASSWORD must be at least ${ADMIN_MIN_PASSWORD_LENGTH} characters`)
    process.exit(1)
  }
  const passwordHash  = await bcrypt.hash(adminPassword, 12)
  await prisma.admin.upsert({
    where:  { email: adminEmail },
    update: {},
    create: { email: adminEmail, passwordHash, name: 'StayOnMap Admin' },
  })
  console.log(`✓ Admin account: ${adminEmail}`)

  // 3. Find the real owner account by email
  //    This user must have logged in at least once so /auth/sync created their DB record.
  const ownerEmail = process.env.SEED_OWNER_EMAIL ?? 'srigokulkrishnan@gmail.com'
  const owner = await prisma.user.findUnique({ where: { email: ownerEmail } })
  if (!owner) {
    console.error(`✗ Owner not found: ${ownerEmail}`)
    console.error('  Log in to the live site first so your account is synced to the DB, then re-run the seed.')
    process.exit(1)
  }

  // Ensure owner has OWNER role
  if (owner.role !== 'OWNER') {
    await prisma.user.update({ where: { id: owner.id }, data: { role: 'OWNER' } })
    console.log(`✓ Upgraded ${ownerEmail} to OWNER role`)
  }

  // ...and Business tier, because the seed creates PG / COMMERCIAL / SHORT_STAY
  // listings. Writing through Prisma bypasses requireBusinessForType, so without
  // this the seeded rows exist but their owner cannot open them in the wizard —
  // a fixture that looks fine on the map and 403s the moment you click edit.
  if (!owner.isBusiness) {
    await prisma.user.update({
      where: { id: owner.id },
      data: { isBusiness: true, businessSince: new Date() },
    })
    console.log(`✓ Upgraded ${ownerEmail} to Business tier (PG/COMMERCIAL/SHORT_STAY)`)
  }
  console.log(`✓ Owner: ${owner.email} (${owner.id})`)

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
        // The seed writes through Prisma, so it bypasses createProperty() and
        // the geohash it derives there. Without this every fixture lands with
        // geohash NULL — and a NULL geohash is "unknown cell", which proximity
        // filters EXCLUDE. The rows added specifically to exercise the spatial
        // layer would have been the exact rows it could not see, fixable only
        // by remembering to run a separate backfill script after every seed.
        geohash: encode(Number(prop.lat), Number(prop.lng)),
        availableFrom: new Date(),
        images: {
          create: images,
        },
        amenities: {
          create: amenityNames
            .filter(n => amenityMap[n])
            .map(n => ({ amenityId: amenityMap[n] })),
        },
        // Conditional, because most fixtures now deliberately have none — see
        // the note above the new listings. `rules: { create: undefined }` is a
        // Prisma error, not a no-op.
        ...(rules && { rules: { create: rules } }),
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


