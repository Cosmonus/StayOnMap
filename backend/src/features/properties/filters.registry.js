// Single source of truth for map/list filtering.
// Every filter defines its id, which property types it applies to (docs only —
// an inapplicable filter simply matches nothing extra), its query-string Zod
// schema, and the Prisma `where` fragment it produces. The list/pins/count
// query schemas and the dynamic where-clause are both generated from this
// registry — adding a filter (or a new property type) is one entry here plus
// one entry in the frontend's config/filters.js, no service/controller changes.
import { z } from 'zod'

export const PROPERTY_TYPES = ['APARTMENT', 'HOUSE', 'VILLA', 'PG', 'INDEPENDENT_HOUSE', 'COMMERCIAL', 'LAND', 'SHORT_STAY']

// ── Query-string coercion helpers ─────────────────────────────────
// Multi-value filters travel as CSV strings ("1,2,3") — URL-friendly,
// cache-key friendly, and matches the pre-existing `bhk` format.
const csv = (item, max = 20) =>
  z.string().max(400)
    .transform((s) => s.split(',').map((v) => v.trim()).filter(Boolean))
    .pipe(z.array(item).min(1).max(max))

const csvEnum = (values) => csv(z.enum(values))
const csvInt  = (min, max) => csv(z.coerce.number().int().min(min).max(max))
const money   = (max = 50_000_000) => z.coerce.number().min(0).max(max)
const intIn   = (min, max) => z.coerce.number().int().min(min).max(max)
// Presence-style boolean: only `true` constrains; anything else is a no-op.
const flag = z.string().transform((s) => s === 'true' || s === '1')

// "N or more" semantics for CSV number lists whose top chip means "N+"
// (e.g. bhk "4+" or sharing "4+"): exact match below the cap, gte at the cap.
function inWithPlus(field, values, cap) {
  const rest = values.filter((n) => n < cap)
  const plus = values.some((n) => n >= cap)
  if (!plus) return { [field]: { in: values } }
  if (!rest.length) return { [field]: { gte: cap } }
  return { OR: [{ [field]: { in: rest } }, { [field]: { gte: cap } }] }
}

// Nullable columns where "unknown" should still match (a max-constraint on a
// field most listings leave blank must not wipe out the map).
const lteOrNull = (field) => (v) => ({ OR: [{ [field]: null }, { [field]: { lte: v } }] })

const rule = (fragment) => ({ rules: { is: fragment } })

export const FILTERS = {
  // ── Universal ────────────────────────────────────────────────────
  type:      { schema: csvEnum(PROPERTY_TYPES), where: (v) => ({ type: { in: v } }) },
  city:      { schema: z.string().max(100), where: (v) => ({ city: { contains: v, mode: 'insensitive' } }) },
  // Up to ₹10Cr — LAND sale prices and large COMMERCIAL rents live in the
  // same rent column, so the filter bound matches the column's capacity,
  // not residential rent expectations.
  rentMin:   { schema: money(100_000_000), where: (v) => ({ rent: { gte: v } }) },
  rentMax:   { schema: money(100_000_000), where: (v) => ({ rent: { lte: v } }) },
  depositMax:     { schema: money(), where: (v) => ({ deposit: { lte: v } }) },
  maintenanceMax: { schema: money(), where: lteOrNull('maintenance') },
  bhk:            { schema: csvInt(0, 10), where: (v) => inWithPlus('bhk', v, 4) },
  bathroomsMin:   { schema: intIn(1, 20), where: (v) => ({ bathrooms: { gte: v } }) },
  areaMin:        { schema: intIn(1, 100_000), where: (v) => ({ area: { gte: v } }) },
  areaMax:        { schema: intIn(1, 100_000), where: (v) => ({ area: { lte: v } }) },
  furnished:      { schema: csvEnum(['FULLY', 'SEMI', 'UNFURNISHED']), where: (v) => ({ furnished: { in: v } }) },
  facing:         { schema: csvEnum(['EAST', 'WEST', 'NORTH', 'SOUTH']), where: (v) => ({ facingDirection: { in: v } }) },
  floorMax:       { schema: intIn(0, 200), where: lteOrNull('floor') },
  availableBy:    { schema: z.string().date(), where: (v) => ({ OR: [{ availableFrom: null }, { availableFrom: { lte: new Date(v) } }] }) },
  leaseDurationMax: { schema: intIn(1, 120), where: lteOrNull('leaseDuration') },
  // Require ALL selected amenities (matched by seeded name)
  amenities: {
    schema: csv(z.string().max(50)),
    where: (v) => ({ AND: v.map((name) => ({ amenities: { some: { amenity: { name } } } })) }),
  },

  // ── House rules / who it's for ───────────────────────────────────
  petsAllowed:     { schema: flag, where: () => rule({ petsAllowed: true }) },
  smokingAllowed:  { schema: flag, where: () => rule({ smokingAllowed: true }) },
  bachelorAllowed: { schema: flag, where: () => rule({ bachelorAllowed: true }) },
  familyPreferred: { schema: flag, where: () => rule({ familyPreferred: true }) },
  nonVegAllowed:   { schema: flag, where: () => rule({ nonVegAllowed: true }) },
  genderPref: {
    schema: z.enum(['MALE', 'FEMALE']),
    where: (v) => ({ OR: [{ rules: null }, rule({ genderPreference: { in: [v, 'ANY'] } })] }),
  },

  // ── PG ───────────────────────────────────────────────────────────
  sharing:        { schema: csvInt(1, 6), where: (v) => inWithPlus('sharing', v, 4) },
  bedsAvailable:  { schema: flag, where: () => ({ availableBeds: { gte: 1 } }) },
  noCurfew:       { schema: flag, where: () => ({ OR: [{ rules: null }, rule({ OR: [{ curfewTime: null }, { curfewTime: '' }] })] }) },
  noticePeriodMax: { schema: intIn(0, 180), where: lteOrNull('noticePeriodDays') },

  // ── Commercial ───────────────────────────────────────────────────
  commercialType: { schema: csvEnum(['Retail shop', 'Office', 'Showroom', 'Warehouse']), where: (v) => ({ commercialType: { in: v } }) },
  carpetAreaMin:  { schema: intIn(1, 100_000), where: (v) => ({ carpetArea: { gte: v } }) },
  frontageMin:    { schema: intIn(1, 1000), where: (v) => ({ frontage: { gte: v } }) },

  // ── Land ─────────────────────────────────────────────────────────
  landType:       { schema: csvEnum(['Residential', 'Agricultural', 'Commercial', 'Industrial']), where: (v) => ({ landType: { in: v } }) },
  approvalStatus: { schema: csvEnum(['DTCP', 'RERA', 'Panchayat', 'Unapproved']), where: (v) => ({ approvalStatus: { in: v } }) },
  saleOrLease:    { schema: z.enum(['SALE', 'LEASE']), where: (v) => ({ saleOrLease: v }) },
  roadWidthMin:   { schema: intIn(1, 1000), where: (v) => ({ roadWidth: { gte: v } }) },

  // ── Short stay ───────────────────────────────────────────────────
  placeType:  { schema: csvEnum(['Entire place', 'Private room', 'Shared room']), where: (v) => ({ placeType: { in: v } }) },
  guestsMin:  { schema: intIn(1, 50), where: (v) => ({ maxGuests: { gte: v } }) },
  nightlyMin: { schema: money(1_000_000), where: (v) => ({ nightlyRate: { gte: v } }) },
  nightlyMax: { schema: money(1_000_000), where: (v) => ({ nightlyRate: { lte: v } }) },
  // Stay-length fit: listing's min/max night rules must accommodate N nights
  stayNights: {
    schema: intIn(1, 365),
    where: (v) => ({
      AND: [
        { OR: [{ minNights: null }, { minNights: { lte: v } }] },
        { OR: [{ maxNights: null }, { maxNights: { gte: v } }] },
      ],
    }),
  },
  instantBook: { schema: flag, where: () => ({ instantBook: true }) },

  // ── Trust & safety (intelligence layer outputs) ──────────────────
  verifiedOnly: { schema: flag, where: () => ({ verification: { is: { status: 'VERIFIED' } } }) },
  lowRiskOnly:  { schema: flag, where: () => ({ OR: [{ riskScore: null }, { riskScore: { is: { level: 'LOW' } } }] }) },
  trustBadges: {
    schema: csvEnum(['VERIFIED_OWNER', 'COMMUNITY_TRUSTED', 'HIGHLY_RECOMMENDED', 'VERIFIED_NEIGHBORHOOD', 'LOW_COMPLAINT']),
    where: (v) => ({ trustScore: { is: { badge: { in: v } } } }),
  },
  minRecommend: { schema: intIn(1, 100), where: (v) => ({ trustScore: { is: { recommendPercent: { gte: v } } } }) },
}

export const PROPERTY_STATUSES = ['DRAFT', 'ACTIVE', 'INACTIVE', 'PENDING', 'SUSPENDED', 'REJECTED']
export const RISK_LEVELS = ['LOW', 'MEDIUM', 'HIGH', 'SUSPICIOUS']

// ── Admin-only filters ────────────────────────────────────────────
// Kept OUT of FILTERS on purpose. FILTERS is what the public list/pins/count
// schemas are generated from, so anything added there becomes a parameter any
// anonymous caller can send. `status` in particular must never be user-settable:
// the public read path pins listings to ACTIVE (properties.service.js), and a
// user-supplied status would be how a DRAFT or SUSPENDED listing leaks out.
//
// Note FILTERS itself has no status entry at all — the ACTIVE constraint lives
// in the user service's callers, not here — which is why the admin side can
// reuse this whole registry without inheriting it.
export const ADMIN_FILTERS = {
  ...FILTERS,
  status: { schema: csvEnum(PROPERTY_STATUSES), where: (v) => ({ status: { in: v } }) },
  // The admin list endpoint accepted a riskLevel param and silently discarded
  // it (dead `_riskLevel`). Now it works. `riskScore` is a nullable 1:1, so an
  // unscored listing simply doesn't match rather than erroring.
  riskLevel: { schema: csvEnum(RISK_LEVELS), where: (v) => ({ riskScore: { is: { level: { in: v } } } }) },
}

// Zod shape (all optional) to spread into the list/pins/count query schemas.
export function filterQueryShape(registry = FILTERS) {
  return Object.fromEntries(
    Object.entries(registry).map(([id, def]) => [id, def.schema.optional()])
  )
}

// Validated query object → array of Prisma where fragments (AND-composed by
// the caller). Falsy booleans and empty values are no-ops.
export function buildFilterWhere(query, registry = FILTERS) {
  const fragments = []
  for (const [id, def] of Object.entries(registry)) {
    const value = query[id]
    if (value === undefined || value === null || value === false || value === '') continue
    if (Array.isArray(value) && value.length === 0) continue
    fragments.push(def.where(value))
  }
  return fragments
}

// Deterministic cache-key part for the active filters in a validated query.
export function filterCacheKey(query, registry = FILTERS) {
  const active = {}
  for (const id of Object.keys(registry).sort()) {
    const value = query[id]
    if (value === undefined || value === null || value === false || value === '') continue
    if (Array.isArray(value) && value.length === 0) continue
    active[id] = Array.isArray(value) ? [...value].sort() : value
  }
  return JSON.stringify(active)
}
