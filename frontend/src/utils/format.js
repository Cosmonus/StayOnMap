// Display formatting helpers

// Append Supabase image transform params to resize images before download.
// Use 'card' for thumbnails (PropertyCard, popups), 'detail' for full-size views.
export const imgUrl = (url, size = 'card') => {
  if (!url || url.startsWith('blob:') || url.startsWith('data:')) return url
  const params = size === 'detail' ? 'width=1200&quality=80' : 'width=480&quality=65'
  return url.includes('?') ? `${url}&${params}` : `${url}?${params}`
}

const locale = typeof navigator !== 'undefined' ? navigator.language : 'en-IN'

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

export const formatArea = (sqft) =>
  `${Number(sqft).toLocaleString(locale)} sq.ft`

export const formatDate = (dateStr) =>
  new Date(dateStr).toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' })

export const formatCompact = (amount) => {
  const n = Number(amount)
  if (n >= 100000) return `₹${(n / 100000).toFixed(1).replace(/\.0$/, '')}L`
  if (n >= 1000)   return `₹${Math.round(n / 1000)}K`
  return formatCurrency(n)
}

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
