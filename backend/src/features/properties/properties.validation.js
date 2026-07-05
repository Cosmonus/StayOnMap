import { z } from 'zod'
import { SUPPORTED_CITIES } from '../../config/cities.js'

const SUPABASE_STORAGE_URL = process.env.SUPABASE_URL
  ? `${process.env.SUPABASE_URL}/storage/v1/object/public/`
  : null

const storageImageUrl = z.string().url().refine(
  (url) => !SUPABASE_STORAGE_URL || url.startsWith(SUPABASE_STORAGE_URL),
  { message: 'Image must be uploaded to StayOnMap storage' }
)

// Single source of truth for the 8 property types — previously duplicated
// independently between create/update schemas (a real drift risk).
export const PROPERTY_TYPES = ['APARTMENT', 'HOUSE', 'VILLA', 'PG', 'INDEPENDENT_HOUSE', 'COMMERCIAL', 'LAND', 'SHORT_STAY']

// Types whose bhk represents bedrooms and is required (PG uses `sharing`
// instead; LAND/COMMERCIAL have no bedroom concept at all).
const BHK_REQUIRED_TYPES = ['APARTMENT', 'HOUSE', 'VILLA', 'INDEPENDENT_HOUSE', 'SHORT_STAY']

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

export const listQuerySchema = z.object({
  page:      z.coerce.number().int().min(1).default(1),
  limit:     z.coerce.number().int().min(1).max(50).default(20),
  bhk:       z.string().regex(/^[\d,]+$/).optional(),
  furnished: z.enum(['FULLY', 'SEMI', 'UNFURNISHED']).optional(),
  city:      z.string().max(100).optional(),
  swLat:     z.coerce.number().optional(),
  swLng:     z.coerce.number().optional(),
  neLat:     z.coerce.number().optional(),
  neLng:     z.coerce.number().optional(),
})

// Bounds are required here (unlike listQuerySchema above) — /pins always
// comes from a map viewport, and without this, missing/malformed bounds
// reached Prisma as NaN and 500'd instead of a clean 400.
export const pinsQuerySchema = z.object({
  swLat:     z.coerce.number().min(6).max(38),
  swLng:     z.coerce.number().min(68).max(98),
  neLat:     z.coerce.number().min(6).max(38),
  neLng:     z.coerce.number().min(68).max(98),
  bhk:       z.string().regex(/^[\d,]+$/).optional(),
  furnished: z.enum(['FULLY', 'SEMI', 'UNFURNISHED']).optional(),
  city:      z.string().max(100).optional(),
})
