import { useEffect, useMemo, useState } from 'react'
import { useQuery, keepPreviousData } from '@tanstack/react-query'
import PropertyCard from '@features/properties/components/PropertyCard'
import { propertyService } from '@services/property.service'
import { useFilterStore } from '@store/filterStore'
import { useMapStore } from '@store/mapStore'

const PAGE_SIZE = 10

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

function TagIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
      <path d="M20.59 13.41 13.42 20.58a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
      <circle cx="7" cy="7" r="1.2" fill="currentColor" stroke="none" />
    </svg>
  )
}

// Left pane of the homepage split: a scrollable 2-column grid of listing cards
// synced to the map's current viewport (bounds come from useMapBounds inside
// MapView) and the active filters. The map lives to its right, in HomePage.
export default function MapPropertiesList() {
  const bounds = useMapStore((s) => s.bounds)
  const setHoveredPinId = useMapStore((s) => s.setHoveredPinId)
  const filters = useFilterStore((s) => s.filters)
  const [page, setPage] = useState(1)

  // A new viewport or filter set is a different result set — always start
  // back at page 1 rather than stranding the user on a page that may no
  // longer exist.
  useEffect(() => {
    setPage(1)
  }, [bounds?.swLat, bounds?.swLng, bounds?.neLat, bounds?.neLng, filters.city, filters.furnished, filters.bhk])

  const params = useMemo(() => {
    if (!bounds) return null
    return {
      page,
      limit: PAGE_SIZE,
      swLat: bounds.swLat,
      swLng: bounds.swLng,
      neLat: bounds.neLat,
      neLng: bounds.neLng,
      city: filters.city || undefined,
      furnished: filters.furnished || undefined,
      bhk: filters.bhk?.length ? filters.bhk.join(',') : undefined,
    }
  }, [bounds, filters.city, filters.furnished, filters.bhk, page])

  const { data, isLoading, isError } = useQuery({
    queryKey: ['properties-in-view', params],
    queryFn: () => propertyService.getList(params).then((r) => ({ properties: r.data, meta: r.meta })),
    enabled: !!params,
    placeholderData: keepPreviousData,
  })

  const properties = data?.properties ?? []
  const totalPages = data?.meta?.totalPages ?? 1
  const loading = !bounds || isLoading
  const heading = loading
    ? 'Homes within map area'
    : `${data?.meta?.total ?? properties.length} home${(data?.meta?.total ?? properties.length) !== 1 ? 's' : ''} within map area`

  return (
    <div className="pr-1">
      <div className="flex items-center justify-between gap-3 mb-5">
        <h2 className="font-display font-bold text-xl md:text-2xl text-slate-900 tracking-tight truncate">
          {heading}
        </h2>
        <span className="flex items-center gap-1.5 text-xs font-semibold text-brand-600 shrink-0">
          <TagIcon />
          No broker fees
        </span>
      </div>

      {isError ? (
        <p className="text-sm text-slate-400 py-16 text-center">Couldn&apos;t load properties.</p>
      ) : loading ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-5 gap-y-8">
          {Array.from({ length: 6 }).map((_, i) => <CardSkeleton key={i} />)}
        </div>
      ) : properties.length === 0 ? (
        <div className="py-16 text-center">
          <p className="text-sm font-medium text-slate-500">No homes in this area.</p>
          <p className="text-xs text-slate-400 mt-1">Try zooming out or panning the map.</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-5 gap-y-8">
            {properties.map((property) => (
              <div
                key={property.id}
                onMouseEnter={() => setHoveredPinId(property.id)}
                onMouseLeave={() => setHoveredPinId(null)}
              >
                <PropertyCard property={property} isSaved={property.isSaved} />
              </div>
            ))}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between gap-3 mt-6">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="px-4 py-2 rounded-xl text-sm font-semibold border border-slate-200 text-slate-700 hover:border-slate-400 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:border-slate-200 transition-colors"
              >
                Prev
              </button>
              <span className="text-xs font-medium text-slate-400">Page {page} of {totalPages}</span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="px-4 py-2 rounded-xl text-sm font-semibold border border-slate-200 text-slate-700 hover:border-slate-400 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:border-slate-200 transition-colors"
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
