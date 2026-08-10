// Filter schema — the UI-side counterpart of the backend's
// features/properties/filters.registry.js. Filter ids are the contract
// between the two: this file decides how a filter looks (section, control,
// options, which property types it applies to); the backend decides how it
// validates and maps to Prisma. Adding a filter or property type is a config
// change here + one registry entry there — no component or service changes.
import { Building2, Home, LandPlot, BedDouble, Store, Luggage } from 'lucide-react'

// ── Property-type categories (mirror the listing wizard's 6 cards) ─
export const TYPE_CATEGORIES = [
  { id: 'apartment', label: 'Apartment',  types: ['APARTMENT'],                          color: '#0284C7', icon: Building2 },
  { id: 'house',     label: 'House',      types: ['HOUSE', 'VILLA', 'INDEPENDENT_HOUSE'], color: '#16A34A', icon: Home },
  { id: 'pg',        label: 'PG',         types: ['PG'],                                  color: '#7C3AED', icon: BedDouble },
  { id: 'shop',      label: 'Commercial', types: ['COMMERCIAL'],                          color: '#EA580C', icon: Store },
  { id: 'land',      label: 'Land',       types: ['LAND'],                                color: '#B45309', icon: LandPlot },
  { id: 'stay',      label: 'Short stay', types: ['SHORT_STAY'],                          color: '#DB2777', icon: Luggage },
]

// ── Wire format per filter id ──────────────────────────────────────
// kind: csv | csvNum | num | bool | str | date · param: wire name (default: id)
export const PARAM_DEFS = {
  types:          { param: 'type', kind: 'csv', def: [] },
  city:           { kind: 'str',    def: '' },
  // Rent / Lease / Buy. Defaults to RENT — the public map only ever shows one
  // mode at a time, and a lease sum or an asking price must never surface as if
  // it were rent. This default is also why Buy needs a visible toggle: without
  // one, no sale listing could ever be reached.
  // Admin overrides the default to '' (all modes) in config/adminFilters.js.
  pricingModel:   { kind: 'str',    def: 'RENT' },
  rentMin:        { kind: 'num',    def: null },
  rentMax:        { kind: 'num',    def: null },
  depositMax:     { kind: 'num',    def: null },
  maintenanceMax: { kind: 'num',    def: null },
  bhk:            { kind: 'csvNum', def: [] },
  bathroomsMin:   { kind: 'num',    def: null },
  areaMin:        { kind: 'num',    def: null },
  areaMax:        { kind: 'num',    def: null },
  furnished:      { kind: 'csv',    def: [] },
  facing:         { kind: 'csv',    def: [] },
  floorMax:       { kind: 'num',    def: null },
  availableBy:    { kind: 'date',   def: '' },
  leaseDurationMax: { kind: 'num',  def: null },
  // Buy mode (see the 'sale' section below)
  possessionStatus: { kind: 'csv',    def: [] },
  loanEligible:     { kind: 'bool',   def: false },
  negotiable:       { kind: 'bool',   def: false },
  conversionStatus: { kind: 'csv',    def: [] },
  ecAvailable:      { kind: 'bool',   def: false },
  amenities:      { kind: 'csv',    def: [] },
  // Straight-line metres to the nearest metro station, from the spatial layer's
  // per-cell proximity index. Only the three radii the backend allows.
  nearMetro:      { kind: 'num',    def: null },
  petsAllowed:    { kind: 'bool',   def: false },
  smokingAllowed: { kind: 'bool',   def: false },
  bachelorAllowed:{ kind: 'bool',   def: false },
  familyPreferred:{ kind: 'bool',   def: false },
  nonVegAllowed:  { kind: 'bool',   def: false },
  genderPref:     { kind: 'str',    def: '' },
  sharing:        { kind: 'csvNum', def: [] },
  bedsAvailable:  { kind: 'bool',   def: false },
  noCurfew:       { kind: 'bool',   def: false },
  noticePeriodMax:{ kind: 'num',    def: null },
  commercialType: { kind: 'csv',    def: [] },
  carpetAreaMin:  { kind: 'num',    def: null },
  frontageMin:    { kind: 'num',    def: null },
  landType:       { kind: 'csv',    def: [] },
  approvalStatus: { kind: 'csv',    def: [] },
  saleOrLease:    { kind: 'str',    def: '' },
  roadWidthMin:   { kind: 'num',    def: null },
  placeType:      { kind: 'csv',    def: [] },
  guestsMin:      { kind: 'num',    def: null },
  nightlyMin:     { kind: 'num',    def: null },
  nightlyMax:     { kind: 'num',    def: null },
  stayNights:     { kind: 'num',    def: null },
  instantBook:    { kind: 'bool',   def: false },
  verifiedOnly:   { kind: 'bool',   def: false },
  lowRiskOnly:    { kind: 'bool',   def: false },
  trustBadges:    { kind: 'csv',    def: [] },
  minRecommend:   { kind: 'num',    def: null },
}

// `area` is search context (geocode + fly), never sent as a filter param.
export const DEFAULT_FILTERS = {
  area: '',
  ...Object.fromEntries(Object.entries(PARAM_DEFS).map(([id, d]) => [id, d.def])),
}

// city/area are set by search, not the filter modal — modal Reset keeps them.
export const SEARCH_KEYS = ['city', 'area']

// The `defs` argument on the helpers below exists so the admin panel can reuse
// this whole module with its own superset (config/adminFilters.js adds status +
// riskLevel). Defaults to PARAM_DEFS, so every existing user-side caller is
// unchanged. Mirrors the backend registry's `registry = FILTERS` argument.
function isDefault(id, value, defs = PARAM_DEFS) {
  const def = defs[id]?.def
  if (Array.isArray(def)) return !value || value.length === 0
  return value === def || value === null || value === undefined || value === '' || value === false
}

// filterStore state → API query params (also the URL param format)
export function toQueryParams(filters, defs = PARAM_DEFS) {
  const params = {}
  for (const [id, def] of Object.entries(defs)) {
    const value = filters[id]
    if (isDefault(id, value, defs)) continue
    const key = def.param ?? id
    if (def.kind === 'csv' || def.kind === 'csvNum') params[key] = value.join(',')
    else if (def.kind === 'bool') params[key] = 'true'
    else params[key] = String(value)
  }
  return params
}

// URLSearchParams → partial filterStore patch (inverse of toQueryParams)
export function parseFiltersFromSearch(searchParams, defs = PARAM_DEFS) {
  const patch = {}
  for (const [id, def] of Object.entries(defs)) {
    const raw = searchParams.get(def.param ?? id)
    if (raw === null || raw === '') continue
    if (def.kind === 'csv') patch[id] = raw.split(',').filter(Boolean)
    else if (def.kind === 'csvNum') patch[id] = raw.split(',').map(Number).filter((n) => Number.isFinite(n))
    else if (def.kind === 'num') { const n = Number(raw); if (Number.isFinite(n)) patch[id] = n }
    else if (def.kind === 'bool') patch[id] = raw === 'true' || raw === '1'
    else patch[id] = raw
  }
  return patch
}

// Count of active filters (search context excluded) — powers button badges.
export function countActiveFilters(filters, defs = PARAM_DEFS) {
  let count = 0
  for (const id of Object.keys(defs)) {
    if (SEARCH_KEYS.includes(id)) continue
    if (!isDefault(id, filters[id], defs)) count++
  }
  return count
}

// ── Option lists ───────────────────────────────────────────────────
const BHK_OPTIONS = [
  { value: 0, label: 'Studio' }, { value: 1, label: '1 BHK' }, { value: 2, label: '2 BHK' },
  { value: 3, label: '3 BHK' }, { value: 4, label: '4+ BHK' },
]
const FURNISHED_OPTIONS = [
  { value: 'FULLY', label: 'Fully furnished' }, { value: 'SEMI', label: 'Semi furnished' },
  { value: 'UNFURNISHED', label: 'Unfurnished' },
]
const FACING_OPTIONS = ['EAST', 'WEST', 'NORTH', 'SOUTH'].map((v) => ({ value: v, label: v[0] + v.slice(1).toLowerCase() }))
// Names must exist in backend/prisma/amenities.js and be offered by at least
// one wizard chip (FEATURES in features/listings/config/onboarding.js), or the
// filter matches nothing — 'Gated Security' sat here for months doing exactly
// that, because no chip ever offered it. Guarded by check-amenities.mjs now.
const CORE_AMENITIES = [
  'WiFi', 'Parking', 'Covered Parking', 'Visitor Parking', 'Two-wheeler Parking', 'EV Charging',
  'Lift', 'AC', 'Air Cooler', 'Power Backup', 'Solar Panel', 'CCTV', 'Security Guard',
  'Intercom', 'Video Door Phone', 'Gated Community', 'Fire Safety',
  'Balcony', 'Terrace', 'Garden', 'Gym', 'Swimming Pool', 'Club House',
  'Play Area', 'Jogging Track', 'Indoor Games', 'Badminton Court', 'Party Hall', 'Creche',
  'Kitchen', 'Modular Kitchen', 'Washing Machine', 'Gas Pipeline', 'Geyser',
  'Water Purifier', 'Water Supply', 'Water Tank', 'Borewell', 'Rainwater Harvesting',
  'Solar Water Heater', 'Servant Room', 'Wheelchair Accessible', 'Waste Management',
  'Housekeeping', 'Pet Friendly',
  // Furnishing items — this section covers HOMES + PG + SHORT_STAY, all three
  // of which can come furnished, so they live here rather than duplicated
  // across each type's own row.
  'Fridge', 'Microwave', 'Sofa', 'Bed', 'Wardrobe', 'Dining Table',
].map((v) => ({ value: v, label: v }))
const asOptions = (list) => list.map((v) => ({ value: v, label: v }))

// ── Sections ───────────────────────────────────────────────────────
// types: null → universal · array + requiresType → only when that type is
// explicitly selected · array without requiresType → hidden only when the
// selection excludes every listed type. Rows may carry their own `types`
// for finer gating within a visible section (same rule); a section whose
// rows are all hidden is skipped entirely.
const HOMES = ['APARTMENT', 'HOUSE', 'VILLA', 'INDEPENDENT_HOUSE']
const HOME_TYPES = [...HOMES, 'SHORT_STAY']

// Mirrors the backend's LEASE_ELIGIBLE_TYPES (properties.validation.js): PG
// prices per bed, SHORT_STAY per night, LAND carries its own saleOrLease —
// none of them can be leased, so lease mode never offers them.
export const LEASE_TYPES = [...HOMES, 'COMMERCIAL']
export const LEASE_CATEGORY_IDS = ['apartment', 'house', 'shop']

// Mirrors the backend's SALE_ELIGIBLE_TYPES: anything with a title deed behind
// it. A PG bed and a nightly stay are operating businesses, not assets someone
// browsing here buys, so Buy mode never offers them.
export const SALE_TYPES = [...HOMES, 'COMMERCIAL', 'LAND']
export const SALE_CATEGORY_IDS = ['apartment', 'house', 'shop', 'land']

export const FILTER_SECTIONS = [
  {
    id: 'budget', label: 'Budget', types: null, defaultOpen: true,
    rows: [
      {
        // Residential scale only — COMMERCIAL (lakh-scale rents), LAND
        // (crore-scale prices) and SHORT_STAY (nightly) each price in their
        // own section, reusing the same rentMin/rentMax ids
        kind: 'range', label: 'Monthly rent', unit: '₹', idMin: 'rentMin', idMax: 'rentMax',
        types: [...HOMES, 'PG'], modes: ['RENT'],
        slider: { min: 0, max: 500000, step: 2500 },
        chips: [
          { label: 'Under ₹10k', min: null, max: 10000 }, { label: '₹10–20k', min: 10000, max: 20000 },
          { label: '₹20–35k', min: 20000, max: 35000 }, { label: '₹35–60k', min: 35000, max: 60000 },
          { label: '₹60k–1L', min: 60000, max: 100000 }, { label: '₹1L+', min: 100000, max: null },
        ],
      },
      {
        // Lease mode's budget row — same rentMin/rentMax ids, lakh scale,
        // because on a LEASE listing `rent` holds the one-time lump sum.
        // Only one of these two rows is ever visible (see matchesMode).
        kind: 'range', label: 'Lease amount', unit: '₹', idMin: 'rentMin', idMax: 'rentMax',
        types: LEASE_TYPES, modes: ['LEASE'],
        slider: { min: 0, max: 5000000, step: 50000 },
        chips: [
          { label: 'Under ₹2L', min: null, max: 200000 }, { label: '₹2–5L', min: 200000, max: 500000 },
          { label: '₹5–10L', min: 500000, max: 1000000 }, { label: '₹10–25L', min: 1000000, max: 2500000 },
          { label: '₹25L+', min: 2500000, max: null },
        ],
      },
      {
        // Buy mode's budget row — same rentMin/rentMax ids again, crore scale,
        // because on a SALE listing `rent` holds the asking price. Exactly one
        // of these three rows is ever visible (see matchesMode).
        kind: 'range', label: 'Budget', unit: '₹', idMin: 'rentMin', idMax: 'rentMax',
        types: SALE_TYPES, modes: ['SALE'],
        slider: { min: 0, max: 100000000, step: 500000 },
        chips: [
          { label: 'Under ₹50L', min: null, max: 5000000 }, { label: '₹50L–1Cr', min: 5000000, max: 10000000 },
          { label: '₹1–2Cr', min: 10000000, max: 20000000 }, { label: '₹2–5Cr', min: 20000000, max: 50000000 },
          { label: '₹5Cr+', min: 50000000, max: null },
        ],
      },
      // Deposit is meaningless on a lease — the lump sum IS the money at stake.
      { kind: 'chips', label: 'Max deposit', id: 'depositMax', single: true, types: [...HOMES, 'PG'], modes: ['RENT'], options: [{ value: 25000, label: 'Up to ₹25k' }, { value: 50000, label: '₹50k' }, { value: 100000, label: '₹1L' }, { value: 200000, label: '₹2L' }] },
      { kind: 'chips', label: 'Max maintenance / mo', id: 'maintenanceMax', single: true, types: HOMES, options: [{ value: 1000, label: 'Up to ₹1k' }, { value: 2000, label: '₹2k' }, { value: 5000, label: '₹5k' }] },
    ],
  },
  {
    // Buy-only. The three questions an Indian buyer asks before they ask
    // anything else — and the two land-record facts that decide whether a plot
    // is even financeable.
    id: 'sale', label: 'Buying', types: null, modes: ['SALE'], defaultOpen: true,
    rows: [
      {
        kind: 'chips', label: 'Possession', id: 'possessionStatus', types: SALE_TYPES,
        options: [
          { value: 'Ready to move', label: 'Ready to move' },
          { value: 'Under construction', label: 'Under construction' },
          { value: 'New launch', label: 'New launch' },
        ],
      },
      {
        kind: 'toggles', types: SALE_TYPES, items: [
          { id: 'loanEligible', label: 'Bank loan available', hint: 'B-khata and unconverted land are routinely refused' },
          { id: 'negotiable', label: 'Price negotiable' },
        ],
      },
      {
        // Unconverted agricultural land cannot be built on, and a plot with no
        // encumbrance certificate is one a lawyer will stop at. Land only.
        kind: 'chips', label: 'Land use', id: 'conversionStatus', types: ['LAND'],
        options: [
          { value: 'Converted', label: 'Converted' },
          { value: 'Not converted', label: 'Not converted' },
          { value: 'Not applicable', label: 'Already a layout' },
        ],
      },
      {
        kind: 'toggles', types: ['LAND'], items: [
          { id: 'ecAvailable', label: 'Encumbrance certificate on hand', hint: 'Shows the title is free of loans and disputes' },
        ],
      },
    ],
  },
  {
    id: 'rooms', label: 'Rooms & size', types: HOME_TYPES, defaultOpen: true,
    rows: [
      { kind: 'chips', label: 'Bedrooms', id: 'bhk', options: BHK_OPTIONS },
      { kind: 'chips', label: 'Bathrooms', id: 'bathroomsMin', single: true, options: [{ value: 1, label: '1+' }, { value: 2, label: '2+' }, { value: 3, label: '3+' }] },
      { kind: 'chips', label: 'Furnishing', id: 'furnished', options: FURNISHED_OPTIONS, types: HOMES },
      { kind: 'range', label: 'Built-up area', unit: 'sq.ft', idMin: 'areaMin', idMax: 'areaMax', types: HOMES, slider: { min: 0, max: 5000, step: 100 } },
      { kind: 'chips', label: 'Facing', id: 'facing', options: FACING_OPTIONS, types: HOMES },
      { kind: 'chips', label: 'Highest floor', id: 'floorMax', single: true, types: ['APARTMENT'], options: [{ value: 0, label: 'Ground only' }, { value: 2, label: 'Up to 2nd' }, { value: 5, label: 'Up to 5th' }, { value: 10, label: 'Up to 10th' }] },
    ],
  },
  {
    id: 'availability', label: 'Availability', types: [...HOMES, 'PG', 'COMMERCIAL'],
    rows: [
      { kind: 'date', label: 'Move-in by', id: 'availableBy' },
      { kind: 'chips', label: 'Max lease duration', id: 'leaseDurationMax', single: true, options: [{ value: 6, label: '6 months' }, { value: 11, label: '11 months' }, { value: 12, label: '1 year' }, { value: 24, label: '2 years' }] },
      // MOVED out of the PG section 2026-08-10. It sat inside 'pg', which is
      // requiresType, so it only appeared once somebody had selected PG — yet
      // the backend filter was never type-gated and flats, houses and shops can
      // now state a notice period too. This section is already scoped to HOMES
      // + PG + COMMERCIAL, which is exactly the set that has one.
      { kind: 'chips', label: 'Max notice period', id: 'noticePeriodMax', single: true, options: [{ value: 15, label: '15 days' }, { value: 30, label: '1 month' }, { value: 60, label: '2 months' }] },
    ],
  },
  {
    // LAND and COMMERCIAL have their own feature chips in their sections
    id: 'amenities', label: 'Amenities', types: [...HOMES, 'PG', 'SHORT_STAY'],
    rows: [{ kind: 'chips', id: 'amenities', options: CORE_AMENITIES, searchable: true, withIcons: true }],
  },
  {
    id: 'preferences', label: 'Who it’s for', types: [...HOMES, 'PG'],
    rows: [
      { kind: 'chips', label: 'Tenant gender', id: 'genderPref', single: true, options: [{ value: 'MALE', label: 'Male' }, { value: 'FEMALE', label: 'Female' }] },
      {
        kind: 'toggles', items: [
          { id: 'familyPreferred', label: 'Family friendly' },
          { id: 'bachelorAllowed', label: 'Bachelors allowed' },
          { id: 'petsAllowed', label: 'Pets allowed' },
          { id: 'smokingAllowed', label: 'Smoking allowed' },
          { id: 'nonVegAllowed', label: 'Non-veg allowed' },
        ],
      },
    ],
  },
  {
    id: 'pg', label: 'PG options', types: ['PG'], requiresType: true, defaultOpen: true,
    rows: [
      { kind: 'chips', label: 'Sharing', id: 'sharing', options: [{ value: 1, label: 'Single' }, { value: 2, label: 'Double' }, { value: 3, label: 'Triple' }, { value: 4, label: '4+' }] },
      { kind: 'chips', label: 'Food & services', id: 'amenities', withIcons: true, options: asOptions(['Breakfast', 'Lunch', 'Dinner', 'Laundry', 'Housekeeping', 'WiFi', 'AC', 'Attached Bath', 'Study Desk']) },
      { kind: 'toggles', items: [{ id: 'bedsAvailable', label: 'Beds available now' }, { id: 'noCurfew', label: 'No curfew' }] },
    ],
  },
  {
    id: 'commercial', label: 'Commercial', types: ['COMMERCIAL'], requiresType: true, defaultOpen: true,
    rows: [
      {
        // modes: RENT only — a leased shop prices via the Budget section's
        // lease row, which owns the same rentMin/rentMax ids.
        kind: 'range', label: 'Monthly rent', unit: '₹', idMin: 'rentMin', idMax: 'rentMax',
        modes: ['RENT'],
        slider: { min: 0, max: 1000000, step: 5000 },
        chips: [
          { label: 'Under ₹50k', min: null, max: 50000 }, { label: '₹50k–1L', min: 50000, max: 100000 },
          { label: '₹1–2.5L', min: 100000, max: 250000 }, { label: '₹2.5–5L', min: 250000, max: 500000 },
          { label: '₹5L+', min: 500000, max: null },
        ],
      },
      { kind: 'chips', label: 'Max deposit', id: 'depositMax', single: true, options: [{ value: 100000, label: 'Up to ₹1L' }, { value: 500000, label: '₹5L' }, { value: 1000000, label: '₹10L' }, { value: 2500000, label: '₹25L' }] },
      { kind: 'chips', label: 'Max maintenance / mo', id: 'maintenanceMax', single: true, options: [{ value: 5000, label: 'Up to ₹5k' }, { value: 10000, label: '₹10k' }, { value: 25000, label: '₹25k' }] },
      { kind: 'chips', label: 'Space type', id: 'commercialType', options: asOptions(['Retail shop', 'Office', 'Showroom', 'Warehouse']) },
      { kind: 'chips', label: 'Min carpet area', id: 'carpetAreaMin', single: true, options: [{ value: 250, label: '250+ sq.ft' }, { value: 500, label: '500+' }, { value: 1000, label: '1000+' }, { value: 2000, label: '2000+' }] },
      { kind: 'chips', label: 'Min frontage', id: 'frontageMin', single: true, options: [{ value: 10, label: '10+ ft' }, { value: 20, label: '20+ ft' }, { value: 40, label: '40+ ft' }] },
      { kind: 'chips', label: 'Facilities', id: 'amenities', withIcons: true, options: asOptions(['Washroom', '3-Phase Power', 'Power Backup', 'Roll-down Shutter', 'Mezzanine', 'Signage Space', 'Near Main Road', 'Parking', 'Visitor Parking', 'Lift', 'AC', 'CCTV', 'Fire Safety', 'Water Supply', 'Corner Plot', 'Wheelchair Accessible']) },
    ],
  },
  {
    id: 'land', label: 'Land', types: ['LAND'], requiresType: true, defaultOpen: true,
    rows: [
      {
        kind: 'range', label: 'Price', unit: '₹', idMin: 'rentMin', idMax: 'rentMax',
        chips: [
          { label: 'Under ₹10L', min: null, max: 1000000 }, { label: '₹10–25L', min: 1000000, max: 2500000 },
          { label: '₹25–50L', min: 2500000, max: 5000000 }, { label: '₹50L–1Cr', min: 5000000, max: 10000000 },
          { label: '₹1Cr+', min: 10000000, max: null },
        ],
      },
      { kind: 'chips', label: 'Land type', id: 'landType', options: asOptions(['Residential', 'Agricultural', 'Commercial', 'Industrial']) },
      { kind: 'chips', label: 'Approval', id: 'approvalStatus', options: asOptions(['DTCP', 'RERA', 'Panchayat', 'Unapproved']) },
      { kind: 'chips', label: 'Sale or lease', id: 'saleOrLease', single: true, options: [{ value: 'SALE', label: 'Sale' }, { value: 'LEASE', label: 'Lease' }] },
      { kind: 'chips', label: 'Plot facing', id: 'facing', options: FACING_OPTIONS },
      { kind: 'chips', label: 'Min road width', id: 'roadWidthMin', single: true, options: [{ value: 20, label: '20+ ft' }, { value: 30, label: '30+ ft' }, { value: 40, label: '40+ ft' }] },
      { kind: 'chips', label: 'Plot features', id: 'amenities', withIcons: true, options: asOptions(['Corner Plot', 'Boundary Wall', 'Gated Community', 'Borewell', 'East Facing', 'Near Main Road', 'Ready to Build', 'Water Supply']) },
    ],
  },
  {
    id: 'stay', label: 'Short stay', types: ['SHORT_STAY'], requiresType: true, defaultOpen: true,
    rows: [
      { kind: 'chips', label: 'Place type', id: 'placeType', options: asOptions(['Entire place', 'Private room', 'Shared room']) },
      { kind: 'chips', label: 'Guests', id: 'guestsMin', single: true, options: [{ value: 2, label: '2+' }, { value: 4, label: '4+' }, { value: 6, label: '6+' }] },
      { kind: 'range', label: 'Nightly rate', unit: '₹', idMin: 'nightlyMin', idMax: 'nightlyMax', slider: { min: 0, max: 20000, step: 250 } },
      { kind: 'chips', label: 'Nights you’ll stay', id: 'stayNights', single: true, options: [{ value: 2, label: '2 nights' }, { value: 3, label: '3 nights' }, { value: 7, label: '1 week' }, { value: 30, label: '1 month' }] },
      { kind: 'toggles', items: [{ id: 'instantBook', label: 'Instant booking' }] },
      { kind: 'chips', label: 'Stay features', id: 'amenities', withIcons: true, options: asOptions(['TV', 'Workspace', 'Kitchen', 'AC', 'WiFi', 'Beachfront']) },
    ],
  },
  {
    // Every listing has a location, so this is never type-gated. Excluded for
    // LAND deliberately: a plot is bought to build on, and "walkable to a
    // metro" is a renter's question, not a buyer's.
    id: 'location', label: 'Getting around', types: [...HOMES, 'PG', 'SHORT_STAY', 'COMMERCIAL'],
    rows: [
      {
        // Labelled in DISTANCE, never in minutes. The number behind it is a
        // straight line between two points — calling it "a 10 minute walk"
        // would be the assumption deleted from the backend's proximity.js
        // wearing a friendlier face. A reader can judge 800 m for themselves;
        // they cannot judge a walk time we invented.
        //
        // Three fixed radii, matching PROXIMITY_RADII on the server. A free
        // slider would imply a precision haversine does not have.
        kind: 'chips', label: 'Distance to a metro station', id: 'nearMetro', single: true,
        options: [
          { value: 800,  label: 'Within 800 m' },
          { value: 1500, label: 'Within 1.5 km' },
          { value: 3000, label: 'Within 3 km' },
        ],
      },
    ],
  },
  {
    id: 'trust', label: 'Trust & safety', types: null,
    rows: [
      {
        kind: 'toggles', items: [
          { id: 'verifiedOnly', label: 'Verified properties only', hint: 'Ownership documents reviewed by StayOnMap' },
          { id: 'lowRiskOnly', label: 'Low risk only', hint: 'No open complaints or fraud signals' },
        ],
      },
      {
        kind: 'chips', label: 'Trust badge', id: 'trustBadges', options: [
          { value: 'VERIFIED_OWNER', label: 'Verified owner' },
          { value: 'COMMUNITY_TRUSTED', label: 'Community trusted' },
          { value: 'HIGHLY_RECOMMENDED', label: 'Highly recommended' },
        ],
      },
      { kind: 'chips', label: 'Recommended by locals', id: 'minRecommend', single: true, options: [{ value: 70, label: '70%+' }, { value: 90, label: '90%+' }] },
    ],
  },
]

const intersects = (a, b) => a.some((v) => b.includes(v))

// Shared visibility rule for sections and rows: no `types` → always visible;
// empty selection → generic view shows everything non-requiresType.
function matchesTypes(types, selectedTypes) {
  if (!types) return true
  return selectedTypes.length === 0 || intersects(selectedTypes, types)
}

// Second, independent gate: a row may declare `modes: ['LEASE']` to appear
// only in that pricing mode. Needed because Rent and Lease price on totally
// different scales (₹28k/mo vs ₹8L once) while sharing the rentMin/rentMax
// ids — so exactly one budget row may ever be visible at a time.
// `mode` falls back to RENT everywhere, which keeps every pre-lease caller
// (and admin's "all modes" default) rendering the monthly-rent row as before.
function matchesMode(modes, mode) {
  if (!modes) return true
  return modes.includes(mode || 'RENT')
}

export function visibleRows(section, selectedTypes, mode = 'RENT') {
  return section.rows.filter((row) => matchesTypes(row.types, selectedTypes) && matchesMode(row.modes, mode))
}

// Which sections to render for the current property-type selection —
// a section whose rows are all type-gated away is skipped entirely.
// `sections` is overridable so the admin panel can pass its own superset.
export function visibleSections(selectedTypes, sections = FILTER_SECTIONS, mode = 'RENT') {
  return sections.filter((section) => {
    if (section.requiresType) {
      if (!intersects(selectedTypes, section.types)) return false
    } else if (!matchesTypes(section.types, selectedTypes)) return false
    if (!matchesMode(section.modes, mode)) return false
    return visibleRows(section, selectedTypes, mode).length > 0
  })
}

// All filter ids a section's visible rows touch — powers per-section badges
// and clearing. Pass selectedTypes to respect row-level gating; omit for the
// section's full id set.
function rowFilterIds(row) {
  if (row.kind === 'range') return [row.idMin, row.idMax]
  if (row.kind === 'toggles') return row.items.map((t) => t.id)
  return [row.id]
}

export function sectionFilterIds(section, selectedTypes = [], mode = 'RENT') {
  const rows = selectedTypes.length ? visibleRows(section, selectedTypes, mode) : section.rows
  return [...new Set(rows.flatMap(rowFilterIds))]
}

// Switching Rent ↔ Lease must reset every mode-gated row's filters. The two
// budget rows share rentMin/rentMax on wildly different scales, so a leftover
// "under ₹35k" from rent mode would silently return zero lease results.
export function modeChangePatch(sections = FILTER_SECTIONS, defs = PARAM_DEFS) {
  const patch = {}
  for (const section of sections) {
    for (const row of section.rows) {
      if (!row.modes) continue
      for (const id of rowFilterIds(row)) patch[id] = defs[id].def
    }
  }
  return patch
}

export function countSectionActive(section, filters, defs = PARAM_DEFS) {
  return sectionFilterIds(section, filters.types ?? [], filters.pricingModel)
    .filter((id) => !isDefault(id, filters[id], defs)).length
}

export function clearSectionPatch(section, selectedTypes = [], defs = PARAM_DEFS, mode = 'RENT') {
  return Object.fromEntries(sectionFilterIds(section, selectedTypes, mode).map((id) => [id, defs[id].def]))
}

// When the property-type selection changes, filters whose rows are no longer
// visible must be reset — otherwise an invisible PG filter (e.g. sharing)
// would keep constraining an Apartment search to zero results. Ids still
// reachable through any visible row (e.g. amenities) are kept.
export function staleFilterPatch(newTypes, sections = FILTER_SECTIONS, defs = PARAM_DEFS, mode = 'RENT') {
  const visible = visibleSections(newTypes, sections, mode)
  const visibleIds = new Set(visible.flatMap((s) => sectionFilterIds(s, newTypes, mode)))
  const patch = {}
  for (const section of sections) {
    for (const id of sectionFilterIds(section)) {
      if (!visibleIds.has(id)) patch[id] = defs[id].def
    }
  }
  return patch
}
