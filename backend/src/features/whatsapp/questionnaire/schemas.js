// The six questionnaires — one per listing category, declared as data.
//
// This is the property-type table CLAUDE.md asks for (the same pattern as
// features/spatial/propertyTypes.js): what is asked, in what order, and what
// is required, is DECLARED here per type, not decided by conditionals in the
// engine. A plot is never asked how many bathrooms it has; a PG is never asked
// how many bedrooms.
//
// The engine (engine.js) is channel-agnostic — it only knows question types
// and answers — so the same schemas can drive a web form or the mobile wizard.
// The WhatsApp-specific half (which questions become buttons, the wording of a
// prompt) lives in ../copy.js.
//
// A question:
//   id        unique within the category; the engine's cursor (currentQuestion)
//   field     where the answer is stored in draft.fields (or draft.location /
//             draft.photos for the two special kinds)
//   label     the question as asked
//   type      text | number | currency | single_select | multi_select | boolean
//             | date | time | location | image | phone | confirmation
//   validate  (value, fields) => error string | null — a cross-field check the
//             per-question min/max cannot express (a window's end after its start)
//   required  the listing cannot publish without it
//   options   [{ value, label, description? }] for the select kinds
//   min/max   numeric bounds, mirrored from properties.validation.js so an
//             answer that would fail the server schema is refused HERE with a
//             sentence rather than at publish with a Zod error
//   help      one line under the question
//   showIf    (fields) => boolean — conditional visibility
//   section   which review-time "Edit" group the question belongs to
//
// Field names are the REAL Property columns (createPropertySchema) wherever
// one exists. The handful that are not columns — parking, foodIncluded,
// checkIn, extras — are folded into amenities / rules / the description by
// normalize.js, which is the only place that mapping lives.
import { VISIT_CONTACT_METHODS } from '../../properties/properties.validation.js'

export const CATEGORIES = {
  apartment: { type: 'APARTMENT',  label: 'Apartment / Flat',       emoji: '🏠', tier: 'free' },
  house:     { type: 'HOUSE',      label: 'House / Villa',          emoji: '🏡', tier: 'free' },
  land:      { type: 'LAND',       label: 'Land / Plot',            emoji: '🌳', tier: 'free' },
  pg:        { type: 'PG',         label: 'PG / Co-living',         emoji: '🛏', tier: 'biz' },
  shop:      { type: 'COMMERCIAL', label: 'Commercial / Shop',      emoji: '🏪', tier: 'biz' },
  stay:      { type: 'SHORT_STAY', label: 'Short stay / Homestay',  emoji: '🏨', tier: 'biz' },
}

export const CATEGORY_KEYS = Object.keys(CATEGORIES)

// Shared option lists. Values are what the Property column stores.
const FURNISHED = [
  { value: 'FULLY',       label: 'Fully furnished' },
  { value: 'SEMI',        label: 'Semi furnished' },
  { value: 'UNFURNISHED', label: 'Unfurnished' },
]
const FACING = ['EAST', 'WEST', 'NORTH', 'SOUTH'].map((v) => ({ value: v, label: v[0] + v.slice(1).toLowerCase() }))
const YES_NO = [{ value: true, label: 'Yes' }, { value: false, label: 'No' }]
const BHK = [
  { value: 0, label: 'Studio / 1 RK' }, { value: 1, label: '1 BHK' }, { value: 2, label: '2 BHK' },
  { value: 3, label: '3 BHK' }, { value: 4, label: '4 BHK' }, { value: 5, label: '5 BHK+' },
]

// Amenity chips per category — MUST be names in backend/prisma/amenities.js;
// normalize.js resolves them to ids and drops anything unknown. Kept short:
// on WhatsApp a list of 35 chips is a wall, and these are the ones renters
// actually filter on.
const AMENITIES = {
  apartment: ['WiFi', 'AC', 'Lift', 'Covered Parking', 'Two-wheeler Parking', 'Power Backup', 'Gym', 'Swimming Pool', 'Security Guard', 'CCTV', 'Gated Community', 'Modular Kitchen', 'Balcony', 'Geyser', 'Water Supply'],
  house:     ['Garden', 'Terrace', 'Gated Community', 'Power Backup', 'Borewell', 'Water Supply', 'Geyser', 'Covered Parking', 'Two-wheeler Parking', 'Modular Kitchen', 'Balcony', 'CCTV', 'Security Guard', 'AC', 'WiFi'],
  land:      ['Corner Plot', 'Boundary Wall', 'Borewell', 'Gated Community', 'Near Main Road', 'Ready to Build', 'Water Supply'],
  pg:        ['WiFi', 'AC', 'Laundry', 'Housekeeping', 'Power Backup', 'Study Desk', 'Attached Bath', 'Geyser', 'Water Purifier', 'Fridge', 'Washing Machine', 'CCTV', 'Security Guard'],
  shop:      ['Washroom', 'Parking', 'Near Main Road', 'Corner Plot', '3-Phase Power', 'Power Backup', 'Roll-down Shutter', 'Signage Space', 'Lift', 'AC', 'CCTV'],
  stay:      ['WiFi', 'AC', 'Kitchen', 'Swimming Pool', 'Parking', 'Washing Machine', 'TV', 'Workspace', 'Geyser', 'Fridge', 'Microwave', 'Pet Friendly'],
}
const amenityOptions = (key) => AMENITIES[key].map((name) => ({ value: name, label: name }))

// The common tail: extra details and photos, identical for all six.
const DETAILS = { id: 'details', field: 'details', label: 'Anything else a renter should know? (or say *skip*)', type: 'text', required: false, max: 1500, section: 'description' }
const PHOTOS  = { id: 'photos',  field: 'photos',  label: 'Send photos of the property', type: 'image', required: true, min: 1, max: 10, section: 'photos' }
const LOCATION = { id: 'location', field: 'location', label: 'Share the exact property location', type: 'location', required: true, section: 'location' }

// ── The closing questions: how to arrange a visit (added 2026-09-02) ──────
// Asked LAST, after the photos, because they are about the owner rather than
// the property, and an owner who has just finished describing their flat is
// the right person to say when they can show it.
//
// The window is the SAME pair of columns the web wizard's "Visits from / until"
// writes, and the booking form on both platforms offers only slots inside it
// (appointments.service.js now refuses one outside it too). Required here,
// where the web wizard leaves it optional: a listing that arrives with no
// window lets a renter pick 9 PM and puts the awkward "no" on the owner.
//
// SHORT_STAY has no viewing slot — it is booked as a date range — so a stay
// gets the contact question only. Every other type gets all three.
const VISIT_CONTACT_LABELS = { CALL: 'Phone call', WHATSAPP: 'WhatsApp message', CHAT: 'Message in the app' }
const VISIT_CONTACT_Q = { id: 'visitContact', field: 'visitContact', label: 'How should renters contact you to arrange a visit?', type: 'single_select', required: true, section: 'visits',
  options: VISIT_CONTACT_METHODS.map((value) => ({ value, label: VISIT_CONTACT_LABELS[value] })) }
const VISIT_FROM_Q = { id: 'visitFrom', field: 'appointmentWindowStart', label: 'From what time can renters visit on a typical day? (e.g. 10 AM)', type: 'time', required: true, section: 'visits',
  help: 'Visits can be between 9 AM and 8 PM. Renters will only be able to book inside your window.',
  validate: (v, f) => (f.appointmentWindowEnd && v >= f.appointmentWindowEnd ? 'That is not before your end time — pick an earlier start, or change the end time first.' : null) }
const VISIT_UNTIL_Q = { id: 'visitUntil', field: 'appointmentWindowEnd', label: 'Until what time? (e.g. 6 PM)', type: 'time', required: true, section: 'visits',
  validate: (v, f) => (f.appointmentWindowStart && v <= f.appointmentWindowStart ? 'That is not after your start time — pick a later end.' : null) }
const VISIT_QS = [VISIT_CONTACT_Q, VISIT_FROM_Q, VISIT_UNTIL_Q]
const STAY_VISIT_QS = [VISIT_CONTACT_Q]

const RULES_RESIDENTIAL = [
  { value: 'bachelorAllowed', label: 'Bachelors allowed' },
  { value: 'familyPreferred', label: 'Families preferred' },
  { value: 'petsAllowed',     label: 'Pets allowed' },
  { value: 'nonVegAllowed',   label: 'Non-veg allowed' },
  { value: 'smokingAllowed',  label: 'Smoking allowed' },
]

// ── Pricing mode (flats / houses / shops) ─────────────────────────────────
// Mirrors the web wizard's LEASE_CATEGORIES/SALE_CATEGORIES: PG prices per
// bed, stay per night, land carries its own saleOrLease — none get this
// question. Asked BEFORE rent, because the answer changes what every money
// question after it MEANS (see PricingModel in schema.prisma).
const PRICING_MODE = { id: 'pricingModel', field: 'pricingModel', label: 'How are you offering it?', type: 'single_select', required: true, section: 'price', options: [
  { value: 'RENT',  label: 'Monthly rent' },
  { value: 'LEASE', label: 'Lease (lump sum)' },
  { value: 'SALE',  label: 'For sale' },
] }
const notSale  = (f) => f.pricingModel !== 'SALE'
const saleOnly = (f) => f.pricingModel === 'SALE'

// Two rent questions sharing ONE field: a sale price runs to crores
// (max mirrors MAX_PRICE) while rent/lease is capped at MAX_RENT — a static
// per-question max cannot serve both, and the server refine that separates
// them would surface as a publish-time error instead of a sentence here.
const RENT_Q = { id: 'rent', field: 'rent', label: 'Monthly rent (₹)?', labelFor: { LEASE: 'Total lease amount (₹)?' }, type: 'currency', required: true, min: 1, max: 10_000_000, section: 'price', showIf: notSale }
const SALE_PRICE_Q = { id: 'salePrice', field: 'rent', label: 'Asking price (₹)?', type: 'currency', required: true, min: 1, max: 999_999_999, section: 'price', showIf: saleOnly }
// A lease carries no deposit — the lump sum IS the money at stake, and the
// server rejects a lease with one — so the question is hidden, not asked.
const DEPOSIT_Q = { id: 'deposit', field: 'deposit', label: 'Security deposit (₹)?', labelFor: { SALE: 'Booking advance (₹)?' }, type: 'currency', required: true, min: 0, max: 10_000_000, section: 'price', showIf: (f) => f.pricingModel !== 'LEASE' }
const MAINTENANCE_Q = { id: 'maintenance', field: 'maintenance', label: 'Monthly maintenance (₹)? (or *skip*)', type: 'currency', required: false, min: 0, max: 1_000_000, section: 'price' }
const MIN_STAY_Q = { id: 'leaseDuration', field: 'leaseDuration', label: 'Minimum stay in months? (or *skip*)', type: 'number', required: false, min: 1, max: 120, section: 'price', showIf: notSale }
const NOTICE_Q = { id: 'noticePeriodDays', field: 'noticePeriodDays', label: 'Notice period in days? (or *skip*)', type: 'number', required: false, min: 0, max: 180, section: 'price', showIf: notSale }
// The two questions every Indian buyer asks before anything else, plus
// possession — only when selling.
const SALE_TERM_QS = [
  { id: 'possessionStatus', field: 'possessionStatus', label: 'Possession status?', type: 'single_select', required: false, section: 'price', showIf: saleOnly, options: [
    { value: 'Ready to move', label: 'Ready to move' }, { value: 'Under construction', label: 'Under construction' }, { value: 'New launch', label: 'New launch' },
  ] },
  { id: 'priceNegotiable', field: 'priceNegotiable', label: 'Is the price negotiable?', type: 'boolean', required: false, options: YES_NO, section: 'price', showIf: saleOnly },
  { id: 'loanEligible', field: 'loanEligible', label: 'Can a buyer get a bank loan on it?', type: 'boolean', required: false, options: YES_NO, section: 'price', showIf: saleOnly },
]
const FACING_Q = { id: 'facingDirection', field: 'facingDirection', label: 'Which way does it face?', type: 'single_select', required: false, options: FACING, section: 'details' }

export const QUESTIONNAIRES = {
  apartment: [
    LOCATION,
    { id: 'bhk',         field: 'bhk',         label: 'How many bedrooms?',                  type: 'single_select', required: true, options: BHK, section: 'details' },
    PRICING_MODE,
    RENT_Q,
    SALE_PRICE_Q,
    DEPOSIT_Q,
    MAINTENANCE_Q,
    { id: 'furnished',   field: 'furnished',   label: 'Furnishing?',                         type: 'single_select', required: true, options: FURNISHED, section: 'details' },
    { id: 'bathrooms',   field: 'bathrooms',   label: 'How many bathrooms?',                 type: 'number', required: false, min: 0, max: 20, section: 'details' },
    { id: 'area',        field: 'area',        label: 'Built-up area in sq.ft? (or *skip*)', type: 'number', required: false, min: 1, max: 100_000, section: 'details' },
    { id: 'parking',     field: 'parking',     label: 'Is car parking available?',           type: 'boolean', required: false, options: YES_NO, section: 'details' },
    { id: 'floor',       field: 'floor',       label: 'Which floor is the flat on? (0 = ground)', type: 'number', required: false, min: 0, max: 200, section: 'details' },
    { id: 'totalFloors', field: 'totalFloors', label: 'How many floors does the building have?', type: 'number', required: false, min: 1, max: 200, section: 'details' },
    FACING_Q,
    { id: 'availableFrom', field: 'availableFrom', label: 'Available from? (a date, a month, or *immediately*)', labelFor: { SALE: 'Possession from? (a date, or *immediately*)' }, type: 'date', required: false, section: 'price' },
    MIN_STAY_Q,
    NOTICE_Q,
    ...SALE_TERM_QS,
    { id: 'amenities',   field: 'amenities',   label: 'Which amenities does it have?',       type: 'multi_select', required: false, options: amenityOptions('apartment'), section: 'details' },
    { id: 'rules',       field: 'rules',       label: 'House rules — which of these apply?', type: 'multi_select', required: false, options: RULES_RESIDENTIAL, section: 'details' },
    DETAILS,
    PHOTOS,
    ...VISIT_QS,
  ],
  house: [
    LOCATION,
    { id: 'houseStyle',  field: 'houseStyle',  label: 'What kind of house is it?',           type: 'single_select', required: true, section: 'details', options: [
      { value: 'Independent house', label: 'Independent house' }, { value: 'Villa', label: 'Villa' },
      { value: 'Duplex', label: 'Duplex' }, { value: 'Row house', label: 'Row house' },
    ] },
    { id: 'bhk',         field: 'bhk',         label: 'How many bedrooms?',                  type: 'single_select', required: true, options: BHK, section: 'details' },
    PRICING_MODE,
    RENT_Q,
    SALE_PRICE_Q,
    DEPOSIT_Q,
    MAINTENANCE_Q,
    { id: 'furnished',   field: 'furnished',   label: 'Furnishing?',                         type: 'single_select', required: true, options: FURNISHED, section: 'details' },
    { id: 'bathrooms',   field: 'bathrooms',   label: 'How many bathrooms?',                 type: 'number', required: false, min: 0, max: 20, section: 'details' },
    { id: 'parking',     field: 'parking',     label: 'Is car parking available?',           type: 'boolean', required: false, options: YES_NO, section: 'details' },
    { id: 'area',        field: 'area',        label: 'Built-up area in sq.ft?',             type: 'number', required: false, min: 1, max: 100_000, section: 'details' },
    { id: 'extent',      field: 'extent',      label: 'Plot area in sq.ft?',                 type: 'number', required: false, min: 1, max: 10_000_000, section: 'details' },
    { id: 'totalFloors', field: 'totalFloors', label: 'How many floors?',                    type: 'number', required: false, min: 1, max: 200, section: 'details' },
    FACING_Q,
    { id: 'availableFrom', field: 'availableFrom', label: 'Available from? (a date, a month, or *immediately*)', labelFor: { SALE: 'Possession from? (a date, or *immediately*)' }, type: 'date', required: false, section: 'price' },
    MIN_STAY_Q,
    NOTICE_Q,
    ...SALE_TERM_QS,
    { id: 'amenities',   field: 'amenities',   label: 'Which features does it have?',        type: 'multi_select', required: false, options: amenityOptions('house'), section: 'details' },
    { id: 'rules',       field: 'rules',       label: 'House rules — which of these apply?', type: 'multi_select', required: false, options: RULES_RESIDENTIAL, section: 'details' },
    DETAILS,
    PHOTOS,
    ...VISIT_QS,
  ],
  land: [
    { id: 'saleOrLease', field: 'saleOrLease', label: 'Is the plot for sale, or for lease?', type: 'single_select', required: true, section: 'price', options: [
      { value: 'SALE', label: 'For sale' }, { value: 'LEASE', label: 'For lease' },
    ] },
    LOCATION,
    { id: 'extent',      field: 'extent',      label: 'Plot size? (a number)',               type: 'number', required: true, min: 1, max: 10_000_000, section: 'details' },
    { id: 'extentUnit',  field: 'extentUnit',  label: 'In which unit?',                      type: 'single_select', required: true, section: 'details', options: [
      { value: 'sq.ft', label: 'sq.ft' }, { value: 'sq.yd', label: 'sq.yd' }, { value: 'cents', label: 'cents' },
      { value: 'ground', label: 'grounds' }, { value: 'acres', label: 'acres' },
    ] },
    { id: 'rent',        field: 'rent',        label: 'Expected price (₹)?',                 type: 'currency', required: true, min: 1, max: 999_999_999, section: 'price',
      labelFor: { LEASE: 'Lease rent per year (₹)?' } },
    { id: 'deposit',     field: 'deposit',     label: 'Advance amount (₹)? (or *skip*)',    type: 'currency', required: false, min: 0, max: 999_999_999, section: 'price', showIf: (f) => f.saleOrLease === 'LEASE' },
    { id: 'priceNegotiable', field: 'priceNegotiable', label: 'Is the price negotiable?',    type: 'boolean', required: false, options: YES_NO, section: 'price' },
    { id: 'loanEligible', field: 'loanEligible', label: 'Can a buyer get a bank loan on it?', type: 'boolean', required: false, options: YES_NO, section: 'price', showIf: (f) => f.saleOrLease === 'SALE' },
    { id: 'availableFrom', field: 'availableFrom', label: 'Available from? (a date, or *immediately*)', labelFor: { SALE: 'Possession from? (a date, or *immediately*)' }, type: 'date', required: false, section: 'price' },
    { id: 'landType',    field: 'landType',    label: 'What type of land?',                  type: 'single_select', required: true, section: 'details', options: [
      { value: 'Residential', label: 'Residential' }, { value: 'Agricultural', label: 'Agricultural' },
      { value: 'Commercial', label: 'Commercial' }, { value: 'Industrial', label: 'Industrial' },
    ] },
    { id: 'dimensions',  field: 'dimensions',  label: 'Plot dimensions? e.g. 40 x 60 ft (or *skip*)', type: 'text', required: false, max: 60, section: 'details' },
    { id: 'roadWidth',   field: 'roadWidth',   label: 'Approach road width in feet? (or *skip*)', type: 'number', required: false, min: 0, max: 1000, section: 'details' },
    { id: 'facingDirection', field: 'facingDirection', label: 'Which way does the plot face?', type: 'single_select', required: false, options: FACING, section: 'details' },
    { id: 'approvalStatus', field: 'approvalStatus', label: 'Approval status?',              type: 'single_select', required: true, section: 'details', options: [
      { value: 'DTCP', label: 'DTCP approved' }, { value: 'RERA', label: 'RERA' },
      { value: 'Panchayat', label: 'Panchayat' }, { value: 'Unapproved', label: 'Unapproved' },
    ] },
    { id: 'boundaryWall', field: 'boundaryWall', label: 'Is there a boundary wall / fencing?', type: 'boolean', required: false, options: YES_NO, section: 'details' },
    { id: 'amenities',   field: 'amenities',   label: 'Anything else that stands out?',      type: 'multi_select', required: false, options: amenityOptions('land'), section: 'details' },
    DETAILS,
    PHOTOS,
    ...VISIT_QS,
  ],
  pg: [
    LOCATION,
    { id: 'pgName',      field: 'pgName',      label: 'What is the PG called?',              type: 'text', required: false, max: 80, section: 'details' },
    { id: 'sharing',     field: 'sharing',     label: 'What sharing is the room?',           type: 'single_select', required: true, section: 'details', options: [
      { value: 1, label: 'Single (private)' }, { value: 2, label: '2 sharing' }, { value: 3, label: '3 sharing' }, { value: 4, label: '4+ sharing' },
    ] },
    { id: 'furnished',   field: 'furnished',   label: 'How is a room furnished?',            type: 'single_select', required: true, section: 'details', options: [
      { value: 'FULLY', label: 'Fully furnished' }, { value: 'SEMI', label: 'Bed + wardrobe' }, { value: 'UNFURNISHED', label: 'Bare room' },
    ] },
    { id: 'rent',        field: 'rent',        label: 'Rent per bed per month (₹)?',         type: 'currency', required: true, min: 1, max: 10_000_000, section: 'price' },
    { id: 'deposit',     field: 'deposit',     label: 'Security deposit (₹)?',               type: 'currency', required: true, min: 0, max: 10_000_000, section: 'price' },
    { id: 'foodIncluded', field: 'foodIncluded', label: 'Is food included in the rent?',     type: 'boolean', required: true, options: YES_NO, section: 'price' },
    { id: 'foodCharges', field: 'foodCharges', label: 'Food charges per month (₹)?',         type: 'currency', required: false, min: 0, max: 100_000, section: 'price', showIf: (f) => f.foodIncluded === false },
    { id: 'totalBeds',   field: 'totalBeds',   label: 'How many beds does the PG have in total? (or *skip*)', type: 'number', required: false, min: 1, max: 500, section: 'details' },
    { id: 'availableBeds', field: 'availableBeds', label: 'How many beds are free right now? (or *skip*)', type: 'number', required: false, min: 0, max: 500, section: 'details' },
    { id: 'noticePeriodDays', field: 'noticePeriodDays', label: 'Notice period in days? (or *skip*)', type: 'number', required: false, min: 0, max: 180, section: 'price' },
    { id: 'availableFrom', field: 'availableFrom', label: 'Beds available from? (a date, or *immediately*)', type: 'date', required: false, section: 'price' },
    { id: 'genderPreference', field: 'genderPreference', label: 'Who is the PG for?',        type: 'single_select', required: true, section: 'details', options: [
      { value: 'ANY', label: 'Anyone' }, { value: 'MALE', label: 'Men' }, { value: 'FEMALE', label: 'Women' },
    ] },
    { id: 'amenities',   field: 'amenities',   label: 'Which amenities are included?',       type: 'multi_select', required: false, options: amenityOptions('pg'), section: 'details' },
    { id: 'rules',       field: 'rules',       label: 'House rules — which of these apply?', type: 'multi_select', required: false, section: 'details', options: [
      { value: 'visitorsAllowed', label: 'Visitors allowed' }, { value: 'nonVegAllowed', label: 'Non-veg allowed' },
      { value: 'smokingAllowed', label: 'Smoking allowed' }, { value: 'curfew', label: 'There is a curfew' },
    ] },
    { id: 'curfewTime',  field: 'curfewTime',  label: 'What time is the curfew? (e.g. 10:30 PM)', type: 'text', required: false, max: 20, section: 'details', showIf: (f) => Array.isArray(f.rules) && f.rules.includes('curfew') },
    DETAILS,
    PHOTOS,
    ...VISIT_QS,
  ],
  shop: [
    LOCATION,
    { id: 'commercialType', field: 'commercialType', label: 'What kind of space is it?',     type: 'single_select', required: true, section: 'details', options: [
      { value: 'Retail shop', label: 'Shop' }, { value: 'Office', label: 'Office' }, { value: 'Showroom', label: 'Showroom' },
      { value: 'Warehouse', label: 'Warehouse / godown' }, { value: 'Restaurant', label: 'Restaurant space' }, { value: 'Other', label: 'Other' },
    ] },
    PRICING_MODE,
    RENT_Q,
    SALE_PRICE_Q,
    DEPOSIT_Q,
    { id: 'carpetArea',  field: 'carpetArea',  label: 'Built-up / carpet area in sq.ft?',    type: 'number', required: true, min: 1, max: 100_000, section: 'details' },
    { id: 'frontage',    field: 'frontage',    label: 'Frontage in feet? (or *skip*)',       type: 'number', required: false, min: 1, max: 1000, section: 'details' },
    { id: 'floor',       field: 'floor',       label: 'Which floor? (0 = ground)',           type: 'number', required: false, min: 0, max: 200, section: 'details' },
    { id: 'powerLoad',   field: 'powerLoad',   label: 'Sanctioned power load in kW? (or *skip*)', type: 'number', required: false, min: 0, max: 10_000, section: 'details' },
    { id: 'parking',     field: 'parking',     label: 'Is parking available?',               type: 'boolean', required: false, options: YES_NO, section: 'details' },
    { id: 'suitableFor', field: 'suitableFor', label: 'What kind of business suits it? (e.g. clinic, café, boutique)', type: 'text', required: false, max: 200, section: 'details' },
    { id: 'furnished',   field: 'furnished',   label: 'What condition is it in?',            type: 'single_select', required: true, section: 'details', options: [
      { value: 'FULLY', label: 'Fully fitted' }, { value: 'SEMI', label: 'Part fitted' }, { value: 'UNFURNISHED', label: 'Bare shell' },
    ] },
    { id: 'availableFrom', field: 'availableFrom', label: 'Available from? (a date, or *immediately*)', labelFor: { SALE: 'Possession from? (a date, or *immediately*)' }, type: 'date', required: false, section: 'price' },
    { ...MIN_STAY_Q, label: 'Lock-in period in months? (or *skip*)' },
    NOTICE_Q,
    ...SALE_TERM_QS,
    { id: 'amenities',   field: 'amenities',   label: 'What does the space have?',           type: 'multi_select', required: false, options: amenityOptions('shop'), section: 'details' },
    DETAILS,
    PHOTOS,
    ...VISIT_QS,
  ],
  stay: [
    LOCATION,
    { id: 'placeType',   field: 'placeType',   label: 'What will guests book?',              type: 'single_select', required: true, section: 'details', options: [
      { value: 'Entire place', label: 'Entire place' }, { value: 'Private room', label: 'Private room' }, { value: 'Shared room', label: 'Shared room' },
    ] },
    { id: 'nightlyRate', field: 'nightlyRate', label: 'Price per night (₹)?',                type: 'currency', required: true, min: 1, max: 1_000_000, section: 'price' },
    { id: 'cleaningFee', field: 'cleaningFee', label: 'Cleaning fee (₹)? (or *skip*)',       type: 'currency', required: false, min: 0, max: 100_000, section: 'price' },
    { id: 'weekendRate', field: 'weekendRate', label: 'Weekend rate per night (₹)? (or *skip*)', type: 'currency', required: false, min: 1, max: 1_000_000, section: 'price' },
    { id: 'minNights',   field: 'minNights',   label: 'Minimum stay in nights? (or *skip*)', type: 'number', required: false, min: 1, max: 365, section: 'price' },
    { id: 'maxNights',   field: 'maxNights',   label: 'Maximum stay in nights? (or *skip*)', type: 'number', required: false, min: 1, max: 365, section: 'price' },
    { id: 'instantBook', field: 'instantBook', label: 'Can guests book instantly, without approving each request?', type: 'boolean', required: false, options: YES_NO, section: 'price' },
    { id: 'maxGuests',   field: 'maxGuests',   label: 'Maximum guests?',                     type: 'number', required: true, min: 1, max: 50, section: 'details' },
    { id: 'bhk',         field: 'bhk',         label: 'How many bedrooms?',                  type: 'number', required: true, min: 0, max: 10, section: 'details' },
    { id: 'beds',        field: 'beds',        label: 'How many beds? (or *skip*)',          type: 'number', required: false, min: 1, max: 50, section: 'details' },
    { id: 'bathrooms',   field: 'bathrooms',   label: 'How many bathrooms?',                 type: 'number', required: false, min: 0, max: 20, section: 'details' },
    { id: 'checkIn',     field: 'checkIn',     label: 'Check-in time? (e.g. 2 PM)',          type: 'text', required: false, max: 20, section: 'details' },
    { id: 'checkOut',    field: 'checkOut',    label: 'Check-out time? (e.g. 11 AM)',        type: 'text', required: false, max: 20, section: 'details' },
    { id: 'amenities',   field: 'amenities',   label: 'What can guests use?',                type: 'multi_select', required: false, options: amenityOptions('stay'), section: 'details' },
    { id: 'rules',       field: 'rules',       label: 'House rules — who can book, and what\'s allowed?', type: 'multi_select', required: false, section: 'details', options: [
      // bachelorAllowed is the column that means "unmarried guests accepted" —
      // for a short stay that is exactly what "couple friendly" claims. The
      // guest CAP ("only 3 members") is maxGuests above, not a rule.
      { value: 'bachelorAllowed', label: 'Couples welcome' },
      { value: 'familyPreferred', label: 'Great for families' },
      { value: 'petsAllowed', label: 'Pets allowed' }, { value: 'nonVegAllowed', label: 'Non-veg allowed' }, { value: 'smokingAllowed', label: 'Smoking allowed' },
    ] },
    DETAILS,
    PHOTOS,
    ...STAY_VISIT_QS,
  ],
}

// The review-screen "Edit" groups, in the order they are offered. Every
// question above names one of these.
export const SECTIONS = {
  location:    'Location',
  price:       'Price & availability',
  details:     'Property details',
  description: 'Extra details',
  photos:      'Photos',
  visits:      'Visits & contact',
}

export function getQuestionnaire(category) {
  return QUESTIONNAIRES[category] ?? null
}

/** Every field id that any questionnaire uses — what an extractor may return. */
export const KNOWN_FIELDS = [...new Set(Object.values(QUESTIONNAIRES).flat().map((q) => q.field))]
