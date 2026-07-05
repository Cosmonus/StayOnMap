import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { propertyService } from '@services/property.service'
import { useFilterStore } from '@store/filterStore'
import PropertyCard from '@features/properties/components/PropertyCard'
import SEOMeta from '@components/common/SEOMeta'
import { canonical } from '@lib/seo'

function CardSkeleton() {
  return (
    <div className="animate-pulse">
      <div className="aspect-[4/3] rounded-2xl bg-slate-100" />
      <div className="pt-3 space-y-2">
        <div className="h-5 w-24 bg-slate-100 rounded" />
        <div className="h-4 w-40 bg-slate-100 rounded" />
        <div className="h-3 w-28 bg-slate-100 rounded" />
      </div>
    </div>
  )
}

function EmptySlotCard() {
  return (
    <div className="aspect-[4/3] rounded-2xl border border-dashed border-slate-200 flex flex-col items-center justify-center gap-2 text-center px-3">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#cbd5e1" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z" />
      </svg>
      <p className="text-xs text-slate-400 leading-snug">More rentals<br />coming soon</p>
    </div>
  )
}

export default function PropertiesPage() {
  const filters = useFilterStore((s) => s.filters)

  const params = useMemo(() => {
    const p = { limit: 50 }
    if (filters.city)       p.city = filters.city
    if (filters.furnished)  p.furnished = filters.furnished
    if (filters.bhk?.length) p.bhk = filters.bhk.join(',')
    return p
  }, [filters.city, filters.furnished, filters.bhk])

  const { data, isLoading, isError } = useQuery({
    queryKey: ['properties', params],
    queryFn: () => propertyService.getList(params).then((r) => r.data),
  })

  const properties = data ?? []
  const locationLabel = filters.city || null

  // Pad the grid so the last row is never left lopsided — targets the widest
  // breakpoint's column count (4); narrower breakpoints may not land on a
  // perfectly complete row, same tradeoff as the homepage's featured strip.
  const emptySlotCount = properties.length === 0 ? 4 : (4 - (properties.length % 4)) % 4

  const pageTitle = locationLabel
    ? `Rental Properties in ${locationLabel}`
    : 'Browse Rental Properties'
  const pageDesc = locationLabel
    ? `Browse broker-free rental properties in ${locationLabel} — no broker fees.`
    : 'Browse broker-free rental properties across India — no broker fees.'

  return (
    <>
      <SEOMeta title={pageTitle} description={pageDesc} canonical={canonical('/properties')} />

      <main className="min-h-screen bg-white pt-28 md:pt-40 pb-20">
        <div className="w-[80%] mx-auto">
          <div className="mb-6">
            <h1 className="font-display font-bold text-2xl sm:text-3xl text-slate-900 tracking-tight">
              All properties{locationLabel ? ` in ${locationLabel}` : ''}
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              {isLoading
                ? 'Loading listings…'
                : properties.length === 0
                ? 'No properties match your filters — try clearing the city or furnishing filter.'
                : `${properties.length} home${properties.length !== 1 ? 's' : ''} available`}
            </p>
          </div>

          {isError ? (
            <div className="py-24 text-center text-slate-400">
              Couldn&apos;t load properties. Please try again.
            </div>
          ) : isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-x-5 gap-y-8">
              {Array.from({ length: 8 }).map((_, i) => <CardSkeleton key={i} />)}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-x-5 gap-y-8">
              {properties.map((property) => (
                <PropertyCard key={property.id} property={property} isSaved={property.isSaved} />
              ))}
              {Array.from({ length: emptySlotCount }).map((_, i) => (
                <EmptySlotCard key={`empty-${i}`} />
              ))}
            </div>
          )}
        </div>
      </main>
    </>
  )
}
