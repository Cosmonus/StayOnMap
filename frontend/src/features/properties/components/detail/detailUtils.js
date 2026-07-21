// Shared helpers for the property detail body — used by the public property
// page and the admin detail view (see PropertyDetailBody.jsx).

export function ordinal(n) {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return n + (s[(v - 20) % 10] || s[v] || s[0])
}

export function availabilityTag(property) {
  const { status, availableFrom } = property
  if (status === 'INACTIVE' || status === 'SUSPENDED')
    return { label: 'Not Available', dot: 'bg-slate-400', text: 'text-slate-500', bg: 'bg-slate-50' }
  if (status === 'PENDING')
    return { label: 'Awaiting Approval', dot: 'bg-amber-400', text: 'text-amber-600', bg: 'bg-amber-50' }
  if (status === 'DRAFT')
    return { label: 'Draft', dot: 'bg-slate-300', text: 'text-slate-400', bg: 'bg-slate-50' }
  if (availableFrom) {
    const d = new Date(availableFrom)
    if (d > new Date())
      return {
        label: `Available from ${d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}`,
        dot: 'bg-blue-500', text: 'text-blue-600', bg: 'bg-blue-50',
      }
  }
  return { label: 'Available now', dot: 'bg-emerald-500', text: 'text-emerald-700', bg: 'bg-emerald-50' }
}

// The enum arrives SCREAMING_CASE. Lowercasing first matters — without it
// 'HOUSE' survives untouched (its first letter is already capital) and the page
// shouts "HOUSE" at the reader.
export function formatType(type) {
  if (!type) return ''
  return type.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, c => c.toUpperCase())
}

export function formatFurnished(f) {
  if (!f) return ''
  const map = { FULLY: 'Fully Furnished', SEMI: 'Semi Furnished', UNFURNISHED: 'Unfurnished' }
  return map[f] ?? f
}

export function bhkLabelFor(property) {
  return property.type === 'PG'
    ? `${property.sharing}-Sharing PG`
    : property.bhk ? `${property.bhk} BHK` : null
}

// Uses only our own listings data — no external API. Requires at least 3
// comparable listings (same city + BHK/sharing) so a lone other listing
// can't masquerade as "the area average" (see properties.service.js).
export function rentBenchmarkLabel(rent, benchmark) {
  if (!benchmark) return null
  const diff = Math.round(((rent - benchmark.avgRent) / benchmark.avgRent) * 100)
  if (diff === 0) return { text: 'Right at the average for similar homes nearby', className: 'text-slate-400' }
  const below = diff < 0
  return {
    text: `${Math.abs(diff)}% ${below ? 'below' : 'above'} the average for similar homes nearby`,
    className: below ? 'text-emerald-600' : 'text-amber-600',
  }
}

export function directionsUrlFor(lat, lng) {
  if (!lat || !lng) return null
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`
}
