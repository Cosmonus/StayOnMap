// The one number that describes a property, per type.
//
// BHK is meaningless on a plot, sharing is what matters for a PG, guests for a
// short stay, carpet area for a shop — CLAUDE.md's rule that a feature isn't
// done when it works for apartments. Lifted out of PinPreviewCard so the owner's
// listing rows and the renter's map preview can't drift apart.
export function specLabel(property) {
  if (!property) return null
  if (property.type === 'PG') return property.sharing ? `${property.sharing}-Sharing` : null
  if (property.type === 'LAND') {
    return property.extent ? `${property.extent} ${(property.extentUnit ?? '').toLowerCase()}`.trim() : null
  }
  if (property.type === 'SHORT_STAY') return property.maxGuests ? `Up to ${property.maxGuests} guests` : null
  if (property.type === 'COMMERCIAL') return property.carpetArea ? `${property.carpetArea} sq.ft carpet` : null
  if (property.bhk === 0) return 'Studio'
  if (property.bhk) return `${property.bhk} BHK`
  return null
}
