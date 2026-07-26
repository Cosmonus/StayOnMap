import { useQuery } from '@tanstack/react-query'
import { propertyService } from '@services/property.service'
import { formatCurrency } from '@utils/format'
import { benchmarkLabel, DESCRIBE, deriveType, resolveMode } from '../../config/onboarding.js'

// What comparable live listings ask, beside the price field — not after
// publishing, which is when the owner finds out the hard way.
//
// Shows a band and a median, never a recommended price: we have no basis for
// telling anyone what their home is worth, and a single number reads as
// advice. Below three comparables it says so rather than inventing a market.

function compact(n) {
  if (n >= 10_000_000) return `₹${(n / 10_000_000).toFixed(1).replace(/\.0$/, '')}Cr`
  if (n >= 100_000) return `₹${(n / 100_000).toFixed(1).replace(/\.0$/, '')}L`
  if (n >= 1000) return `₹${Math.round(n / 1000)}K`
  return formatCurrency(n)
}

export default function BenchmarkCard({ categoryKey, draft }) {
  const describeValue = draft.fields[DESCRIBE[categoryKey].k]
  const type = deriveType(categoryKey, describeValue)
  const city = draft.location.city
  const pricingModel = resolveMode(categoryKey, draft)
  const params = {
    city,
    type,
    pricingModel,
    ...(categoryKey === 'pg' ? { sharing: draft.fields.sharing } : {}),
    ...(draft.fields.bhk !== undefined && categoryKey !== 'pg' ? { bhk: Number(draft.fields.bhk) } : {}),
  }

  const { data } = useQuery({
    queryKey: ['price-benchmark', params],
    queryFn: () => propertyService.getBenchmark(params).then((r) => r.data),
    enabled: Boolean(city),
    staleTime: 10 * 60 * 1000,
  })

  const noun = benchmarkLabel(categoryKey, pricingModel)
  const where = (draft.location.landmark || city || '').trim()

  if (!city) {
    return (
      <div className="p-5 rounded-2xl bg-slate-50">
        <p className="text-sm text-slate-600">Pick a city on the location step and we&apos;ll show what comparable listings ask.</p>
      </div>
    )
  }

  if (!data) return <div className="h-40 rounded-2xl bg-slate-100 animate-pulse" />

  if (!data.available) {
    return (
      <div className="p-5 rounded-2xl bg-slate-50">
        <p className="text-xs font-bold tracking-widest text-slate-500 uppercase">{where}</p>
        <p className="text-sm text-slate-600 mt-2 leading-relaxed">
          Only {data.count} comparable {data.count === 1 ? 'listing is' : 'listings are'} live here — too few to say
          what the going {noun} is. Price it on what you know about the place.
        </p>
      </div>
    )
  }

  // The primary price the owner is typing, on the same scale as the band.
  const mine = Number(draft.pricing[categoryKey === 'stay' ? 'nightlyRate' : 'rent'] || 0)
  const span = Math.max(1, data.p75 - data.p25)
  const at = mine > 0 ? Math.min(1, Math.max(0, (mine - data.p25) / span)) : null
  const delta = mine > 0 ? Math.round(((mine - data.median) / data.median) * 100) : null

  return (
    <div className="p-5 rounded-2xl bg-brand-50">
      <p className="text-xs font-bold tracking-widest text-brand-800 uppercase">
        {where}{describeValue ? ` · ${categoryKey === 'apartment' || categoryKey === 'house' ? `${describeValue} BHK` : describeValue}` : ''}
      </p>
      <p className="font-display font-bold text-3xl text-brand-800 mt-2">
        {compact(data.p25)} <span className="text-brand-600">–</span> {compact(data.p75)}
      </p>
      <p className="text-sm text-brand-900/70 mt-1">
        Median {formatCurrency(data.median)} across {data.count} live {data.count === 1 ? 'listing' : 'listings'}
      </p>

      <div className="relative h-1.5 rounded-full bg-brand-200 mt-4">
        {at !== null && (
          <span
            className="absolute -top-1 w-3.5 h-3.5 rounded-full bg-brand-700 border-2 border-white"
            style={{ left: `calc(${at * 100}% - 7px)` }}
            aria-hidden="true"
          />
        )}
      </div>

      {delta !== null && (
        <p className="text-sm font-semibold text-brand-800 mt-3 leading-relaxed">
          {delta === 0
            ? `Yours is right on the median ${noun}.`
            : delta < 0
              ? `Yours is ${Math.abs(delta)}% below median — expect faster enquiries.`
              : `Yours is ${delta}% above median — expect fewer, slower enquiries.`}
        </p>
      )}
    </div>
  )
}
