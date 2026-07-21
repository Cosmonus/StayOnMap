// Per-type config driving the host onboarding wizard. One flat Property
// table serves all 6 types (see backend/prisma/schema.prisma) — this config
// just decides which questions/fields/amenities/docs apply to each.

export const CATEGORIES = {
  apartment: { type: 'APARTMENT',  label: 'Apartment / Flat',            short: 'Apartment',   tier: 'free', long: 'Long-term rental' },
  house:     { type: 'HOUSE',      label: 'Independent House / Villa',   short: 'House',       tier: 'free', long: 'Long-term rental' },
  land:      { type: 'LAND',       label: 'Land / Plot',                 short: 'Land',        tier: 'free', long: 'Lease or sale' },
  pg:        { type: 'PG',         label: 'PG / Co-living',              short: 'PG',          tier: 'biz',  long: 'Per-bed, monthly' },
  shop:      { type: 'COMMERCIAL', label: 'Shop / Commercial',           short: 'Shop',        tier: 'biz',  long: 'Commercial lease' },
  stay:      { type: 'SHORT_STAY', label: 'Short-stay / Airbnb',         short: 'Short-stay',  tier: 'biz',  long: 'Nightly + calendar' },
}

// describe step — one required choice that shapes the rest of the flow.
// `k` is the Property field the choice is written to (HOUSE writes to
// `houseStyle`; `type` itself is then derived from that choice — see
// deriveType() below).
export const DESCRIBE = {
  apartment: { q: 'Which best describes your flat?', k: 'bhk', opts: [
    [1, '1 BHK', 'One bed, hall, kitchen'], [2, '2 BHK', 'Two bedrooms'],
    [3, '3 BHK', 'Three bedrooms'], [4, '4 BHK+', 'Four or more bedrooms'],
  ] },
  house: { q: 'What kind of home is it?', k: 'houseStyle', opts: [
    ['Independent house', 'Independent house', 'Standalone, own entrance'],
    ['Villa', 'Villa', 'Premium standalone home'],
    ['Duplex', 'Duplex', 'Two connected floors'],
    ['Row house', 'Row house', 'Shared side walls'],
  ] },
  land: { q: 'What type of land is it?', k: 'landType', opts: [
    ['Residential', 'Residential plot', 'For building homes'],
    ['Agricultural', 'Agricultural', 'Farmland / cultivation'],
    ['Commercial', 'Commercial', 'For business use'],
    ['Industrial', 'Industrial', 'For industrial use'],
  ] },
  pg: { q: 'What sharing do you offer?', k: 'sharing', opts: [
    [1, 'Single', 'Private room, one bed'], [2, '2-share', 'Two beds per room'],
    [3, '3-share', 'Three beds per room'], [4, '4-share', 'Four+ beds per room'],
  ] },
  shop: { q: 'What type of space is it?', k: 'commercialType', opts: [
    ['Retail shop', 'Retail shop', 'Street-facing shop'], ['Office', 'Office', 'Workspace / cabins'],
    ['Showroom', 'Showroom', 'Large display space'], ['Warehouse', 'Warehouse', 'Storage / godown'],
  ] },
  stay: { q: 'What will guests book?', k: 'placeType', opts: [
    ['Entire place', 'Entire place', 'Guests have it to themselves'],
    ['Private room', 'Private room', 'Own room, shared spaces'],
    ['Shared room', 'Shared room', 'A shared sleeping space'],
  ] },
}

// key-details step — field types: seg (segmented single-select), count
// (+/- stepper), txt (text/number with optional suffix), two (two `txt`
// fields side by side). `k` is a unique key for the field row; each control
// carries its own Property field name(s).
export const FIELDS = {
  apartment: [
    { t: 'count', k: 'bathrooms', field: 'bathrooms', label: 'How many bathrooms?' },
    { t: 'seg',   k: 'furnished', field: 'furnished', label: 'Furnishing', opts: [['UNFURNISHED', 'Unfurnished'], ['SEMI', 'Semi'], ['FULLY', 'Fully']] },
    { t: 'two',   k: 'fl', label: 'Floor details', a: ['floor', 'Unit floor', '4'], b: ['totalFloors', 'Total floors', '12'] },
    { t: 'txt',   k: 'area', field: 'area', label: 'Built-up area', ph: '1100', suf: 'sq.ft' },
    { t: 'seg',   k: 'facingDirection', field: 'facingDirection', label: 'Which way does it face?', opts: [['EAST', 'East'], ['WEST', 'West'], ['NORTH', 'North'], ['SOUTH', 'South']] },
  ],
  house: [
    { t: 'count', k: 'bhk', field: 'bhk', label: 'How many bedrooms?' },
    { t: 'count', k: 'bathrooms', field: 'bathrooms', label: 'How many bathrooms?' },
    { t: 'two',   k: 'ar', label: 'Area', a: ['extent', 'Plot area (sq.ft)', '2400'], b: ['area', 'Built-up (sq.ft)', '1800'] },
    { t: 'seg',   k: 'furnished', field: 'furnished', label: 'Furnishing', opts: [['UNFURNISHED', 'Unfurnished'], ['SEMI', 'Semi'], ['FULLY', 'Fully']] },
  ],
  land: [
    // First, because it changes what every number below MEANS — an advance on a
    // sale and a deposit on a lease are different commitments.
    //
    // `saleOrLease` was a real Property column, a public filter and an admin
    // filter with no control anywhere that could set it: a listing made through
    // this wizard always left it null, so the "Sale or lease" filter could never
    // match anything a user actually created.
    { t: 'seg', k: 'saleOrLease', field: 'saleOrLease', label: 'Sale or lease?', opts: [['SALE', 'For sale'], ['LEASE', 'For lease']] },
    { t: 'two', k: 'ext', label: 'Extent', a: ['extent', 'Area', '2400'], b: ['extentUnit', 'Unit', 'sq.ft'] },
    { t: 'txt', k: 'dimensions', field: 'dimensions', label: 'Dimensions (L x B)', ph: '40 x 60 ft', suf: '' },
    { t: 'txt', k: 'roadWidth', field: 'roadWidth', label: 'Approach road width', ph: '30', suf: 'ft' },
    { t: 'seg', k: 'approvalStatus', field: 'approvalStatus', label: 'Approval status', opts: [['DTCP', 'DTCP'], ['RERA', 'RERA'], ['Panchayat', 'Panchayat'], ['Unapproved', 'Unapproved']] },
  ],
  pg: [
    { t: 'seg', k: 'genderPreference', field: 'genderPreference', label: 'Who is it for?', opts: [['ANY', 'Anyone'], ['MALE', 'Men'], ['FEMALE', 'Women']] },
    { t: 'two', k: 'bd', label: 'Beds', a: ['totalBeds', 'Total beds', '24'], b: ['availableBeds', 'Available now', '6'] },
    { t: 'txt', k: 'noticePeriodDays', field: 'noticePeriodDays', label: 'Notice period', ph: '30', suf: 'days' },
  ],
  shop: [
    { t: 'two', k: 'ca', label: 'Dimensions', a: ['carpetArea', 'Carpet area (sq.ft)', '850'], b: ['frontage', 'Frontage (ft)', '18'] },
    { t: 'txt', k: 'floor', field: 'floor', label: 'Which floor? (0 = ground)', ph: '0', suf: '' },
    { t: 'txt', k: 'powerLoad', field: 'powerLoad', label: 'Sanctioned power load', ph: '15', suf: 'kW' },
  ],
  stay: [
    { t: 'count', k: 'maxGuests', field: 'maxGuests', label: 'How many guests fit?' },
    { t: 'two', k: 'rm', label: 'Sleeping', a: ['bhk', 'Bedrooms', '2'], b: ['beds', 'Beds', '3'] },
    { t: 'count', k: 'bathrooms', field: 'bathrooms', label: 'How many bathrooms?' },
  ],
}

// Amenity names — must match backend/prisma/seed.js's AMENITIES exactly.
// Every name here must exist in backend/prisma/amenities.js AND be reachable
// from a filter option in config/filters.js — a chip that isn't filterable is
// a tag nobody can search for, and a filter option no chip offers matches
// nothing at all. Six filters (CCTV, Play Area, Club House, Intercom,
// Rainwater Harvesting, Gated Security) were dead exactly this way until
// 2026-07-17. `node backend/scripts/check-amenities.mjs` guards it now.
export const FEATURES = {
  apartment: { label: 'What amenities does it have?', opts: ['WiFi', 'AC', 'Air Cooler', 'Lift', 'Covered Parking', 'Visitor Parking', 'Two-wheeler Parking', 'EV Charging', 'Power Backup', 'Gym', 'Swimming Pool', 'Club House', 'Play Area', 'Jogging Track', 'Indoor Games', 'Badminton Court', 'Party Hall', 'Creche', 'Security Guard', 'CCTV', 'Intercom', 'Video Door Phone', 'Gated Community', 'Fire Safety', 'Wheelchair Accessible', 'Modular Kitchen', 'Balcony', 'Gas Pipeline', 'Geyser', 'Water Purifier', 'Water Supply', 'Rainwater Harvesting', 'Waste Management', 'Housekeeping', 'Pet Friendly'] },
  house:     { label: 'What features stand out?', opts: ['Garden', 'Terrace', 'Gated Community', 'Power Backup', 'Solar Panel', 'Borewell', 'Water Tank', 'Water Supply', 'Water Purifier', 'Geyser', 'Solar Water Heater', 'Covered Parking', 'Two-wheeler Parking', 'EV Charging', 'Servant Room', 'Modular Kitchen', 'Balcony', 'Play Area', 'CCTV', 'Security Guard', 'Intercom', 'Video Door Phone', 'Fire Safety', 'Rainwater Harvesting', 'Wheelchair Accessible', 'AC', 'WiFi', 'Pet Friendly'] },
  land:      { label: 'What makes this plot good?', opts: ['Corner Plot', 'Boundary Wall', 'Borewell', 'Gated Community', 'East Facing', 'Near Main Road', 'Ready to Build', 'Water Supply'] },
  pg:        { label: 'Meals & amenities included', opts: ['Breakfast', 'Lunch', 'Dinner', 'WiFi', 'AC', 'Air Cooler', 'Laundry', 'Housekeeping', 'Power Backup', 'Study Desk', 'Attached Bath', 'Geyser', 'Water Purifier', 'Fridge', 'Bed', 'Wardrobe', 'Washing Machine', 'Lift', 'CCTV', 'Security Guard', 'Fire Safety', 'Indoor Games'] },
  shop:      { label: 'What does the space have?', opts: ['Washroom', 'Parking', 'Visitor Parking', 'Near Main Road', 'Corner Plot', '3-Phase Power', 'Power Backup', 'Roll-down Shutter', 'Mezzanine', 'Signage Space', 'Lift', 'AC', 'CCTV', 'Fire Safety', 'Water Supply', 'Wheelchair Accessible'] },
  stay:      { label: 'What can guests use?', opts: ['WiFi', 'AC', 'Air Cooler', 'Kitchen', 'Swimming Pool', 'Parking', 'Washing Machine', 'TV', 'Workspace', 'Beachfront', 'Pet Friendly', 'Geyser', 'Fridge', 'Microwave', 'Sofa', 'Bed', 'Wardrobe', 'Dining Table', 'Fire Safety', 'Wheelchair Accessible'] },
}

// Title guidance — placeholder goes inside the input, example renders as a
// muted "e.g. …" line. Written per category because a good land title and a
// good PG title lead with completely different facts.
export const TITLE_HINTS = {
  apartment: { placeholder: 'Bright 2 BHK near the metro',          example: '2 BHK with balcony near Indiranagar metro' },
  house:     { placeholder: '3 BHK independent house with garden',  example: '3 BHK independent house with terrace garden' },
  land:      { placeholder: '1200 sq.ft plot on a 30 ft road',      example: '1200 sq.ft east-facing plot on 30 ft road' },
  pg:        { placeholder: 'Single sharing PG with food',          example: 'Single sharing PG for women with food, HSR' },
  shop:      { placeholder: 'Ground-floor shop on main road',       example: '400 sq.ft ground-floor shop with frontage on main road' },
  stay:      { placeholder: 'Cosy 1 BHK near the beach',            example: 'Cosy 1 BHK near the beach, sleeps 4' },
}

// Description prompts — the three questions a renter of THAT type actually
// asks. Shown above the description input as guidance, never enforced.
export const DESC_PROMPTS = {
  apartment: [
    'How is the light and ventilation through the day?',
    'What is the water situation — supply timings, borewell, tanker?',
    'What does the commute look like — nearest metro, bus, main road?',
  ],
  house: [
    'How is the light and ventilation through the day?',
    'Water and power — borewell, tank capacity, backup?',
    'Commute anchors — how far to the main road, metro, schools?',
  ],
  land: [
    'How is the road access — width, surface, who maintains it?',
    'Soil and levelling — ready to build, or does it need work?',
    'What is coming up nearby — roads, layouts, projects?',
  ],
  pg: [
    'Food — what is served, and at what timings?',
    'Who lives here — students, working professionals, the mix?',
    'How do the house rules feel day to day — curfew, visitors, quiet hours?',
  ],
  shop: [
    'Footfall — who passes by, and when is it busiest?',
    'Power and water — sanctioned load, backup, supply?',
    'What businesses already thrive on this stretch?',
  ],
  stay: [
    'What can guests walk to — food, sights, the water?',
    'How easy is check-in — self check-in, keys, timings?',
    'What makes staying here special?',
  ],
}

// One line of photo direction per category — what the first photo should be.
export const PHOTO_HINTS = {
  apartment: 'Lead with the living room in daylight, then kitchen, bedrooms and the balcony view.',
  house:     'Start at the entrance, then the living spaces — and don’t skip the terrace or garden.',
  land:      'Shoot the plot from the approach road, plus any boundary markers.',
  pg:        'Show a room, the bathroom, and the dining/common area.',
  shop:      'Lead with the frontage — it’s what a business looks for first.',
  stay:      'Show where guests sleep, the bathroom, and the view they wake up to.',
}

// Pricing fields — `field` is the real Property column each input writes
// to. LAND repurposes `rent`/`deposit` as "total price"/"advance" (no
// separate columns — land doesn't have a monthly rent concept, but every
// Property row needs `rent`/`deposit` populated since map pins/cards read
// them everywhere). SHORT_STAY's `rent` is derived from `nightlyRate` at
// submit time instead of being entered directly.
export const PRICING = {
  apartment: [['rent', 'Monthly rent', '28000'], ['deposit', 'Deposit', '56000'], ['maintenance', 'Maintenance / mo', '1500']],
  house:     [['rent', 'Monthly rent', '45000'], ['deposit', 'Deposit', '200000'], ['maintenance', 'Maintenance / mo', '0']],
  land:      [['rent', 'Total price', '4500000'], ['deposit', 'Advance', '100000']],
  pg:        [['rent', 'Rent per bed / mo', '9500'], ['deposit', 'Deposit', '19000']],
  shop:      [['rent', 'Monthly rent', '85000'], ['deposit', 'Deposit', '510000']],
  stay:      [['nightlyRate', 'Nightly rate', '5250'], ['cleaningFee', 'Cleaning fee', '800'], ['weekendRate', 'Weekend rate', '6500']],
}

// Categories that can be offered on lease — mirrors the backend's
// LEASE_ELIGIBLE_TYPES (properties.validation.js). PG prices per bed, stay per
// night, land carries its own saleOrLease: none can be leased.
export const LEASE_CATEGORIES = ['apartment', 'house', 'shop']

// Lease pricing writes the lump sum to the SAME `rent` column monthly rent
// uses (see PricingModel in schema.prisma) — pricingModel is what tells them
// apart. No deposit row: on a lease the lump sum IS the money at stake, and
// the backend rejects a lease with a deposit. Maintenance is still monthly.
const LEASE_PRICING = {
  apartment: [['rent', 'Lease amount', '800000'], ['maintenance', 'Maintenance / mo', '1500']],
  house:     [['rent', 'Lease amount', '1500000'], ['maintenance', 'Maintenance / mo', '0']],
  shop:      [['rent', 'Lease amount', '2500000']],
}

// The one place pricing rows are resolved — screens, validation and the review
// summary all go through this so they can't disagree about which fields exist.
export function pricingRows(categoryKey, pricingModel = 'RENT') {
  return pricingModel === 'LEASE' && LEASE_PRICING[categoryKey]
    ? LEASE_PRICING[categoryKey]
    : PRICING[categoryKey]
}

// Publish-readiness, shared by both platforms' wizards and the review screen.
// These are the checks that used to hard-block Next mid-flow; now the only
// mid-flow gate is the describe selection (screen branching and type
// derivation hang off it) and everything else surfaces here, at review.
// UX guidance only — the backend re-validates at create/publish.
const OPTIONAL_PRICE_KEYS = ['deposit', 'maintenance', 'cleaningFee', 'weekendRate']

export function missingRequirements(categoryKey, draft) {
  const missing = []
  const add = (screenK, label) => missing.push({ screenK, label })
  if (draft.fields[DESCRIBE[categoryKey].k] === undefined) add('describe', 'Answer the opening question')
  const l = draft.location
  if (l.address.trim().length < 5) add('location', 'Enter a full address')
  if (!l.city) add('location', 'Select a city')
  if (!/^\d{6}$/.test(l.pincode)) add('location', 'Enter a valid 6-digit pincode')
  if (l.lat == null) add('location', 'Drop a pin on the map')
  if (draft.images.length < 1) add('photos', 'Add at least one photo')
  if (draft.title.trim().length < 5) add('title', 'Give it a title (5+ characters)')
  if (draft.description.trim().length < 10) add('description', 'Write a description (10+ characters)')
  for (const [key, label] of pricingRows(categoryKey, draft.pricingModel)) {
    if (OPTIONAL_PRICE_KEYS.includes(key)) continue
    if (!draft.pricing[key]) add('pricing', `Set the ${label.toLowerCase()}`)
  }
  return missing
}

// Verification documents are deliberately NOT part of this wizard (removed
// 2026-07-21 — the paste-a-link step stopped the listing flow dead). Owners
// are asked for ownership/business documents in the dedicated verification
// flow on their listing page instead (VerificationWizard). Listing and
// verifying are two decisions, not one.

export const BUSINESS_GATED_TYPES = ['pg', 'shop', 'stay']

// Phase interstitials + screen order — identical for every type. Shared-core
// screens (location, photos, contact) are the same across all six.
export function getScreens() {
  return [
    { k: 'phase', n: 1, title: 'Tell us about your place', blurb: 'Share the basics — what kind of property it is, where it sits, and what makes it worth renting.' },
    { k: 'describe' }, { k: 'fields' }, { k: 'location' }, { k: 'features' },
    { k: 'phase', n: 2, title: 'Make it stand out', blurb: 'Add photos and the words renters see first. A great listing always leads with great photos.' },
    { k: 'photos' }, { k: 'title' }, { k: 'description' },
    { k: 'phase', n: 3, title: 'Finish up and publish', blurb: 'Set your price and review everything before it goes live on the map.' },
    { k: 'pricing' }, { k: 'contact' }, { k: 'review' },
  ]
}

export function phaseOf(idx) {
  const screens = getScreens()
  let phase = 1
  for (let i = 0; i <= idx && i < screens.length; i++) {
    if (screens[i].k === 'phase') phase = screens[i].n
  }
  return phase
}

// HOUSE is the one category whose real PropertyType isn't 1:1 with the
// category key — VILLA/INDEPENDENT_HOUSE get their own enum value, Duplex
// and Row house both fall back to plain HOUSE.
export function deriveType(categoryKey, describeValue) {
  if (categoryKey !== 'house') return CATEGORIES[categoryKey].type
  if (describeValue === 'Villa') return 'VILLA'
  if (describeValue === 'Independent house') return 'INDEPENDENT_HOUSE'
  return 'HOUSE'
}
