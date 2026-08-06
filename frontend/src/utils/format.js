// Display formatting helpers

// Pick the right stored variant. Uploads generate a 480px "_thumb.webp" beside
// the 1600px "_full.webp" (the canonical URL stored on the listing), so a card
// list pulls tiny thumbs instead of full-res originals. Use 'card' for
// thumbnails (PropertyCard, popups), 'detail' for full-size views.
// NOTE: the previous "?width=&quality=" params were a no-op — Supabase's
// public storage endpoint ignores them (resizing is a paid Pro feature on a
// different endpoint). Variants are baked at upload time instead.
export const imgUrl = (url, size = 'card') => {
  if (!url || url.startsWith('blob:') || url.startsWith('data:')) return url
  if (url.includes('_full.webp')) {
    return size === 'detail' ? url : url.replace('_full.webp', '_thumb.webp')
  }
  // Legacy images (uploaded before variants existed) have no resized copy.
  return url
}

// Pinned, not navigator.language: prices here are Indian, and only the en-IN
// grouping renders them the way the country reads them — ₹28,00,000, not
// ₹2,800,000. A visitor with a US or UK browser saw the wrong grouping on
// every price on the site while the mobile app (which hardcodes en-IN) showed
// the right one, so the same listing read differently on the two platforms.
const locale = 'en-IN'

const _currencyFmt = new Intl.NumberFormat(locale, {
  style: 'currency', currency: 'INR', maximumFractionDigits: 0,
})

export const currencySymbol = _currencyFmt
  .formatToParts(0)
  .find((p) => p.type === 'currency')?.value ?? '₹'

export const formatCurrency = (amount) =>
  _currencyFmt.format(amount)

export const formatRent = (amount) =>
  `${formatCurrency(amount)}/mo`

// The unit that belongs after a listing's primary price. `rent` holds a MONTHLY
// rent on a RENT listing, a refundable lump sum on a LEASE one, and an ASKING
// PRICE on a SALE one (see PricingModel in schema.prisma), so nothing may
// suffix it blindly. A nightly stay reads per night.
//
// Exported because several surfaces render the number and the unit in different
// type sizes and so can't use formatPrice's single string.
export const priceUnit = (property) => {
  if (property?.type === 'SHORT_STAY') return '/night'
  if (property?.pricingModel === 'SALE') return ''
  if (property?.pricingModel === 'LEASE') return ' lease'
  return '/mo'
}

// Reads a listing's primary price through its pricing model. Pass the property,
// not the number, and this can't go wrong.
export const formatPrice = (property) =>
  `${formatCurrency(Number(property?.rent))}${priceUnit(property)}`

// The same rule as priceUnit, expressed for schema.org. Lives here so the two
// cannot drift: a page that printed "₹18,00,000 lease" while publishing
// "18,00,000 per month" to Google would be telling a search engine something
// nobody on the page was told. UN/CEFACT unit codes — MON month, DAY day.
// A lease lump sum and an asking price have no period at all, so they get a
// plain PriceSpecification rather than a unit-per-something one.
export const offerPriceSpec = (property) => {
  const base = { price: Number(property?.rent), priceCurrency: 'INR' }
  if (property?.type === 'SHORT_STAY') {
    return { '@type': 'UnitPriceSpecification', ...base, unitCode: 'DAY' }
  }
  if (property?.pricingModel === 'SALE' || property?.pricingModel === 'LEASE') {
    return { '@type': 'PriceSpecification', ...base }
  }
  return { '@type': 'UnitPriceSpecification', ...base, unitCode: 'MON' }
}

export const formatArea = (sqft) =>
  `${Number(sqft).toLocaleString(locale)} sq.ft`

export const formatDate = (dateStr) =>
  new Date(dateStr).toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' })

// Crore tier added 2026-07-26, when listings could be for sale: without it a
// ₹4.5Cr asking price rendered "₹450L", which nobody in India reads as a price.
export const formatCompact = (amount) => {
  const n = Number(amount)
  if (n >= 10000000) return `₹${(n / 10000000).toFixed(2).replace(/\.?0+$/, '')}Cr`
  if (n >= 100000) return `₹${(n / 100000).toFixed(1).replace(/\.0$/, '')}L`
  if (n >= 1000)   return `₹${Math.round(n / 1000)}K`
  return formatCurrency(n)
}

// Compact price plus its unit — what a map pin, a card and a preview all need.
export const formatCompactPrice = (property) =>
  `${formatCompact(Number(property?.rent))}${priceUnit(property)}`

export const formatAge = (dateStr) => {
  if (!dateStr) return null
  const days = Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000)
  if (days === 0) return 'Today'
  if (days === 1) return 'Yesterday'
  if (days < 7)  return `${days}d ago`
  if (days < 30) return `${Math.floor(days / 7)}w ago`
  if (days < 365) return `${Math.floor(days / 30)}mo ago`
  return `${Math.floor(days / 365)}y ago`
}

export const isAvailableToday = (availableFrom) =>
  !availableFrom || new Date(availableFrom) <= new Date()
