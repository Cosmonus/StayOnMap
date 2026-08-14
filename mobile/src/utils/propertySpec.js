// The one number that describes a listing, per type.
//
// "2 BHK" is meaningless on a plot, sharing is the number that matters for a
// PG, guests for a short stay, and carpet area for a shop. CLAUDE.md's standing
// rule — a feature is not done when it works for apartments — applied to the
// smallest possible surface: the line under the price.
//
// Mirror of frontend/src/utils/propertySpec.js — keep the branches in step.
// One deliberate divergence: web returns { Icon, text } with a lucide
// component; mobile surfaces render icons by NAME through the shared Icon map,
// and none of the current callers draw one, so this returns the text alone.
//
// Returns null when the type's own field is missing, and null MEANS null:
// callers omit the line rather than substituting a different type's number.
export function propertySpec(property) {
  if (!property) return null

  switch (property.type) {
    case 'PG':
      return property.sharing ? `${property.sharing}-sharing PG` : null
    case 'LAND':
      // extentUnit is free-ish text from the wizard ("Acres", "cents"), so it
      // is lowercased here rather than mapped — a table would silently drop a
      // unit somebody typed.
      return property.extent
        ? `${property.extent} ${(property.extentUnit ?? '').toLowerCase()}`.trim()
        : null
    case 'SHORT_STAY':
      return property.maxGuests ? `Up to ${property.maxGuests} guests` : null
    case 'COMMERCIAL':
      return property.carpetArea ? `${property.carpetArea} sq.ft carpet` : null
    default:
      // A studio is bhk 0, which is falsy — the check has to be explicit or
      // every studio in the country renders as an unlabelled flat.
      if (property.bhk === 0) return 'Studio'
      return property.bhk ? `${property.bhk} BHK` : null
  }
}
