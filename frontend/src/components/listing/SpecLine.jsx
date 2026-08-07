import { propertySpec } from '@utils/propertySpec'
import { formatArea } from '@utils/format'
import { typeLabel, furnishedLabel } from '@/config/propertyTypes'

// The muted line under a listing's title: what it is, in the terms its own type
// uses. One line, four surfaces, one answer — see utils/propertySpec.js for why
// a shared derivation and not a shared component was the actual fix.
//
// Order is deliberate: the type-specific number first (it is what someone is
// scanning for), then furnishing, then the category word, then size. The
// category comes AFTER furnishing because "2 BHK · Semi furnished · Apartment"
// reads as a sentence and "Apartment · 2 BHK" reads as a database row.
export default function SpecLine({ property, className = '', extra = [] }) {
  const spec = propertySpec(property)

  const parts = [
    spec?.text,
    furnishedLabel(property?.furnished),
    typeLabel(property?.type),
    // Built-up area, only where it is not already the spec — a shop's carpet
    // area is above, and printing both reads as two different rooms.
    // formatArea, not a hand-rolled `${round} sq.ft`: it groups en-IN, so 1050
    // reads 1,050 here exactly as it does on the property page.
    property?.area && property.type !== 'COMMERCIAL' && property.type !== 'LAND'
      ? formatArea(Math.round(Number(property.area)))
      : null,
    ...extra,
  ].filter(Boolean)

  if (!parts.length) return null

  return <p className={`text-xs text-slate-500 truncate ${className}`}>{parts.join(' · ')}</p>
}
