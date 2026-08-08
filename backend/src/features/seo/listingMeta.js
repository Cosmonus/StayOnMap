// Title, description and structured data for one listing.
//
// Built from the listing's own FACTS, never from the owner's prose. The
// description an owner writes is the first thing exaggerated and often empty,
// and a search result is where a wrong claim costs the most.
//
// Per-type by construction, following CLAUDE.md's rule: a plot is not "2 BHK",
// a shop has no bedrooms, a PG is priced per bed and a short stay per night.
// A generic template here would not be plain, it would be wrong — "Land for
// rent in Chennai — ₹45,00,000/mo" is the kind of sentence that ends trust.
//
// Address handling: this reads the PUBLIC payload, which has already had
// `applyLocationPrivacy` run over it, so `address` is null and coordinates are
// coarsened whenever the owner asked for that. `landmark`/`city`/`pincode`
// deliberately survive that filter, so those are what the structured data
// carries. The street address rides the same rule the page does: present when
// the owner shares it, absent — not blank — when they did not.
import { ORIGIN } from './prerender.service.js'
import { breadcrumbFor } from './localityMeta.js'

const inr = (n) => `₹${new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(Number(n))}`

// schema.org types, one per wizard category. `Accommodation` is the honest
// parent for a PG bed and a short stay — neither is an Apartment, and calling
// them one would be structured data that contradicts the page.
const SCHEMA_TYPE = {
  APARTMENT: 'Apartment',
  HOUSE: 'House',
  VILLA: 'House',
  INDEPENDENT_HOUSE: 'House',
  PG: 'Accommodation',
  SHORT_STAY: 'Accommodation',
  COMMERCIAL: 'Place',
  LAND: 'Place',
}

const NOUN = {
  APARTMENT: 'Apartment',
  HOUSE: 'House',
  VILLA: 'Villa',
  INDEPENDENT_HOUSE: 'Independent house',
  PG: 'PG',
  SHORT_STAY: 'Short stay',
  COMMERCIAL: 'Commercial space',
  LAND: 'Plot',
}

/** Where the listing is, in the words a person would search with. */
export function localityOf(property) {
  return [property.landmark, property.city].filter(Boolean).join(', ') || property.city || 'India'
}

/**
 * The price, and the unit that actually applies. Four different meanings live
 * in these columns and printing "/mo" on all of them is the single most
 * misleading thing this file could do:
 *   SHORT_STAY   nightlyRate, per night
 *   LEASE        `rent` is a refundable lump sum, not a monthly figure
 *   LAND (sale)  `rent` is the asking price
 *   otherwise    monthly rent
 */
export function priceLabel(property) {
  if (property.type === 'SHORT_STAY' && property.nightlyRate) {
    return `${inr(property.nightlyRate)}/night`
  }
  // `pricingModel` is the canonical signal and the one every frontend surface
  // reads (PropertyCard, ActionCard, PropertyPopup, PropertiesPage). LAND also
  // carries a legacy `saleOrLease` string; keying off that instead would have
  // left every plot marked "for rent" — caught before this shipped.
  if (property.pricingModel === 'SALE') return inr(property.rent)
  if (property.pricingModel === 'LEASE') return `${inr(property.rent)} lease`
  return `${inr(property.rent)}/mo`
}

/** "2 BHK", "3-sharing", "1200 sq.ft" — whatever this type is measured in. */
function specOf(property) {
  switch (property.type) {
    case 'PG':
      return property.sharing ? `${property.sharing}-sharing` : null
    case 'LAND':
      return property.extent ? `${property.extent} ${property.extentUnit ?? 'sq.ft'}` : null
    case 'COMMERCIAL':
      return property.carpetArea ? `${property.carpetArea} sq.ft` : null
    case 'SHORT_STAY':
      return property.maxGuests ? `Sleeps ${property.maxGuests}` : null
    default:
      if (property.bhk === 0) return 'Studio'
      return property.bhk ? `${property.bhk} BHK` : null
  }
}

/** The verb a listing of this type is offered under. */
function action(property) {
  if (property.type === 'SHORT_STAY') return 'for short stays'
  if (property.pricingModel === 'SALE') return 'for sale'
  if (property.pricingModel === 'LEASE') return 'for lease'
  return 'for rent'
}

export function titleFor(property) {
  const spec = specOf(property)
  const noun = NOUN[property.type] ?? 'Property'
  const head = spec ? `${spec} ${noun.toLowerCase()}` : noun
  // Capitalise the first character only — "2 BHK apartment", not "2 Bhk Apartment".
  const subject = head.charAt(0).toUpperCase() + head.slice(1)
  return `${subject} ${action(property)} in ${localityOf(property)} — ${priceLabel(property)} | StayOnMap`
}

export function descriptionFor(property) {
  const parts = []
  const spec = specOf(property)
  if (spec) parts.push(spec)
  if (property.furnished) {
    parts.push({ FULLY: 'fully furnished', SEMI: 'semi furnished', UNFURNISHED: 'unfurnished' }[property.furnished])
  }
  if (property.type !== 'LAND' && property.area) parts.push(`${property.area} sq.ft`)

  const lead = parts.length
    ? `${parts.join(', ')} ${NOUN[property.type]?.toLowerCase() ?? 'property'}`
    : (NOUN[property.type] ?? 'Property')

  const bits = [
    `${lead} ${action(property)} in ${localityOf(property)}.`,
    `${priceLabel(property)}.`,
    property.deposit ? `Deposit ${inr(property.deposit)}.` : null,
    // The differentiator, and it is true of every listing here rather than a
    // claim about this one.
    'No brokerage — deal directly with the owner on StayOnMap.',
  ]
  // Search engines truncate around 160 characters; a description cut mid-word
  // in a result is worse than a shorter complete one.
  return bits.filter(Boolean).join(' ').slice(0, 300)
}

function primaryImage(property) {
  const images = property.images ?? []
  return (images.find((i) => i.isPrimary) ?? images[0])?.url ?? null
}

export function jsonLdFor(property) {
  const url = `${ORIGIN}/property/${property.id}`
  const images = (property.images ?? []).map((i) => i.url).filter(Boolean).slice(0, 6)

  const about = {
    '@type': SCHEMA_TYPE[property.type] ?? 'Place',
    name: property.title,
    address: {
      '@type': 'PostalAddress',
      // Omitted, never blanked, when the owner coarsened their pin. This is
      // self-enforcing rather than a second privacy rule to keep in sync:
      // `applyLocationPrivacy` nulls `address` upstream, so the absence of the
      // field IS the owner's choice, and structured data ends up mirroring
      // exactly what the page shows.
      ...(property.address ? { streetAddress: property.address } : {}),
      addressLocality: property.landmark || property.city,
      addressRegion: property.state ?? undefined,
      postalCode: property.pincode ?? undefined,
      addressCountry: 'IN',
    },
  }

  // Only claim what this type actually has. An `Apartment` with no bedrooms is
  // an incomplete record; a `Place` (plot, shop) with `numberOfBedrooms: 0` is
  // a false one.
  if (['APARTMENT', 'HOUSE', 'VILLA', 'INDEPENDENT_HOUSE'].includes(property.type) && property.bhk != null) {
    about.numberOfBedroomsTotal = property.bhk
  }
  if (property.bathrooms) about.numberOfBathroomsTotal = property.bathrooms
  if (property.area) {
    about.floorSize = { '@type': 'QuantitativeValue', value: Number(property.area), unitCode: 'FTK' }
  }
  if (property.type === 'SHORT_STAY' && property.maxGuests) about.occupancy = {
    '@type': 'QuantitativeValue', value: property.maxGuests,
  }

  const price = property.type === 'SHORT_STAY' && property.nightlyRate
    ? Number(property.nightlyRate)
    : Number(property.rent)

  return {
    '@context': 'https://schema.org',
    '@type': 'RealEstateListing',
    name: titleFor(property).replace(' | StayOnMap', ''),
    description: descriptionFor(property),
    url,
    datePosted: property.submittedAt ?? property.createdAt ?? undefined,
    image: images.length ? images : undefined,
    about,
    // The locality rung appears ONLY for a listing resolved to a real Locality
    // entity, because that is the only case where the URL it points at is a
    // page we are willing to have indexed. A landmark-derived locality page is
    // `noindex` (see locality.service.js's isIndexable), and advertising a
    // breadcrumb into one would be pointing structured data at a page we have
    // just asked Google to ignore.
    breadcrumb: breadcrumbFor([
      { name: 'Rentals', url: `${ORIGIN}/properties` },
      ...(property.locality?.slug && property.locality?.citySlug
        ? [{
          name: `${property.locality.name}, ${property.city}`,
          url: `${ORIGIN}/rent/${property.locality.citySlug}/${property.locality.slug}`,
        }]
        : []),
      { name: titleFor(property).replace(' | StayOnMap', ''), url },
    ]),
    offers: {
      '@type': 'Offer',
      price,
      priceCurrency: 'INR',
      // LeaseOut, not Sell — except for a plot actually being sold. The
      // vocabulary difference is the whole point of having it.
      businessFunction: property.pricingModel === 'SALE'
        ? 'http://purl.org/goodrelations/v1#Sell'
        : 'http://purl.org/goodrelations/v1#LeaseOut',
      availability: property.status === 'ACTIVE'
        ? 'https://schema.org/InStock'
        : 'https://schema.org/OutOfStock',
      url,
    },
  }
}

export function metaForProperty(property) {
  return {
    title: titleFor(property),
    description: descriptionFor(property),
    canonical: `${ORIGIN}/property/${property.id}`,
    image: primaryImage(property),
    type: 'article',
    jsonLd: jsonLdFor(property),
  }
}
