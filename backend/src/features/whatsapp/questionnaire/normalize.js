// Draft → the createPropertySchema payload.
//
// The ONE place a WhatsApp answer becomes a Property column. Mirrors the web
// wizard's buildPayload() (frontend/.../config/onboarding.js) rather than
// importing it — the backend cannot import frontend code — and keeps the same
// three ideas: `rent` is the primary price in every mode, a lease carries no
// deposit, and PG's gender preference lives on the rule row.
//
// Questions that are not Property columns land here too, and nowhere else:
//   parking       → the type's parking amenity
//   foodIncluded  → Breakfast/Lunch/Dinner amenities (PG)
//   boundaryWall  → the 'Boundary Wall' amenity (land)
//   pgName        → the title
//   suitableFor / checkIn / checkOut / foodCharges / details → the description
//   visitContact  → visitContactMethod (the column keeps the longer name)
//
// Nothing here writes. The output is VALIDATED by createPropertySchema in
// publish.service.js before it reaches createProperty(); a field this file gets
// wrong is refused there, never stored.
import { CATEGORIES } from './schemas.js'
import { STATE_OF_CITY } from '../../../config/cities.js'

const DEFAULT_MIN_NIGHTS = 1
const DEFAULT_MAX_NIGHTS = 28

// The four residential styles: `type` derives from houseStyle exactly as the
// wizard's deriveType() does.
function deriveType(category, fields) {
  if (category !== 'house') return CATEGORIES[category].type
  if (fields.houseStyle === 'Villa') return 'VILLA'
  if (fields.houseStyle === 'Independent house') return 'INDEPENDENT_HOUSE'
  return 'HOUSE'
}

// Land: SALE is a sale; "lease" is the platform's RENT mode with
// `saleOrLease: 'LEASE'` and the yearly rent in `rent` — exactly what the web
// wizard sends. Flats, houses and shops carry their own pricingModel question
// (RENT | LEASE lump sum | SALE); PG and stay are always RENT.
function resolvePricingModel(category, fields) {
  if (category === 'land') return fields.saleOrLease === 'SALE' ? 'SALE' : 'RENT'
  if (fields.pricingModel === 'LEASE' || fields.pricingModel === 'SALE') return fields.pricingModel
  return 'RENT'
}

// Meta's wording for the commercial "type" is broader than the four values
// the schema accepts. Restaurant and Other are still retail-shaped spaces for
// a filter; the word the owner chose is preserved in the description.
const COMMERCIAL_TYPE = { 'Retail shop': 'Retail shop', Office: 'Office', Showroom: 'Showroom', Warehouse: 'Warehouse', Restaurant: 'Retail shop', Other: 'Retail shop' }

const PARKING_AMENITY = { apartment: 'Covered Parking', house: 'Covered Parking', shop: 'Parking', stay: 'Parking' }

const RESIDENTIAL_RULE_DEFAULTS = { bachelorAllowed: true, familyPreferred: false, petsAllowed: false, nonVegAllowed: true, smokingAllowed: false }
const PG_RULE_DEFAULTS = { visitorsAllowed: true, nonVegAllowed: true, smokingAllowed: false }
const STAY_RULE_DEFAULTS = { bachelorAllowed: false, familyPreferred: false, petsAllowed: false, nonVegAllowed: true, smokingAllowed: false }

const fmtMoney = (n) => `₹${Number(n).toLocaleString('en-IN')}`

/** The set of amenity NAMES this draft implies (chips + folded booleans). */
export function amenityNames(category, fields) {
  const names = new Set(Array.isArray(fields.amenities) ? fields.amenities : [])
  if (fields.parking === true && PARKING_AMENITY[category]) names.add(PARKING_AMENITY[category])
  if (category === 'pg' && fields.foodIncluded === true) ['Breakfast', 'Lunch', 'Dinner'].forEach((n) => names.add(n))
  if (category === 'land' && fields.boundaryWall === true) names.add('Boundary Wall')
  return [...names]
}

function buildRules(category, fields) {
  const picked = new Set(Array.isArray(fields.rules) ? fields.rules : [])
  const apply = (defaults) => Object.fromEntries(Object.keys(defaults).map((k) => [k, picked.has(k)]))
  if (category === 'apartment' || category === 'house') return apply(RESIDENTIAL_RULE_DEFAULTS)
  if (category === 'stay') return apply(STAY_RULE_DEFAULTS)
  if (category === 'pg') {
    const rules = apply(PG_RULE_DEFAULTS)
    if (fields.genderPreference) rules.genderPreference = fields.genderPreference
    if (picked.has('curfew') && fields.curfewTime) rules.curfewTime = String(fields.curfewTime).slice(0, 20)
    return rules
  }
  return null
}

/** "2 BHK apartment in Velachery" — offered as the title, like suggestTitle(). */
export function buildTitle(category, fields, location) {
  const where = location?.locality || location?.city || ''
  const at = where ? ` in ${where}` : ''
  switch (category) {
    case 'apartment': return `${bhkWord(fields.bhk)} apartment${at}`
    case 'house':     return `${bhkWord(fields.bhk)} ${(fields.houseStyle || 'house').toLowerCase()}${at}`
    case 'land':      return `${fields.extent ?? ''} ${fields.extentUnit || 'sq.ft'} ${(fields.landType || '').toLowerCase()} plot${at}`.replace(/\s+/g, ' ').trim()
    case 'pg':        return fields.pgName ? `${fields.pgName}${at}` : `${fields.sharing === 1 ? 'Single' : `${fields.sharing}-sharing`} PG${fields.genderPreference === 'MALE' ? ' for men' : fields.genderPreference === 'FEMALE' ? ' for women' : ''}${at}`
    case 'shop':      return `${fields.carpetArea ? `${fields.carpetArea} sq.ft ` : ''}${(fields.commercialType || 'commercial space').toLowerCase()}${at}`
    case 'stay':      return `${fields.placeType || 'Stay'}${at}${fields.maxGuests ? `, sleeps ${fields.maxGuests}` : ''}`
    default:          return `Property${at}`
  }
}

function bhkWord(bhk) {
  if (bhk === 0) return 'Studio'
  return bhk != null ? `${bhk} BHK` : ''
}

/**
 * The description: the owner's own words first, then the facts that have no
 * column of their own. Never empty — the schema needs ten characters, and a
 * listing with a blank description reads as abandoned.
 */
export function buildDescription(category, fields, location) {
  const lines = []
  if (fields.details) lines.push(String(fields.details).trim())
  const facts = []
  if (category === 'shop' && (fields.commercialType === 'Restaurant' || fields.commercialType === 'Other')) facts.push(`Space type: ${fields.commercialType}.`)
  if (fields.suitableFor) facts.push(`Suitable for: ${fields.suitableFor}.`)
  if (category === 'pg') {
    if (fields.foodIncluded === true) facts.push('Food included in the rent.')
    if (fields.foodIncluded === false) facts.push(fields.foodCharges ? `Food available at ${fmtMoney(fields.foodCharges)}/month.` : 'Food not included.')
  }
  if (fields.checkIn || fields.checkOut) facts.push(`Check-in ${fields.checkIn || '—'}, check-out ${fields.checkOut || '—'}.`)
  if (category === 'land' && fields.roadWidth) facts.push(`${fields.roadWidth} ft approach road.`)
  if (category === 'land' && fields.priceNegotiable === true) facts.push('Price negotiable.')
  if (facts.length) lines.push(facts.join(' '))
  if (!lines.length) lines.push(`${buildTitle(category, fields, location)}. Listed on StayOnMap via WhatsApp — contact the owner to arrange a visit.`)
  return lines.join('\n\n').slice(0, 2000)
}

/**
 * @param {string} category   apartment | house | land | pg | shop | stay
 * @param {object} draft      { fields, location, photos }
 * @param {Map<string,string>} amenityIdByName  Amenity.name → id
 */
export function buildPropertyPayload(category, draft, amenityIdByName) {
  const fields = draft.fields ?? {}
  const location = draft.location ?? {}
  const type = deriveType(category, fields)
  const pricingModel = resolvePricingModel(category, fields)
  const isStay = category === 'stay'
  const isSale = pricingModel === 'SALE'
  const isLease = pricingModel === 'LEASE'

  const num = (v) => (v == null || v === '' ? undefined : Number(v))
  const str = (v) => (v == null || v === '' ? undefined : String(v))

  const amenityIds = amenityNames(category, fields)
    .map((name) => amenityIdByName.get(name))
    .filter(Boolean)

  const payload = {
    title: (draft.title || buildTitle(category, fields, location)).slice(0, 100),
    description: buildDescription(category, fields, location),
    type,
    address: String(location.address ?? '').trim(),
    city: location.city,
    state: location.state ?? STATE_OF_CITY_TITLE(location.city),
    pincode: str(location.pincode),
    landmark: str(location.locality),
    lat: location.lat,
    lng: location.lng,
    images: (draft.photos ?? []).map((p) => p.url).slice(0, 10),
    amenityIds,
    pricingModel,
    rent: isStay ? num(fields.nightlyRate) : num(fields.rent),
    // A lease carries no deposit — the schema rejects one — even if a deposit
    // was typed before the owner switched the mode at review.
    deposit: isLease ? 0 : num(fields.deposit) ?? 0,
    brokerage: 0,
    ...(num(fields.maintenance) !== undefined && { maintenance: num(fields.maintenance) }),
    ...(num(fields.leaseDuration) >= 1 && { leaseDuration: num(fields.leaseDuration) }),
    ...(num(fields.noticePeriodDays) !== undefined && { noticePeriodDays: num(fields.noticePeriodDays) }),
    ...(isSale && {
      ...(fields.possessionStatus && { possessionStatus: fields.possessionStatus }),
      ...(typeof fields.priceNegotiable === 'boolean' && { priceNegotiable: fields.priceNegotiable }),
      ...(typeof fields.loanEligible === 'boolean' && { loanEligible: fields.loanEligible }),
    }),
    ...(fields.furnished && { furnished: fields.furnished }),
    ...(num(fields.bhk) !== undefined && { bhk: num(fields.bhk) }),
    ...(num(fields.bathrooms) !== undefined && { bathrooms: num(fields.bathrooms) }),
    ...(num(fields.floor) !== undefined && { floor: num(fields.floor) }),
    ...(num(fields.totalFloors) !== undefined && { totalFloors: num(fields.totalFloors) }),
    ...(num(fields.area) !== undefined && { area: num(fields.area) }),
    ...(fields.facingDirection && { facingDirection: fields.facingDirection }),
    ...(fields.availableFrom && { availableFrom: fields.availableFrom }),
    // How to arrange a visit — the same columns the web wizard's Price step
    // writes. Both bounds or neither: a half-window would fail the schema's
    // start-before-end refine on the missing side.
    ...(fields.visitContact && { visitContactMethod: fields.visitContact }),
    ...(fields.appointmentWindowStart && fields.appointmentWindowEnd && {
      appointmentWindowStart: fields.appointmentWindowStart,
      appointmentWindowEnd: fields.appointmentWindowEnd,
    }),
    // HOUSE
    ...(category === 'house' && fields.houseStyle && { houseStyle: fields.houseStyle }),
    ...(category === 'house' && num(fields.extent) !== undefined && { extent: num(fields.extent) }),
    // LAND
    ...(category === 'land' && {
      landType: fields.landType,
      extent: num(fields.extent),
      extentUnit: str(fields.extentUnit) ?? 'sq.ft',
      saleOrLease: fields.saleOrLease,
      ...(str(fields.dimensions) && { dimensions: str(fields.dimensions) }),
      ...(num(fields.roadWidth) !== undefined && { roadWidth: num(fields.roadWidth) }),
      ...(fields.approvalStatus && { approvalStatus: fields.approvalStatus }),
    }),
    // PG
    ...(category === 'pg' && {
      sharing: num(fields.sharing),
      ...(num(fields.totalBeds) !== undefined && { totalBeds: num(fields.totalBeds) }),
      ...(num(fields.availableBeds) !== undefined && { availableBeds: num(fields.availableBeds) }),
    }),
    // COMMERCIAL
    ...(category === 'shop' && {
      commercialType: COMMERCIAL_TYPE[fields.commercialType] ?? 'Retail shop',
      ...(num(fields.carpetArea) !== undefined && { carpetArea: num(fields.carpetArea) }),
      ...(num(fields.frontage) !== undefined && { frontage: num(fields.frontage) }),
      // The column is a string ('15 kW' shape on web); the bot asks a number.
      ...(num(fields.powerLoad) !== undefined && { powerLoad: String(fields.powerLoad) }),
    }),
    // SHORT_STAY
    ...(isStay && (() => {
      const minN = num(fields.minNights) ?? DEFAULT_MIN_NIGHTS
      return {
        placeType: fields.placeType,
        nightlyRate: num(fields.nightlyRate),
        cleaningFee: num(fields.cleaningFee) ?? 0,
        ...(num(fields.weekendRate) !== undefined && { weekendRate: num(fields.weekendRate) }),
        maxGuests: num(fields.maxGuests),
        ...(num(fields.beds) !== undefined && { beds: num(fields.beds) }),
        minNights: minN,
        // A max below the min is a typo, not a policy — never publish one.
        maxNights: Math.max(minN, num(fields.maxNights) ?? DEFAULT_MAX_NIGHTS),
        ...(typeof fields.instantBook === 'boolean' && { instantBook: fields.instantBook }),
      }
    })()),
  }

  const rules = buildRules(category, fields)
  if (rules) payload.rules = rules

  // Strip undefined so Zod's `.optional()` sees absence, not `undefined` keys
  // that confuse a later `in` check.
  for (const k of Object.keys(payload)) if (payload[k] === undefined) delete payload[k]
  return payload
}

// STATE_OF_CITY is India Post's upper-case spelling ('TAMIL NADU'); the
// listing wants the display form the wizard writes ('Tamil Nadu').
function STATE_OF_CITY_TITLE(city) {
  const upper = STATE_OF_CITY[city]
  if (!upper) return undefined
  return upper.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase())
}
