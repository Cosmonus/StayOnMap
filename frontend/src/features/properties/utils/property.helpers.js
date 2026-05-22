// Pure helpers for displaying property data

export function formatRent(amount) {
  // TODO: "₹12,000/mo"
  return `₹${amount.toLocaleString('en-IN')}/mo`
}

export function formatBhk(bhk) {
  return bhk === 0 ? 'Studio' : `${bhk} BHK`
}

export function furnishedLabel(type) {
  const map = { FULLY: 'Fully Furnished', SEMI: 'Semi Furnished', UNFURNISHED: 'Unfurnished' }
  return map[type] ?? type
}
