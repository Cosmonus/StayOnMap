import { formatCurrency, formatCompact, priceUnit } from '@utils/format'

// A listing's primary price, everywhere it appears.
//
// THE RULE THIS EXISTS TO ENFORCE: take the PROPERTY, never the number. `rent`
// holds a monthly rent on a RENT listing, a refundable lump sum on a LEASE one,
// an asking price on a SALE one, and a nightly rate on a short stay — so
// `₹{rent}/mo` is wrong on three of the four, and wrong in the direction that
// costs somebody real money. Every surface that hand-wrote that suffix had to
// remember; this one cannot forget, because it never sees a bare number.
//
// The unit is rendered as its own <span> rather than baked into one string
// because every surface sizes the two differently — that is exactly why
// `priceUnit` is exported from format.js alongside `formatPrice`.
const SIZES = {
  // In a grid card the price is the first thing scanned, but it shares the row
  // with a deposit.
  card:    { amount: 'text-xl',  unit: 'text-xs' },
  // Map popup / bottom sheet: one listing, nothing competing.
  preview: { amount: 'text-2xl', unit: 'text-sm' },
  // The property page.
  hero:    { amount: 'text-3xl', unit: 'text-base' },
}

export default function Price({ property, size = 'card', compact = false, className = '' }) {
  if (!property?.rent && property?.rent !== 0) return null

  const s = SIZES[size] ?? SIZES.card
  const amount = Number(property.rent)
  const unit = priceUnit(property)

  return (
    <p className={`font-mono font-bold text-slate-900 leading-none ${s.amount} ${className}`}>
      {compact ? formatCompact(amount) : formatCurrency(amount)}
      {/* A SALE price has no unit at all — priceUnit returns '' — and an empty
          span would still add its margin. */}
      {unit && <span className={`font-sans font-normal text-slate-500 ml-1 ${s.unit}`}>{unit}</span>}
    </p>
  )
}
