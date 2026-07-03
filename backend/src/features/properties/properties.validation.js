import { z } from 'zod'
import { SUPPORTED_CITIES } from '../../config/cities.js'

const SUPABASE_STORAGE_URL = process.env.SUPABASE_URL
  ? `${process.env.SUPABASE_URL}/storage/v1/object/public/`
  : null

const storageImageUrl = z.string().url().refine(
  (url) => !SUPABASE_STORAGE_URL || url.startsWith(SUPABASE_STORAGE_URL),
  { message: 'Image must be uploaded to StayOnMap storage' }
)

export const createPropertySchema = z.object({
  title:       z.string().min(5).max(100).trim(),
  description: z.string().min(10).max(2000).trim(),
  type:        z.enum(['APARTMENT', 'HOUSE', 'VILLA', 'PG', 'INDEPENDENT_HOUSE', 'COMMERCIAL']),
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
  bhk:             z.number().int().min(1).max(10).optional(),
  sharing:         z.number().int().min(1).max(6).optional(),
  area:            z.number().positive().max(100_000).optional(),
  totalFloors:     z.number().int().min(1).max(200).optional(),
  floor:           z.number().int().min(0).max(200).optional(),
  facingDirection: z.enum(['EAST', 'WEST', 'NORTH', 'SOUTH']).optional(),

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
  rules: z.object({
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
  }).optional(),
}).refine(
  (d) => d.type !== 'PG' || d.sharing !== undefined,
  { message: 'Sharing count is required for PG listings', path: ['sharing'] }
).refine(
  (d) => d.type === 'PG' || d.bhk !== undefined,
  { message: 'BHK is required for non-PG listings', path: ['bhk'] }
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
  type:               z.enum(['APARTMENT', 'HOUSE', 'VILLA', 'PG', 'INDEPENDENT_HOUSE', 'COMMERCIAL']).optional(),
  furnished:          z.enum(['FULLY', 'SEMI', 'UNFURNISHED']).optional(),
  address:            z.string().min(5).max(300).trim().optional(),
  city:               z.enum(SUPPORTED_CITIES).optional(),
  state:              z.string().min(2).max(100).trim().optional(),
  pincode:            z.string().regex(/^\d{6}$/).optional(),
  landmark:           z.string().max(200).trim().optional(),
  lat:                z.number().min(6).max(38).optional(),
  lng:                z.number().min(68).max(98).optional(),
  bhk:             z.number().int().min(1).max(10).optional(),
  sharing:         z.number().int().min(1).max(6).optional(),
  area:            z.number().positive().max(100_000).optional(),
  totalFloors:     z.number().int().min(1).max(200).optional(),
  floor:           z.number().int().min(0).max(200).optional(),
  facingDirection: z.enum(['EAST', 'WEST', 'NORTH', 'SOUTH']).optional(),
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
  rules: z.object({
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
  }).optional(),
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
