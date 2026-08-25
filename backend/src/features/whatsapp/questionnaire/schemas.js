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
//             | date | location | image | phone | confirmation
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

const RULES_RESIDENTIAL = [
  { value: 'bachelorAllowed', label: 'Bachelors allowed' },
  { value: 'familyPreferred', label: 'Families preferred' },
  { value: 'petsAllowed',     label: 'Pets allowed' },
  { value: 'nonVegAllowed',   label: 'Non-veg allowed' },
  { value: 'smokingAllowed',  label: 'Smoking allowed' },
]

export const QUESTIONNAIRES = {
  apartment: [
    LOCATION,
    { id: 'bhk',         field: 'bhk',         label: 'How many bedrooms?',                  type: 'single_select', required: true, options: BHK, section: 'details' },
    { id: 'rent',        field: 'rent',        label: 'Monthly rent (₹)?',                   type: 'currency', required: true, min: 1, max: 10_000_000, section: 'price' },
    { id: 'deposit',     field: 'deposit',     label: 'Security deposit (₹)?',               type: 'currency', required: true, min: 0, max: 10_000_000, section: 'price' },
    { id: 'furnished',   field: 'furnished',   label: 'Furnishing?',                         type: 'single_select', required: true, options: FURNISHED, section: 'details' },
    { id: 'bathrooms',   field: 'bathrooms',   label: 'How many bathrooms?',                 type: 'number', required: false, min: 0, max: 20, section: 'details' },
    { id: 'parking',     field: 'parking',     label: 'Is car parking available?',           type: 'boolean', required: false, options: YES_NO, section: 'details' },
    { id: 'floor',       field: 'floor',       label: 'Which floor is the flat on? (0 = ground)', type: 'number', required: false, min: 0, max: 200, section: 'details' },
    { id: 'totalFloors', field: 'totalFloors', label: 'How many floors does the building have?', type: 'number', required: false, min: 1, max: 200, section: 'details' },
    { id: 'availableFrom', field: 'availableFrom', label: 'Available from? (a date, a month, or *immediately*)', type: 'date', required: false, section: 'price' },
    { id: 'amenities',   field: 'amenities',   label: 'Which amenities does it have?',       type: 'multi_select', required: false, options: amenityOptions('apartment'), section: 'details' },
    { id: 'rules',       field: 'rules',       label: 'House rules — which of these apply?', type: 'multi_select', required: false, options: RULES_RESIDENTIAL, section: 'details' },
    DETAILS,
    PHOTOS,
  ],
  house: [
    LOCATION,
    { id: 'houseStyle',  field: 'houseStyle',  label: 'What kind of house is it?',           type: 'single_select', required: true, section: 'details', options: [
      { value: 'Independent house', label: 'Independent house' }, { value: 'Villa', label: 'Villa' },
      { value: 'Duplex', label: 'Duplex' }, { value: 'Row house', label: 'Row house' },
    ] },
    { id: 'bhk',         field: 'bhk',         label: 'How many bedrooms?',                  type: 'single_select', required: true, options: BHK, section: 'details' },
    { id: 'rent',        field: 'rent',        label: 'Monthly rent (₹)?',                   type: 'currency', required: true, min: 1, max: 10_000_000, section: 'price' },
    { id: 'deposit',     field: 'deposit',     label: 'Security deposit (₹)?',               type: 'currency', required: true, min: 0, max: 10_000_000, section: 'price' },
    { id: 'furnished',   field: 'furnished',   label: 'Furnishing?',                         type: 'single_select', required: true, options: FURNISHED, section: 'details' },
    { id: 'bathrooms',   field: 'bathrooms',   label: 'How many bathrooms?',                 type: 'number', required: false, min: 0, max: 20, section: 'details' },
    { id: 'parking',     field: 'parking',     label: 'Is car parking available?',           type: 'boolean', required: false, options: YES_NO, section: 'details' },
    { id: 'area',        field: 'area',        label: 'Built-up area in sq.ft?',             type: 'number', required: false, min: 1, max: 100_000, section: 'details' },
    { id: 'extent',      field: 'extent',      label: 'Plot area in sq.ft?',                 type: 'number', required: false, min: 1, max: 10_000_000, section: 'details' },
    { id: 'totalFloors', field: 'totalFloors', label: 'How many floors?',                    type: 'number', required: false, min: 1, max: 200, section: 'details' },
    { id: 'availableFrom', field: 'availableFrom', label: 'Available from? (a date, a month, or *immediately*)', type: 'date', required: false, section: 'price' },
    { id: 'amenities',   field: 'amenities',   label: 'Which features does it have?',        type: 'multi_select', required: false, options: amenityOptions('house'), section: 'details' },
    { id: 'rules',       field: 'rules',       label: 'House rules — which of these apply?', type: 'multi_select', required: false, options: RULES_RESIDENTIAL, section: 'details' },
    DETAILS,
    PHOTOS,
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
    { id: 'landType',    field: 'landType',    label: 'What type of land?',                  type: 'single_select', required: true, section: 'details', options: [
      { value: 'Residential', label: 'Residential' }, { value: 'Agricultural', label: 'Agricultural' },
      { value: 'Commercial', label: 'Commercial' }, { value: 'Industrial', label: 'Industrial' },
    ] },
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
  ],
  shop: [
    LOCATION,
    { id: 'commercialType', field: 'commercialType', label: 'What kind of space is it?',     type: 'single_select', required: true, section: 'details', options: [
      { value: 'Retail shop', label: 'Shop' }, { value: 'Office', label: 'Office' }, { value: 'Showroom', label: 'Showroom' },
      { value: 'Warehouse', label: 'Warehouse / godown' }, { value: 'Restaurant', label: 'Restaurant space' }, { value: 'Other', label: 'Other' },
    ] },
    { id: 'rent',        field: 'rent',        label: 'Monthly rent (₹)?',                   type: 'currency', required: true, min: 1, max: 10_000_000, section: 'price' },
    { id: 'deposit',     field: 'deposit',     label: 'Security deposit (₹)?',               type: 'currency', required: true, min: 0, max: 10_000_000, section: 'price' },
    { id: 'carpetArea',  field: 'carpetArea',  label: 'Built-up / carpet area in sq.ft?',    type: 'number', required: true, min: 1, max: 100_000, section: 'details' },
    { id: 'floor',       field: 'floor',       label: 'Which floor? (0 = ground)',           type: 'number', required: false, min: 0, max: 200, section: 'details' },
    { id: 'parking',     field: 'parking',     label: 'Is parking available?',               type: 'boolean', required: false, options: YES_NO, section: 'details' },
    { id: 'suitableFor', field: 'suitableFor', label: 'What kind of business suits it? (e.g. clinic, café, boutique)', type: 'text', required: false, max: 200, section: 'details' },
    { id: 'furnished',   field: 'furnished',   label: 'What condition is it in?',            type: 'single_select', required: true, section: 'details', options: [
      { value: 'FULLY', label: 'Fully fitted' }, { value: 'SEMI', label: 'Part fitted' }, { value: 'UNFURNISHED', label: 'Bare shell' },
    ] },
    { id: 'availableFrom', field: 'availableFrom', label: 'Available from? (a date, or *immediately*)', type: 'date', required: false, section: 'price' },
    { id: 'amenities',   field: 'amenities',   label: 'What does the space have?',           type: 'multi_select', required: false, options: amenityOptions('shop'), section: 'details' },
    DETAILS,
    PHOTOS,
  ],
  stay: [
    LOCATION,
    { id: 'placeType',   field: 'placeType',   label: 'What will guests book?',              type: 'single_select', required: true, section: 'details', options: [
      { value: 'Entire place', label: 'Entire place' }, { value: 'Private room', label: 'Private room' }, { value: 'Shared room', label: 'Shared room' },
    ] },
    { id: 'nightlyRate', field: 'nightlyRate', label: 'Price per night (₹)?',                type: 'currency', required: true, min: 1, max: 1_000_000, section: 'price' },
    { id: 'maxGuests',   field: 'maxGuests',   label: 'Maximum guests?',                     type: 'number', required: true, min: 1, max: 50, section: 'details' },
    { id: 'bhk',         field: 'bhk',         label: 'How many bedrooms?',                  type: 'number', required: true, min: 0, max: 10, section: 'details' },
    { id: 'bathrooms',   field: 'bathrooms',   label: 'How many bathrooms?',                 type: 'number', required: false, min: 0, max: 20, section: 'details' },
    { id: 'checkIn',     field: 'checkIn',     label: 'Check-in time? (e.g. 2 PM)',          type: 'text', required: false, max: 20, section: 'details' },
    { id: 'checkOut',    field: 'checkOut',    label: 'Check-out time? (e.g. 11 AM)',        type: 'text', required: false, max: 20, section: 'details' },
    { id: 'amenities',   field: 'amenities',   label: 'What can guests use?',                type: 'multi_select', required: false, options: amenityOptions('stay'), section: 'details' },
    { id: 'rules',       field: 'rules',       label: 'House rules — which of these apply?', type: 'multi_select', required: false, section: 'details', options: [
      { value: 'petsAllowed', label: 'Pets allowed' }, { value: 'nonVegAllowed', label: 'Non-veg allowed' }, { value: 'smokingAllowed', label: 'Smoking allowed' },
    ] },
    DETAILS,
    PHOTOS,
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
}

export function getQuestionnaire(category) {
  return QUESTIONNAIRES[category] ?? null
}

/** Every field id that any questionnaire uses — what an extractor may return. */
export const KNOWN_FIELDS = [...new Set(Object.values(QUESTIONNAIRES).flat().map((q) => q.field))]
