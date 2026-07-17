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
export const FEATURES = {
  apartment: { label: 'What amenities does it have?', opts: ['WiFi', 'AC', 'Air Cooler', 'Lift', 'Covered Parking', 'Visitor Parking', 'Two-wheeler Parking', 'EV Charging', 'Power Backup', 'Gym', 'Swimming Pool', 'Club House', 'Play Area', 'Jogging Track', 'Indoor Games', 'Badminton Court', 'Party Hall', 'Creche', 'Security Guard', 'CCTV', 'Intercom', 'Video Door Phone', 'Gated Community', 'Fire Safety', 'Wheelchair Accessible', 'Modular Kitchen', 'Balcony', 'Gas Pipeline', 'Geyser', 'Water Purifier', 'Water Supply', 'Rainwater Harvesting', 'Waste Management', 'Housekeeping', 'Pet Friendly'] },
  house:     { label: 'What features stand out?', opts: ['Garden', 'Terrace', 'Gated Community', 'Power Backup', 'Solar Panel', 'Borewell', 'Water Tank', 'Water Supply', 'Water Purifier', 'Geyser', 'Solar Water Heater', 'Covered Parking', 'Two-wheeler Parking', 'EV Charging', 'Servant Room', 'Modular Kitchen', 'Balcony', 'Play Area', 'CCTV', 'Security Guard', 'Intercom', 'Video Door Phone', 'Fire Safety', 'Rainwater Harvesting', 'Wheelchair Accessible', 'AC', 'WiFi', 'Pet Friendly'] },
  land:      { label: 'What makes this plot good?', opts: ['Corner Plot', 'Boundary Wall', 'Borewell', 'Gated Community', 'East Facing', 'Near Main Road', 'Ready to Build', 'Water Supply'] },
  pg:        { label: 'Meals & amenities included', opts: ['Breakfast', 'Lunch', 'Dinner', 'WiFi', 'AC', 'Air Cooler', 'Laundry', 'Housekeeping', 'Power Backup', 'Study Desk', 'Attached Bath', 'Geyser', 'Water Purifier', 'Fridge', 'Bed', 'Wardrobe', 'Washing Machine', 'Lift', 'CCTV', 'Security Guard', 'Fire Safety', 'Indoor Games'] },
  shop:      { label: 'What does the space have?', opts: ['Washroom', 'Parking', 'Visitor Parking', 'Near Main Road', 'Corner Plot', '3-Phase Power', 'Power Backup', 'Roll-down Shutter', 'Mezzanine', 'Signage Space', 'Lift', 'AC', 'CCTV', 'Fire Safety', 'Water Supply', 'Wheelchair Accessible'] },
  stay:      { label: 'What can guests use?', opts: ['WiFi', 'AC', 'Air Cooler', 'Kitchen', 'Swimming Pool', 'Parking', 'Washing Machine', 'TV', 'Workspace', 'Beachfront', 'Pet Friendly', 'Geyser', 'Fridge', 'Microwave', 'Sofa', 'Bed', 'Wardrobe', 'Dining Table', 'Fire Safety', 'Wheelchair Accessible'] },
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

// Verification doc checklist per type — tuples of [VerificationDocType, label].
export const VERIFY = {
  apartment: { docs: [['GOVT_ID', 'Government ID (Aadhaar / PAN)'], ['PROPERTY_TAX', 'Latest electricity bill or property tax'], ['SELFIE', 'Selfie with ID']], biz: false },
  house:     { docs: [['GOVT_ID', 'Government ID'], ['PROPERTY_TAX', 'Property tax receipt'], ['RENTAL_AGREEMENT', 'Sale deed / Khata extract'], ['SELFIE', 'Selfie with ID']], biz: false },
  land:      { docs: [['GOVT_ID', 'Government ID'], ['PATTA_TITLE', 'Patta / Title deed'], ['PROPERTY_TAX', 'Survey number & EC'], ['OTHER', 'Encumbrance certificate (30 yr)']], biz: false },
  pg:        { docs: [['GOVT_ID', 'Owner Government ID'], ['GST', 'GST / trade license'], ['RENTAL_AGREEMENT', 'Property ownership or lease proof'], ['OTHER', 'Fire & safety NOC']], biz: true },
  shop:      { docs: [['GOVT_ID', 'Owner Government ID'], ['GST', 'GST certificate'], ['TRADE_LICENSE', 'Trade / shop license'], ['PROPERTY_TAX', 'Property tax or registered lease']], biz: true },
  stay:      { docs: [['GOVT_ID', 'Host Government ID'], ['PROPERTY_TAX', 'Property ownership proof'], ['HOMESTAY_PERMIT', 'Local homestay / tourism permit'], ['OTHER', 'Bank account for payouts']], biz: true },
}

export const BUSINESS_GATED_TYPES = ['pg', 'shop', 'stay']

// Phase interstitials + screen order — identical for every type. Shared-core
// screens (location, photos, contact) are the same across all six.
export function getScreens() {
  return [
    { k: 'phase', n: 1, title: 'Tell us about your place', blurb: 'Share the basics — what kind of property it is, where it sits, and what makes it worth renting.' },
    { k: 'describe' }, { k: 'fields' }, { k: 'location' }, { k: 'features' },
    { k: 'phase', n: 2, title: 'Make it stand out', blurb: 'Add photos and the words renters see first. A great listing always leads with great photos.' },
    { k: 'photos' }, { k: 'title' }, { k: 'description' },
    { k: 'phase', n: 3, title: 'Finish up and publish', blurb: 'Set your price, verify ownership, and review everything before it goes live on the map.' },
    { k: 'pricing' }, { k: 'contact' }, { k: 'verify' }, { k: 'review' },
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
