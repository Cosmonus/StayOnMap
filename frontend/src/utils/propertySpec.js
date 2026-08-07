// The one number that describes a listing, per type.
//
// "2 BHK" is meaningless on a plot, sharing is the number that matters for a
// PG, guests for a short stay, and carpet area for a shop. CLAUDE.md's standing
// rule — a feature is not done when it works for apartments — applied to the
// smallest possible surface: the line under the price.
//
// This existed three times with three different answers. PropertyPopup had all
// six branches; PropertyCard had `bhk` only, so a plot, a PG and a short stay
// each showed nothing; SavedHomes had `bhk` or `sharing`, so a plot fell
// through to its landmark. The generic version is not merely plainer — it is
// wrong, which is the whole reason this file is shared rather than copied.
//
// Returns null when the type's own field is missing, and null MEANS null:
// callers omit the line rather than substituting a different type's number.
import { BedDouble, Ruler, Users } from 'lucide-react'

export function propertySpec(property) {
  if (!property) return null

  switch (property.type) {
    case 'PG':
      return property.sharing ? { Icon: BedDouble, text: `${property.sharing}-sharing PG` } : null
    case 'LAND':
      // extentUnit is free-ish text from the wizard ("Acres", "cents"), so it
      // is lowercased here rather than mapped — a table would silently drop a
      // unit somebody typed.
      return property.extent
        ? { Icon: Ruler, text: `${property.extent} ${(property.extentUnit ?? '').toLowerCase()}`.trim() }
        : null
    case 'SHORT_STAY':
      return property.maxGuests ? { Icon: Users, text: `Up to ${property.maxGuests} guests` } : null
    case 'COMMERCIAL':
      return property.carpetArea ? { Icon: Ruler, text: `${property.carpetArea} sq.ft carpet` } : null
    default:
      // A studio is bhk 0, which is falsy — the check has to be explicit or
      // every studio in the country renders as an unlabelled flat.
      if (property.bhk === 0) return { Icon: BedDouble, text: 'Studio' }
      return property.bhk ? { Icon: BedDouble, text: `${property.bhk} BHK` } : null
  }
}
