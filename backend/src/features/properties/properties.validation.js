import { z } from 'zod'
import { proximitySchema } from './proximityFilter.js'
import { SUPPORTED_CITIES } from '../../config/cities.js'
import { PROPERTY_TYPES, PRICING_MODELS, filterQueryShape } from './filters.registry.js'

export { PROPERTY_TYPES }

const SUPABASE_STORAGE_URL = process.env.SUPABASE_URL
  ? `${process.env.SUPABASE_URL}/storage/v1/object/public/`
  : null

const storageImageUrl = z.string().url().refine(
  (url) => !SUPABASE_STORAGE_URL || url.startsWith(SUPABASE_STORAGE_URL),
  { message: 'Image must be uploaded to StayOnMap storage' }
)

// PROPERTY_TYPES lives in filters.registry.js now (single source of truth
// shared with the filter engine) — re-exported above for existing importers.

// Types whose bhk represents bedrooms and is required (PG uses `sharing`
// instead; LAND/COMMERCIAL have no bedroom concept at all).
const BHK_REQUIRED_TYPES = ['APARTMENT', 'HOUSE', 'VILLA', 'INDEPENDENT_HOUSE', 'SHORT_STAY']

// Types that can be offered on lease (lump sum, no monthly rent). PG prices
// per bed and SHORT_STAY per night, so a lease deal is meaningless for both;
// LAND already carries its own `saleOrLease` field and isn't rented monthly.
export const LEASE_ELIGIBLE_TYPES = ['APARTMENT', 'HOUSE', 'VILLA', 'INDEPENDENT_HOUSE', 'COMMERCIAL']

const rulesSchemaCreate = z.object({
  smokingAllowed:    z.boolean().default(false),
  petsAllowed:       z.boolean().default(false),
  bachelorAllowed:   z.boolean().default(true),
  familyPreferred:   z.boolean().default(false),
  visitorsAllowed:   z.boolean().default(true),
  nonVegAllowed:     z.boolean().default(false),
  curfewTime:        z.string().max(20).optional(),
  genderPreference:  z.enum(['ANY', 'MALE', 'FEMALE']).default('ANY'),
  foodPreference:    z.string().max(100).optional(),
  alcoholAllowed:    z.boolean().default(false),
  noiseRestrictions: z.string().max(200).optional(),
})

const rulesSchemaUpdate = z.object({
  smokingAllowed:    z.boolean().optional(),
  petsAllowed:       z.boolean().optional(),
  bachelorAllowed:   z.boolean().optional(),
  familyPreferred:   z.boolean().optional(),
  visitorsAllowed:   z.boolean().optional(),
  nonVegAllowed:     z.boolean().optional(),
  curfewTime:        z.string().max(20).optional(),
  genderPreference:  z.enum(['ANY', 'MALE', 'FEMALE']).optional(),
  foodPreference:    z.string().max(100).optional(),
  alcoholAllowed:    z.boolean().optional(),
  noiseRestrictions: z.string().max(200).optional(),
})

export const createPropertySchema = z.object({
  title:       z.string().min(5).max(100).trim(),
  description: z.string().min(10).max(2000).trim(),
  type:        z.enum(PROPERTY_TYPES),
  furnished:   z.enum(['FULLY', 'SEMI', 'UNFURNISHED']).default('UNFURNISHED'),

  // Location
  address:  z.string().min(5).max(300).trim(),
  city:     z.enum(SUPPORTED_CITIES, { errorMap: () => ({ message: `Listings are only available in ${SUPPORTED_CITIES.join(', ')}` }) }),
  state:    z.string().min(2).max(100).trim(),
  pincode:  z.string().regex(/^\d{6}$/, 'Invalid pincode'),
  landmark: z.string().max(200).trim().optional(),
  lat:      z.number().min(6).max(38),
  lng:      z.number().min(68).max(98),

  // Specifics
  bhk:             z.number().int().min(0).max(10).optional(),
  sharing:         z.number().int().min(1).max(6).optional(),
  area:            z.number().positive().max(100_000).optional(),
  totalFloors:     z.number().int().min(1).max(200).optional(),
  floor:           z.number().int().min(0).max(200).optional(),
  facingDirection: z.enum(['EAST', 'WEST', 'NORTH', 'SOUTH']).optional(),
  bathrooms:       z.number().int().min(0).max(20).optional(),

  // HOUSE
  houseStyle: z.enum(['Independent house', 'Villa', 'Duplex', 'Row house']).optional(),

  // LAND
  landType:       z.enum(['Residential', 'Agricultural', 'Commercial', 'Industrial']).optional(),
  extent:         z.number().positive().max(10_000_000).optional(),
  extentUnit:     z.string().max(20).optional(),
  dimensions:     z.string().max(60).optional(),
  roadWidth:      z.number().min(0).max(1000).optional(),
  approvalStatus: z.enum(['DTCP', 'RERA', 'Panchayat', 'Unapproved']).optional(),
  saleOrLease:    z.enum(['SALE', 'LEASE']).optional(),

  // COMMERCIAL
  commercialType: z.enum(['Retail shop', 'Office', 'Showroom', 'Warehouse']).optional(),
  carpetArea:     z.number().positive().max(100_000).optional(),
  frontage:       z.number().positive().max(1000).optional(),
  powerLoad:      z.string().max(30).optional(),

  // PG
  totalBeds:        z.number().int().min(1).max(500).optional(),
  availableBeds:    z.number().int().min(0).max(500).optional(),
  noticePeriodDays: z.number().int().min(0).max(180).optional(),

  // SHORT_STAY
  placeType:   z.enum(['Entire place', 'Private room', 'Shared room']).optional(),
  maxGuests:   z.number().int().min(1).max(50).optional(),
  beds:        z.number().int().min(1).max(50).optional(),
  nightlyRate: z.number().positive().max(1_000_000).optional(),
  cleaningFee: z.number().min(0).max(100_000).optional(),
  weekendRate: z.number().positive().max(1_000_000).optional(),
  minNights:   z.number().int().min(1).max(365).optional(),
  maxNights:   z.number().int().min(1).max(365).optional(),
  instantBook: z.boolean().optional(),

  // Pricing
  // `rent` is the primary price in both modes — monthly rent for RENT, the
  // refundable lump sum for LEASE (which is why the cap is 10M, wide enough
  // for a real lease sum). See PricingModel in schema.prisma.
  pricingModel:       z.enum(['RENT', 'LEASE']).default('RENT'),
  rent:               z.number().positive().max(10_000_000),
  deposit:            z.number().min(0).max(50_000_000),
  maintenance:        z.number().min(0).optional(),
  brokerage:          z.number().min(0).optional(),
  electricityCharges: z.number().min(0).optional(),
  waterCharges:       z.number().min(0).optional(),

  // Availability
  availableFrom:  z.string().datetime().optional(),
  occupancyLimit: z.number().int().min(1).optional(),
  leaseDuration:  z.number().int().min(1).optional(),

  // Appointment window
  appointmentWindowStart: z.string().regex(/^\d{2}:\d{2}$/, 'Invalid time format').optional(),
  appointmentWindowEnd:   z.string().regex(/^\d{2}:\d{2}$/, 'Invalid time format').optional(),

  // Media & amenities
  amenityIds: z.array(z.string()).max(20).default([]),
  images:     z.array(storageImageUrl).min(1).max(10),

  // Rules (optional object)
  rules: rulesSchemaCreate.optional(),
}).refine(
  (d) => d.pricingModel !== 'LEASE' || LEASE_ELIGIBLE_TYPES.includes(d.type),
  { message: 'Lease pricing is only available for flats, houses and commercial spaces', path: ['pricingModel'] }
).refine(
  // On a lease the lump sum in `rent` IS the money at stake — a second
  // refundable deposit on top is a different (and misleading) deal.
  (d) => d.pricingModel !== 'LEASE' || !d.deposit,
  { message: 'A lease listing has no separate deposit — the lease amount is refunded on exit', path: ['deposit'] }
).refine(
  (d) => d.type !== 'PG' || d.sharing !== undefined,
  { message: 'Sharing count is required for PG listings', path: ['sharing'] }
).refine(
  (d) => !BHK_REQUIRED_TYPES.includes(d.type) || d.bhk !== undefined,
  { message: 'BHK is required for this property type', path: ['bhk'] }
).refine(
  (d) => d.type !== 'LAND' || (d.landType !== undefined && d.extent !== undefined),
  { message: 'Land type and extent are required for land listings', path: ['landType'] }
).refine(
  (d) => d.type !== 'COMMERCIAL' || d.commercialType !== undefined,
  { message: 'Commercial type is required for shop/commercial listings', path: ['commercialType'] }
).refine(
  (d) => d.type !== 'SHORT_STAY' || (d.placeType !== undefined && d.nightlyRate !== undefined),
  { message: 'Place type and nightly rate are required for short-stay listings', path: ['placeType'] }
).refine(
  (d) => d.floor === undefined || d.totalFloors === undefined || d.floor <= d.totalFloors,
  { message: 'Unit floor cannot exceed total floors', path: ['floor'] }
).refine(
  (d) => !d.appointmentWindowStart || !d.appointmentWindowEnd || d.appointmentWindowStart < d.appointmentWindowEnd,
  { message: 'Window start must be before end', path: ['appointmentWindowStart'] }
)

export const updatePropertySchema = z.object({
  title:              z.string().min(5).max(100).trim().optional(),
  description:        z.string().min(10).max(2000).trim().optional(),
  type:               z.enum(PROPERTY_TYPES).optional(),
  furnished:          z.enum(['FULLY', 'SEMI', 'UNFURNISHED']).optional(),
  address:            z.string().min(5).max(300).trim().optional(),
  city:               z.enum(SUPPORTED_CITIES).optional(),
  state:              z.string().min(2).max(100).trim().optional(),
  pincode:            z.string().regex(/^\d{6}$/).optional(),
  landmark:           z.string().max(200).trim().optional(),
  lat:                z.number().min(6).max(38).optional(),
  lng:                z.number().min(68).max(98).optional(),
  bhk:             z.number().int().min(0).max(10).optional(),
  sharing:         z.number().int().min(1).max(6).optional(),
  area:            z.number().positive().max(100_000).optional(),
  totalFloors:     z.number().int().min(1).max(200).optional(),
  floor:           z.number().int().min(0).max(200).optional(),
  facingDirection: z.enum(['EAST', 'WEST', 'NORTH', 'SOUTH']).optional(),
  bathrooms:       z.number().int().min(0).max(20).optional(),
  houseStyle:      z.enum(['Independent house', 'Villa', 'Duplex', 'Row house']).optional(),
  landType:        z.enum(['Residential', 'Agricultural', 'Commercial', 'Industrial']).optional(),
  extent:          z.number().positive().max(10_000_000).optional(),
  extentUnit:      z.string().max(20).optional(),
  dimensions:      z.string().max(60).optional(),
  roadWidth:       z.number().min(0).max(1000).optional(),
  approvalStatus:  z.enum(['DTCP', 'RERA', 'Panchayat', 'Unapproved']).optional(),
  saleOrLease:     z.enum(['SALE', 'LEASE']).optional(),
  commercialType:  z.enum(['Retail shop', 'Office', 'Showroom', 'Warehouse']).optional(),
  carpetArea:      z.number().positive().max(100_000).optional(),
  frontage:        z.number().positive().max(1000).optional(),
  powerLoad:       z.string().max(30).optional(),
  totalBeds:        z.number().int().min(1).max(500).optional(),
  availableBeds:    z.number().int().min(0).max(500).optional(),
  noticePeriodDays: z.number().int().min(0).max(180).optional(),
  placeType:   z.enum(['Entire place', 'Private room', 'Shared room']).optional(),
  maxGuests:   z.number().int().min(1).max(50).optional(),
  beds:        z.number().int().min(1).max(50).optional(),
  nightlyRate: z.number().positive().max(1_000_000).optional(),
  cleaningFee: z.number().min(0).max(100_000).optional(),
  weekendRate: z.number().positive().max(1_000_000).optional(),
  minNights:   z.number().int().min(1).max(365).optional(),
  maxNights:   z.number().int().min(1).max(365).optional(),
  instantBook: z.boolean().optional(),
  // No `pricingModel` here on purpose — validate() strips unknown fields, so an
  // update can never flip it. Switching modes silently re-reads `rent`: an ₹8L
  // lease sum flipped to RENT becomes ₹8L/month. A partial payload also has no
  // `type` to re-check LEASE_ELIGIBLE_TYPES against. Relist instead.
  rent:            z.number().positive().max(10_000_000).optional(),
  deposit:            z.number().min(0).max(50_000_000).optional(),
  maintenance:        z.number().min(0).optional(),
  brokerage:          z.number().min(0).optional(),
  electricityCharges: z.number().min(0).optional(),
  waterCharges:       z.number().min(0).optional(),
  availableFrom:      z.string().datetime().optional(),
  occupancyLimit:     z.number().int().min(1).optional(),
  leaseDuration:      z.number().int().min(1).optional(),
  appointmentWindowStart: z.string().regex(/^\d{2}:\d{2}$/, 'Invalid time format').optional(),
  appointmentWindowEnd:   z.string().regex(/^\d{2}:\d{2}$/, 'Invalid time format').optional(),
  amenityIds:         z.array(z.string()).max(20).optional(),
  images:             z.array(storageImageUrl).min(1).max(10).optional(),
  rules: rulesSchemaUpdate.optional(),
}).refine(
  (d) => d.floor === undefined || d.totalFloors === undefined || d.floor <= d.totalFloors,
  { message: 'Unit floor cannot exceed total floors', path: ['floor'] }
).refine(
  (d) => !d.appointmentWindowStart || !d.appointmentWindowEnd || d.appointmentWindowStart < d.appointmentWindowEnd,
  { message: 'Window start must be before end', path: ['appointmentWindowStart'] }
)

// Rent is what the public read path means by default. This is a SERVER-side
// default on purpose: filterQueryShape() makes every registry filter optional
// (so a schema-level .default() would be swallowed), and the web client omits
// params equal to their default — so "no pricingModel" must mean RENT here, or
// lease listings leak into the normal rent map with their lakh-scale lump sum
// read as a monthly rent. It also means any client that predates lease (mobile
// today) keeps getting rent-only results without a single change.
// Admin deliberately does NOT get this default — see admin.validation.js.
const publicPricingModel = z.enum(PRICING_MODELS).default('RENT')

// All map/list filters come from the registry — one Zod shape shared by the
// list, pins, and count queries. bhk/furnished/city are registry entries now
// (furnished upgraded single-value → CSV multi; a lone value still parses).
export const listQuerySchema = z.object({
  page:      z.coerce.number().int().min(1).default(1),
  limit:     z.coerce.number().int().min(1).max(50).default(20),
  ...filterQueryShape(),
  ...proximitySchema,
  pricingModel: publicPricingModel,
  swLat:     z.coerce.number().optional(),
  swLng:     z.coerce.number().optional(),
  neLat:     z.coerce.number().optional(),
  neLng:     z.coerce.number().optional(),
})

// Bounds are required here (unlike listQuerySchema above) — /pins always
// comes from a map viewport, and without this, missing/malformed bounds
// reached Prisma as NaN and 500'd instead of a clean 400.
// Corners are clamped into India's bounding box rather than rejected: a
// zoomed-out viewport that CONTAINS India (e.g. the initial fitBounds over
// all supported cities) is a valid query whose corners fall outside the box.
// A viewport entirely outside India clamps to an empty box → 0 pins.
const clampedTo = (min, max) => z.coerce.number().transform((n) => Math.min(Math.max(n, min), max))

export const pinsQuerySchema = z.object({
  swLat: clampedTo(6, 38),
  swLng: clampedTo(68, 98),
  neLat: clampedTo(6, 38),
  neLng: clampedTo(68, 98),
  ...filterQueryShape(),
  ...proximitySchema,
  pricingModel: publicPricingModel,
})

// Live result count for the filter modal — same shape as /pins (bounds
// required: the count is always "matches in the current viewport").
export const countQuerySchema = pinsQuerySchema
