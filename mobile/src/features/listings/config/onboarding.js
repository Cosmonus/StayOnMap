// Per-type config driving the host onboarding wizard. One flat Property
// table serves all 6 types (see backend/prisma/schema.prisma) — this config
// just decides which questions/fields/rules/amenities apply to each.
//
// The flow is SIX steps (2026-07-26). It used to be twelve screens across
// three phases with a full-page interstitial in front of each phase: an owner
// answered one question per page, and three of those pages were prose they
// could not act on. The steps below group the questions the way an owner
// already holds them in their head — what it is, where it is, what it looks
// like, what it has, what it costs — and every step is reachable by name from
// the review step, so nothing is buried behind a linear Next.

export const CATEGORIES = {
  apartment: { type: 'APARTMENT',  label: 'Apartment / Flat',            short: 'Apartment',   tier: 'free', long: 'Long-term rental' },
  house:     { type: 'HOUSE',      label: 'Independent House / Villa',   short: 'House',       tier: 'free', long: 'Long-term rental' },
  land:      { type: 'LAND',       label: 'Land / Plot',                 short: 'Land',        tier: 'free', long: 'Lease or sale' },
  pg:        { type: 'PG',         label: 'PG / Co-living',              short: 'PG',          tier: 'biz',  long: 'Per-bed, monthly' },
  shop:      { type: 'COMMERCIAL', label: 'Shop / Commercial',           short: 'Shop',        tier: 'biz',  long: 'Commercial lease' },
  stay:      { type: 'SHORT_STAY', label: 'Short-stay / Airbnb',         short: 'Short-stay',  tier: 'biz',  long: 'Nightly + calendar' },
}

// The six steps. `k` is the step key used by missingRequirements() and the
// review step's Edit links; `next` is the label on the forward button, so the
// owner always knows what they are walking into.
export const STEPS = [
  { k: 'basics',   n: 1, label: 'Type & basics',   next: 'Location' },
  { k: 'location', n: 2, label: 'Location',        next: 'Photos' },
  { k: 'photos',   n: 3, label: 'Photos',          next: 'Features' },
  { k: 'features', n: 4, label: 'Features & words', next: 'Price' },
  { k: 'pricing',  n: 5, label: 'Price',           next: 'Review' },
  { k: 'review',   n: 6, label: 'Review',          next: null },
]

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

// Specifications, per type — field types: seg (segmented single-select), count
// (+/- stepper), txt (text/number with optional suffix), two (two `txt` fields
// side by side). `k` is a unique key for the field row; each control carries
// its own Property field name(s).
//
// Every row here is something a renter can FILTER on
// (backend/src/features/properties/filters.registry.js). A spec the wizard
// collects but no filter reads is dead weight on the owner; a filter with no
// wizard control behind it matches nothing at all, which is how six amenity
// filters and `saleOrLease` sat broken for months.
export const FIELDS = {
  apartment: [
    { t: 'seg',   k: 'furnished', field: 'furnished', label: 'Furnishing', opts: [['UNFURNISHED', 'Unfurnished'], ['SEMI', 'Semi'], ['FULLY', 'Fully']] },
    { t: 'count', k: 'bathrooms', field: 'bathrooms', label: 'How many bathrooms?' },
    { t: 'txt',   k: 'area', field: 'area', label: 'Built-up area', ph: '1100', suf: 'sq.ft' },
    { t: 'two',   k: 'fl', label: 'Floor details', a: ['floor', 'Unit floor', '4'], b: ['totalFloors', 'Total floors', '12'] },
    { t: 'seg',   k: 'facingDirection', field: 'facingDirection', label: 'Which way does it face?', opts: [['EAST', 'East'], ['WEST', 'West'], ['NORTH', 'North'], ['SOUTH', 'South']] },
  ],
  house: [
    { t: 'count', k: 'bhk', field: 'bhk', label: 'How many bedrooms?' },
    { t: 'count', k: 'bathrooms', field: 'bathrooms', label: 'How many bathrooms?' },
    { t: 'seg',   k: 'furnished', field: 'furnished', label: 'Furnishing', opts: [['UNFURNISHED', 'Unfurnished'], ['SEMI', 'Semi'], ['FULLY', 'Fully']] },
    { t: 'two',   k: 'ar', label: 'Area', a: ['extent', 'Plot area (sq.ft)', '2400'], b: ['area', 'Built-up (sq.ft)', '1800'] },
    { t: 'txt',   k: 'totalFloors', field: 'totalFloors', label: 'How many floors?', ph: '2', suf: '' },
    { t: 'seg',   k: 'facingDirection', field: 'facingDirection', label: 'Which way does it face?', opts: [['EAST', 'East'], ['WEST', 'West'], ['NORTH', 'North'], ['SOUTH', 'South']] },
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
    // Not decoration on a plot — which way it faces sets the build plan, and
    // it's the same `facing` filter a flat is searched by.
    { t: 'seg', k: 'facingDirection', field: 'facingDirection', label: 'Which way does the plot face?', opts: [['EAST', 'East'], ['WEST', 'West'], ['NORTH', 'North'], ['SOUTH', 'South']] },
  ],
  pg: [
    { t: 'seg', k: 'genderPreference', field: 'genderPreference', label: 'Who is it for?', opts: [['ANY', 'Anyone'], ['MALE', 'Men'], ['FEMALE', 'Women']] },
    { t: 'two', k: 'bd', label: 'Beds', a: ['totalBeds', 'Total beds', '24'], b: ['availableBeds', 'Available now', '6'] },
    { t: 'seg', k: 'furnished', field: 'furnished', label: 'How is a room furnished?', opts: [['UNFURNISHED', 'Bare'], ['SEMI', 'Bed + wardrobe'], ['FULLY', 'Fully furnished']] },
    { t: 'txt', k: 'noticePeriodDays', field: 'noticePeriodDays', label: 'Notice period', ph: '30', suf: 'days' },
  ],
  shop: [
    { t: 'two', k: 'ca', label: 'Dimensions', a: ['carpetArea', 'Carpet area (sq.ft)', '850'], b: ['frontage', 'Frontage (ft)', '18'] },
    { t: 'txt', k: 'floor', field: 'floor', label: 'Which floor? (0 = ground)', ph: '0', suf: '' },
    { t: 'txt', k: 'powerLoad', field: 'powerLoad', label: 'Sanctioned power load', ph: '15', suf: 'kW' },
    { t: 'seg', k: 'furnished', field: 'furnished', label: 'What condition is it in?', opts: [['UNFURNISHED', 'Bare shell'], ['SEMI', 'Part-fitted'], ['FULLY', 'Fully fitted']] },
  ],
  stay: [
    { t: 'count', k: 'maxGuests', field: 'maxGuests', label: 'How many guests fit?' },
    { t: 'two', k: 'rm', label: 'Sleeping', a: ['bhk', 'Bedrooms', '2'], b: ['beds', 'Beds', '3'] },
    { t: 'count', k: 'bathrooms', field: 'bathrooms', label: 'How many bathrooms?' },
  ],
}

// House rules, per type. These write to the PropertyRule row, and every one of
// them is a live filter (petsAllowed, smokingAllowed, bachelorAllowed,
// familyPreferred, nonVegAllowed, noCurfew). Until 2026-07-26 the wizard sent
// only `genderPreference`, so a listing it created had no PropertyRule at all
// for the other five — meaning "pets allowed" could never match a home an
// owner had actually said allowed pets.
//
// LAND and COMMERCIAL are absent on purpose, not omitted: nobody smokes in a
// plot. Following propertyTypes.js, what doesn't apply is HIDDEN, not shown
// with a caveat.
export const RULES = {
  apartment: [
    { k: 'bachelorAllowed', label: 'Bachelors allowed',  def: true },
    { k: 'familyPreferred', label: 'Families preferred', def: false },
    { k: 'petsAllowed',     label: 'Pets allowed',       def: false },
    { k: 'nonVegAllowed',   label: 'Non-veg allowed',    def: true },
    { k: 'smokingAllowed',  label: 'Smoking allowed',    def: false },
  ],
  house: [
    { k: 'bachelorAllowed', label: 'Bachelors allowed',  def: true },
    { k: 'familyPreferred', label: 'Families preferred', def: false },
    { k: 'petsAllowed',     label: 'Pets allowed',       def: false },
    { k: 'nonVegAllowed',   label: 'Non-veg allowed',    def: true },
    { k: 'smokingAllowed',  label: 'Smoking allowed',    def: false },
  ],
  pg: [
    { k: 'visitorsAllowed', label: 'Visitors allowed',   def: true },
    { k: 'nonVegAllowed',   label: 'Non-veg allowed',    def: true },
    { k: 'smokingAllowed',  label: 'Smoking allowed',    def: false },
    { k: 'curfewTime', t: 'time', label: 'Curfew', hint: 'Leave empty if there is none — renters filter for “no curfew”' },
  ],
  stay: [
    { k: 'petsAllowed',     label: 'Pets allowed',       def: false },
    { k: 'nonVegAllowed',   label: 'Non-veg allowed',    def: true },
    { k: 'smokingAllowed',  label: 'Smoking allowed',    def: false },
  ],
  land: [],
  shop: [],
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

// How many amenity chips show before the "+N more" expander. Enough that the
// common ones are one tap away, few enough that the title field stays on
// screen — the step has to read as one screen, not a wall of pills.
export const FEATURES_VISIBLE = 15

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

// A first draft of the title, built from answers the owner has already given.
// Offered, never imposed: the wizard pre-fills the empty field once and the
// owner types over it. An owner staring at an empty title box is the single
// most common place a listing is abandoned, and "2 BHK in Koramangala" beats
// nothing at all.
export function suggestTitle(categoryKey, draft) {
  const f = draft.fields ?? {}
  const where = (draft.location?.landmark || '').trim() || (draft.location?.city || '').trim()
  const near = where ? ` near ${where}` : ''
  const at = where ? ` in ${where}` : ''

  switch (categoryKey) {
    case 'apartment':
      return f.bhk ? `${f.bhk} BHK apartment${near}` : ''
    case 'house':
      return f.houseStyle ? `${f.bhk ? `${f.bhk} BHK ` : ''}${f.houseStyle.toLowerCase()}${near}` : ''
    case 'land':
      return f.extent ? `${f.extent} ${f.extentUnit || 'sq.ft'} ${(f.landType || '').toLowerCase()} plot${at}`.replace('  ', ' ') : ''
    case 'pg':
      return f.sharing ? `${f.sharing === 1 ? 'Single' : `${f.sharing}-sharing`} PG${f.genderPreference === 'MALE' ? ' for men' : f.genderPreference === 'FEMALE' ? ' for women' : ''}${at}` : ''
    case 'shop':
      return f.commercialType ? `${f.carpetArea ? `${f.carpetArea} sq.ft ` : ''}${f.commercialType.toLowerCase()}${near}` : ''
    case 'stay':
      return f.placeType ? `${f.placeType}${at}${f.maxGuests ? `, sleeps ${f.maxGuests}` : ''}` : ''
    default:
      return ''
  }
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

// Description prompts — the three questions a renter of THAT type actually
// asks. Shown under the description input as guidance, never enforced.
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

// Pricing fields — `field` is the real Property column each input writes
// to. LAND repurposes `rent`/`deposit` as "total price"/"advance" (no
// separate columns — land doesn't have a monthly rent concept, but every
// Property row needs `rent`/`deposit` populated since map pins/cards read
// them everywhere). SHORT_STAY's `rent` is derived from `nightlyRate` at
// submit time instead of being entered directly.
export const PRICING = {
  apartment: [['rent', 'Monthly rent', '28000'], ['deposit', 'Security deposit', '56000'], ['maintenance', 'Maintenance / mo', '1500']],
  house:     [['rent', 'Monthly rent', '45000'], ['deposit', 'Security deposit', '200000'], ['maintenance', 'Maintenance / mo', '0']],
  // Land in RENT mode means a LEASED plot paid periodically — "Total price"
  // was the label here while the same row also served sales, which read as an
  // asking price on a listing that wasn't for sale. A sold plot uses
  // SALE_PRICING.land instead.
  land:      [['rent', 'Lease rent / year', '120000'], ['deposit', 'Advance', '100000']],
  pg:        [['rent', 'Rent per bed / mo', '9500'], ['deposit', 'Security deposit', '19000']],
  shop:      [['rent', 'Monthly rent', '85000'], ['deposit', 'Security deposit', '510000']],
  stay:      [['nightlyRate', 'Nightly rate', '5250'], ['cleaningFee', 'Cleaning fee', '800'], ['weekendRate', 'Weekend rate', '6500']],
}

// Availability terms that sit beside price, per type — the same step, because
// "what does it cost" and "from when, for how long" are one decision.
// `availableFrom` in particular backs the `availableBy` filter, which nothing
// in the wizard could set before 2026-07-26: every listing had a null
// availability date, so a renter filtering "available by 1 August" was
// filtering against a column no owner had ever filled.
export const TERMS = {
  apartment: [
    { k: 'availableFrom',  t: 'date', label: 'Available from' },
    { k: 'leaseDuration',  t: 'num',  label: 'Minimum stay', suf: 'months', ph: '11' },
  ],
  house: [
    { k: 'availableFrom',  t: 'date', label: 'Available from' },
    { k: 'leaseDuration',  t: 'num',  label: 'Minimum stay', suf: 'months', ph: '11' },
  ],
  land: [
    { k: 'availableFrom',  t: 'date', label: 'Available from' },
  ],
  // PG has no minimum-stay row: its notice period (FIELDS.pg) is the term
  // that actually binds a resident, and beds-per-room is the describe answer.
  pg: [
    { k: 'availableFrom',  t: 'date', label: 'Available from' },
  ],
  shop: [
    { k: 'availableFrom',  t: 'date', label: 'Available from' },
    { k: 'leaseDuration',  t: 'num',  label: 'Lock-in period', suf: 'months', ph: '36' },
  ],
  stay: [
    { k: 'minNights', t: 'num', label: 'Minimum stay', suf: 'nights', ph: '1' },
    { k: 'maxNights', t: 'num', label: 'Maximum stay', suf: 'nights', ph: '28' },
  ],
}

// Categories that can be offered on lease — mirrors the backend's
// LEASE_ELIGIBLE_TYPES (properties.validation.js). PG prices per bed, stay per
// night, land carries its own saleOrLease: none can be leased.
export const LEASE_CATEGORIES = ['apartment', 'house', 'shop']

// Categories that can be SOLD outright — mirrors the backend's
// SALE_ELIGIBLE_TYPES. Anything with a title deed behind it. A PG bed and a
// nightly stay are operating businesses, not assets someone browsing here buys.
export const SALE_CATEGORIES = ['apartment', 'house', 'shop', 'land']

// On a sale `rent` holds the ASKING PRICE and `deposit` the booking advance —
// the same two columns, a third meaning. (Land already worked this way through
// its own saleOrLease field; now it goes through pricingModel like everything
// else, and the old field is written alongside for released mobile builds.)
const SALE_PRICING = {
  apartment: [['rent', 'Asking price', '9500000'], ['deposit', 'Booking advance', '200000'], ['maintenance', 'Maintenance / mo', '1500']],
  house:     [['rent', 'Asking price', '18000000'], ['deposit', 'Booking advance', '500000']],
  shop:      [['rent', 'Asking price', '25000000'], ['deposit', 'Booking advance', '500000']],
  land:      [['rent', 'Asking price', '4500000'], ['deposit', 'Booking advance', '100000']],
}

// Sale terms replace the rental ones wholesale: a minimum stay is meaningless
// when someone is buying, and "is it negotiable" and "will a bank lend" are the
// two questions every Indian buyer asks before they ask anything else.
const SALE_TERMS = {
  apartment: [
    { k: 'possessionStatus', t: 'seg', label: 'Possession', opts: [['Ready to move', 'Ready to move'], ['Under construction', 'Under construction'], ['New launch', 'New launch']] },
    { k: 'availableFrom', t: 'date', label: 'Possession from' },
    { k: 'priceNegotiable', t: 'bool', label: 'Price negotiable' },
    { k: 'loanEligible', t: 'bool', label: 'Bank loan available' },
  ],
  house: [
    { k: 'possessionStatus', t: 'seg', label: 'Possession', opts: [['Ready to move', 'Ready to move'], ['Under construction', 'Under construction'], ['New launch', 'New launch']] },
    { k: 'availableFrom', t: 'date', label: 'Possession from' },
    { k: 'priceNegotiable', t: 'bool', label: 'Price negotiable' },
    { k: 'loanEligible', t: 'bool', label: 'Bank loan available' },
  ],
  shop: [
    { k: 'possessionStatus', t: 'seg', label: 'Possession', opts: [['Ready to move', 'Ready to move'], ['Under construction', 'Under construction'], ['New launch', 'New launch']] },
    { k: 'availableFrom', t: 'date', label: 'Possession from' },
    { k: 'priceNegotiable', t: 'bool', label: 'Price negotiable' },
    { k: 'loanEligible', t: 'bool', label: 'Bank loan available' },
  ],
  // A plot has nothing to build yet, so possession is simply a date. Whether a
  // bank will lend is the load-bearing one here: B-khata and unconverted land
  // are routinely refused, and a buyer needs to know before they visit.
  land: [
    { k: 'availableFrom', t: 'date', label: 'Possession from' },
    { k: 'priceNegotiable', t: 'bool', label: 'Price negotiable' },
    { k: 'loanEligible', t: 'bool', label: 'Bank loan available' },
  ],
}

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
  if (pricingModel === 'SALE' && SALE_PRICING[categoryKey]) return SALE_PRICING[categoryKey]
  if (pricingModel === 'LEASE' && LEASE_PRICING[categoryKey]) return LEASE_PRICING[categoryKey]
  return PRICING[categoryKey]
}

// Same idea for the terms beside the price. A sale and a tenancy ask different
// questions, so the rows swap out rather than being conditionally hidden.
export function termRows(categoryKey, pricingModel = 'RENT') {
  return pricingModel === 'SALE' && SALE_TERMS[categoryKey]
    ? SALE_TERMS[categoryKey]
    : TERMS[categoryKey]
}

// Which modes this category shows a PICKER for.
//
// Land is deliberately absent: it already answers "Sale or lease?" as its first
// spec question (FIELDS.land — a live public filter), so a second mode picker
// would be the same decision stored twice, free to disagree with itself. Land's
// mode is derived from that answer instead, by resolveMode() below.
export function pricingModes(categoryKey) {
  if (categoryKey === 'land') return []
  const modes = ['RENT']
  if (LEASE_CATEGORIES.includes(categoryKey)) modes.push('LEASE')
  if (SALE_CATEGORIES.includes(categoryKey)) modes.push('SALE')
  return modes
}

// The listing's real pricing mode. Everything that reads a price — the price
// rows, the terms, the benchmark, the review summary, the payload — goes
// through this rather than touching draft.pricingModel, so land can't end up
// marked "for sale" while its own saleOrLease field says lease.
//
// A leased plot maps to RENT, not LEASE: this codebase's LEASE means the
// refundable-lump-sum deal (see PricingModel in schema.prisma), and land is let
// for a periodic payment. The backend rejects LEASE for LAND for that reason.
export function resolveMode(categoryKey, draft) {
  if (categoryKey !== 'land') return draft?.pricingModel ?? 'RENT'
  return draft?.fields?.saleOrLease === 'LEASE' ? 'RENT' : 'SALE'
}

export const MODE_COPY = {
  RENT:  { label: 'For rent',  hint: 'Tenant pays every month' },
  LEASE: { label: 'For lease', hint: 'One lump sum, returned when they leave' },
  SALE:  { label: 'For sale',  hint: 'Outright purchase, transferred by deed' },
}

// What the Price step's comparison is called. Mode-aware: the same flat is
// compared against monthly rents in one mode and asking prices in another, and
// calling a ₹4.5Cr comparison "the going rent" would be nonsense.
const RENT_BENCHMARK_LABEL = {
  apartment: 'rent', house: 'rent', pg: 'rent per bed', shop: 'rent', land: 'lease rent', stay: 'nightly rate',
}

export function benchmarkLabel(categoryKey, pricingModel = 'RENT') {
  if (pricingModel === 'SALE') return 'asking price'
  if (pricingModel === 'LEASE') return 'lease amount'
  return RENT_BENCHMARK_LABEL[categoryKey]
}

// Publish-readiness, shared by both platforms' wizards and the review step.
// The only mid-flow gate is the describe selection (step branching and type
// derivation hang off it); everything else surfaces here, at review, with the
// step it belongs to so the review screen can link straight there.
// UX guidance only — the backend re-validates at create/publish.
const OPTIONAL_PRICE_KEYS = ['deposit', 'maintenance', 'cleaningFee', 'weekendRate']

export function missingRequirements(categoryKey, draft) {
  const missing = []
  const add = (stepK, label) => missing.push({ stepK, label })
  if (draft.fields[DESCRIBE[categoryKey].k] === undefined) add('basics', 'Answer the opening question')
  const l = draft.location
  if (l.address.trim().length < 5) add('location', 'Enter a full address')
  if (!l.city) add('location', 'Select a city')
  if (!/^\d{6}$/.test(l.pincode)) add('location', 'Enter a valid 6-digit pincode')
  if (l.lat == null) add('location', 'Drop a pin on the map')
  if (draft.images.length < 1) add('photos', 'Add at least one photo')
  if (draft.title.trim().length < 5) add('features', 'Give it a title (5+ characters)')
  if (draft.description.trim().length < 10) add('features', 'Write a description (10+ characters)')
  for (const [key, label] of pricingRows(categoryKey, resolveMode(categoryKey, draft))) {
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

// HOUSE is the one category whose real PropertyType isn't 1:1 with the
// category key — VILLA/INDEPENDENT_HOUSE get their own enum value, Duplex
// and Row house both fall back to plain HOUSE.
export function deriveType(categoryKey, describeValue) {
  if (categoryKey !== 'house') return CATEGORIES[categoryKey].type
  if (describeValue === 'Villa') return 'VILLA'
  if (describeValue === 'Independent house') return 'INDEPENDENT_HOUSE'
  return 'HOUSE'
}

// The inverse of deriveType(): an existing listing's type back to the wizard
// category whose questions describe it. HOUSE is the many-to-one case again —
// VILLA, INDEPENDENT_HOUSE and HOUSE are all the "house" category, told apart
// by houseStyle.
export function categoryFromType(type) {
  switch (type) {
    case 'APARTMENT': return 'apartment'
    case 'HOUSE':
    case 'VILLA':
    case 'INDEPENDENT_HOUSE': return 'house'
    case 'LAND': return 'land'
    case 'PG': return 'pg'
    case 'COMMERCIAL': return 'shop'
    case 'SHORT_STAY': return 'stay'
    default: return 'apartment'
  }
}

// A saved property → the draft shape the form edits. The inverse of
// buildPayload(), and the reason Add and Edit can be the same component:
// without it, editing needed its own form, its own field list and its own idea
// of what a listing is — which is how web ended up unable to edit a plot's
// survey number or a PG's beds at all.
//
// Money and Decimal columns arrive as strings from Prisma; the form's inputs are
// strings too, so they pass straight through. Numbers are stringified for the
// same reason.
export function draftFromProperty(property, categoryKey) {
  const str = (v) => (v === null || v === undefined ? '' : String(v))
  const isStay = categoryKey === 'stay'

  const fields = {}
  // Only the keys this category actually asks about, so an old value on an
  // irrelevant column can't ride along into the payload.
  const offered = new Set([DESCRIBE[categoryKey].k, ...LAND_RECORD_FIELD_KEYS])
  for (const row of FIELDS[categoryKey]) {
    if (row.field) offered.add(row.field)
    if (row.a) offered.add(row.a[0])
    if (row.b) offered.add(row.b[0])
  }
  for (const key of offered) {
    const value = property[key]
    if (value === null || value === undefined) continue
    fields[key] = typeof value === 'boolean' ? value : str(value)
  }
  // Steppers and the describe choice hold real numbers, not strings.
  for (const key of ['bhk', 'sharing', 'bathrooms', 'maxGuests', 'ecYears']) {
    if (property[key] !== null && property[key] !== undefined) fields[key] = Number(property[key])
  }
  if (property.genderPreference) fields.genderPreference = property.genderPreference
  else if (property.rules?.genderPreference) fields.genderPreference = property.rules.genderPreference

  const rules = {}
  for (const r of RULES[categoryKey] ?? []) {
    const value = property.rules?.[r.k]
    rules[r.k] = r.t === 'time' ? (value ?? '') : (value ?? r.def)
  }

  const pricing = {}
  for (const [key] of pricingRows(categoryKey, property.pricingModel ?? 'RENT')) {
    if (property[key] !== null && property[key] !== undefined) pricing[key] = str(property[key])
  }
  if (isStay && property.nightlyRate != null) pricing.nightlyRate = str(property.nightlyRate)

  const terms = {}
  for (const t of termRows(categoryKey, property.pricingModel ?? 'RENT')) {
    const value = property[t.k]
    if (value === null || value === undefined) continue
    terms[t.k] = t.t === 'date' ? new Date(value).toISOString().slice(0, 10) : t.t === 'bool' ? value : str(value)
  }

  return {
    fields,
    rules,
    amenityNames: (property.amenities ?? []).map((a) => a.amenity?.name).filter(Boolean),
    location: {
      address: property.address ?? '',
      city: property.city ?? '',
      state: property.state ?? '',
      pincode: property.pincode ?? '',
      landmark: property.landmark ?? '',
      lat: property.lat != null ? Number(property.lat) : null,
      lng: property.lng != null ? Number(property.lng) : null,
    },
    images: (property.images ?? []).map((i) => i.url),
    title: property.title ?? '',
    titlePrefilled: false,
    description: property.description ?? '',
    pricingModel: property.pricingModel ?? 'RENT',
    pricing,
    terms,
    // A stored 0 means the owner charges nothing; null means they never said.
    zeroBrokerage: property.brokerage == null ? true : Number(property.brokerage) === 0,
    brokerage: property.brokerage != null && Number(property.brokerage) > 0 ? str(property.brokerage) : '',
    appointmentWindowStart: property.appointmentWindowStart ?? '',
    appointmentWindowEnd: property.appointmentWindowEnd ?? '',
    instantBook: !!property.instantBook,
    blockedDates: [],
  }
}

// Draft fields whose text-input values must reach the backend as numbers —
// everything else stays a string (powerLoad, extentUnit, dimensions, enums).
const NUMERIC_FIELD_KEYS = new Set([
  'bhk', 'sharing', 'bathrooms', 'floor', 'totalFloors', 'area', 'extent', 'roadWidth',
  'carpetArea', 'frontage', 'totalBeds', 'availableBeds', 'noticePeriodDays', 'maxGuests', 'beds',
  'ecYears', 'guidelineValue',
])

// The land-record keys the wizard writes into `draft.fields` from the Location
// step (they need the city, which step 1 doesn't have yet — see
// config/landRecords.js for why the labels are state-specific).
//
// Listed here rather than in FIELDS.land because their labels and options come
// from the city, not from a static config, and because the backend contract test
// needs to know they are legitimately offered for LAND.
export const LAND_RECORD_FIELD_KEYS = [
  'surveyNumber', 'subdivisionNumber', 'landRecordType', 'landRecordNumber',
  'conversionStatus', 'ecAvailable', 'ecYears', 'guidelineValue',
]

// Short-stay defaults when the owner leaves the stay-length terms empty. Same
// values the wizard hardcoded before those terms were askable.
const DEFAULT_MIN_NIGHTS = 1
const DEFAULT_MAX_NIGHTS = 28

// Draft → createPropertySchema payload. Pure function of its arguments,
// shared by both platforms' wizards and the backend contract test
// (backend/tests/wizard-sixtype-contract.test.js) — one copy, so the wizard
// and the test can't drift apart.
export function buildPayload(categoryKey, type, draft, amenityIds) {
  const { fields, location, pricing } = draft
  const terms = draft.terms ?? {}
  const typedFields = {}
  for (const [key, value] of Object.entries(fields)) {
    if (key === 'genderPreference' || value === undefined || value === '') continue
    typedFields[key] = NUMERIC_FIELD_KEYS.has(key) ? Number(value) : value
  }

  const isStay = categoryKey === 'stay'
  const primaryRent = isStay ? Number(pricing.nightlyRate || 0) : Number(pricing.rent || 0)
  // On a lease, `rent` carries the lump sum and there is no second deposit
  // (the backend rejects one). See PricingModel in schema.prisma.
  const pricingModel = resolveMode(categoryKey, draft)
  const isLease = pricingModel === 'LEASE'
  const isSale = pricingModel === 'SALE'
  const num = (v) => (v === undefined || v === '' ? undefined : Number(v))
  const bool = (v) => (typeof v === 'boolean' ? v : undefined)

  const payload = {
    title: draft.title.trim(),
    description: draft.description.trim(),
    type,
    address: location.address.trim(),
    city: location.city,
    state: location.state,
    pincode: location.pincode,
    landmark: location.landmark?.trim() || undefined,
    lat: location.lat,
    lng: location.lng,
    images: draft.images,
    amenityIds,
    ...typedFields,
    pricingModel,
    rent: primaryRent,
    deposit: isLease ? 0 : Number(pricing.deposit ?? 0),
    ...(pricing.maintenance !== undefined && pricing.maintenance !== '' && { maintenance: Number(pricing.maintenance) }),
    // Zero brokerage is the default and the point of the platform; an owner
    // who does charge one has to say so, and it shows on the listing.
    brokerage: draft.zeroBrokerage === false ? Number(draft.brokerage || 0) : 0,
    ...(isStay && {
      nightlyRate: primaryRent,
      cleaningFee: Number(pricing.cleaningFee || 0),
      ...(pricing.weekendRate && { weekendRate: Number(pricing.weekendRate) }),
      minNights: num(terms.minNights) ?? DEFAULT_MIN_NIGHTS,
      maxNights: num(terms.maxNights) ?? DEFAULT_MAX_NIGHTS,
      instantBook: draft.instantBook,
    }),
    // Date-only in the draft (yyyy-mm-dd, what a date input gives); the schema
    // wants a full ISO datetime. On a sale this same field is the possession date.
    ...(terms.availableFrom && { availableFrom: new Date(`${terms.availableFrom}T00:00:00.000Z`).toISOString() }),
    ...(num(terms.leaseDuration) && { leaseDuration: num(terms.leaseDuration) }),
    // Sale-only. Sent only in SALE mode so a rental listing can never carry a
    // possession status or a loan flag that means nothing on it.
    ...(isSale && {
      ...(terms.possessionStatus && { possessionStatus: terms.possessionStatus }),
      ...(bool(terms.priceNegotiable) !== undefined && { priceNegotiable: terms.priceNegotiable }),
      ...(bool(terms.loanEligible) !== undefined && { loanEligible: terms.loanEligible }),
    }),
    ...(draft.appointmentWindowStart && { appointmentWindowStart: draft.appointmentWindowStart }),
    ...(draft.appointmentWindowEnd && { appointmentWindowEnd: draft.appointmentWindowEnd }),
  }

  const rules = buildRules(categoryKey, draft)
  if (rules) payload.rules = rules

  return payload
}

// The PropertyRule payload for a category: its declared defaults, overridden
// by whatever the owner touched, plus PG's gender preference (which lives in
// FIELDS because it shapes the listing, not just its rules).
export function buildRules(categoryKey, draft) {
  const declared = RULES[categoryKey] ?? []
  const answers = draft.rules ?? {}
  const gender = draft.fields?.genderPreference

  if (declared.length === 0 && !gender) return null

  const rules = {}
  for (const r of declared) {
    if (r.t === 'time') {
      const value = (answers[r.k] ?? '').trim()
      if (value) rules[r.k] = value
      continue
    }
    rules[r.k] = answers[r.k] ?? r.def
  }
  if (gender) rules.genderPreference = gender
  return rules
}

// Default rule answers for a fresh draft of this category — the wizard seeds
// its `rules` object with these so the toggles render in the right position
// before anyone touches them.
export function defaultRules(categoryKey) {
  const out = {}
  for (const r of RULES[categoryKey] ?? []) {
    if (r.t === 'time') out[r.k] = ''
    else out[r.k] = r.def
  }
  return out
}

// The same payload as buildPayload(), minus the two things an edit may never
// change: `type` (a listing does not become a different kind of property — that
// is a relist) and `pricingModel` (flipping it silently re-reads `rent`, so an
// ₹8L lease sum would become ₹8L a month). The backend strips both anyway;
// dropping them here means the client isn't lying about what it is sending.
export function buildUpdatePayload(categoryKey, type, draft, amenityIds) {
  const { type: _type, pricingModel: _mode, ...rest } = buildPayload(categoryKey, type, draft, amenityIds)
  return rest
}
