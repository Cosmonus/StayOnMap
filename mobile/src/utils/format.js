// Ported from frontend/src/utils/format.js — locale hardcoded to en-IN
// (RN has no reliable navigator.language; this app is India-only anyway).

// Pick the right stored variant. Uploads generate a 480px "_thumb.webp" beside
// the 1600px "_full.webp" (the canonical URL stored on the listing), so a card
// list pulls tiny thumbs instead of full-res originals. 'card' → thumb,
// 'detail' → full. The old "?width=&quality=" params were a no-op against
// Supabase's public storage endpoint; variants are baked at upload time now.
export const imgUrl = (url, size = 'card') => {
  if (!url || url.startsWith('blob:') || url.startsWith('data:')) return url
  if (url.includes('_full.webp')) {
    return size === 'detail' ? url : url.replace('_full.webp', '_thumb.webp')
  }
  // Legacy images (uploaded before variants existed) have no resized copy.
  return url
}

const _currencyFmt = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
})

export const currencySymbol = _currencyFmt.formatToParts(0).find((p) => p.type === 'currency')?.value ?? '₹'

export const formatCurrency = (amount) => _currencyFmt.format(amount)

export const formatRent = (amount) => `${formatCurrency(amount)}/mo`

// Reads a listing's primary price through its pricing model. `rent` holds the
// MONTHLY rent on a RENT listing but the refundable lump sum on a LEASE one
// (see PricingModel in schema.prisma) — so it must never be blindly suffixed
// "/mo". Pass the property, not the number, and this can't go wrong.
export const formatPrice = (property) =>
  property?.pricingModel === 'LEASE'
    ? `${formatCurrency(Number(property.rent))} lease`
    : formatRent(Number(property?.rent))

export const formatArea = (sqft) => `${Number(sqft).toLocaleString('en-IN')} sq.ft`

export const formatDate = (dateStr) =>
  new Date(dateStr).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })

export const formatCompact = (amount) => {
  const n = Number(amount)
  if (n >= 100000) return `₹${(n / 100000).toFixed(1).replace(/\.0$/, '')}L`
  if (n >= 1000) return `₹${Math.round(n / 1000)}K`
  return formatCurrency(n)
}

export const formatAge = (dateStr) => {
  if (!dateStr) return null
  const days = Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000)
  if (days === 0) return 'Today'
  if (days === 1) return 'Yesterday'
  if (days < 7) return `${days}d ago`
  if (days < 30) return `${Math.floor(days / 7)}w ago`
  if (days < 365) return `${Math.floor(days / 30)}mo ago`
  return `${Math.floor(days / 365)}y ago`
}

export const isAvailableToday = (availableFrom) => !availableFrom || new Date(availableFrom) <= new Date()
