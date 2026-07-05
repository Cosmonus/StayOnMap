import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import MapPropertyCard from '@features/map/components/MapPropertyCard'
import { propertyService } from '@services/property.service'
import { useFilterStore } from '@store/filterStore'
import { useMapStore } from '@store/mapStore'

function CardSkeleton() {
  return (
    <div className="rounded-2xl overflow-hidden ring-1 ring-slate-100 animate-pulse">
      <div className="h-44 bg-slate-100" />
      <div className="px-4 py-3 space-y-2">
        <div className="h-4 w-1/3 bg-slate-100 rounded" />
        <div className="h-3 w-3/4 bg-slate-100 rounded" />
        <div className="h-3 w-2/3 bg-slate-100 rounded" />
      </div>
    </div>
  )
}

// Airbnb-style rail beside the map: a single scrolling column of on-brand
// property cards. Stays in sync with the map's current viewport (bounds come
// from useMapBounds inside MapView) and the active filters.
export default function MapPropertiesList() {
  const bounds = useMapStore((s) => s.bounds)
  const filters = useFilterStore((s) => s.filters)

  const params = useMemo(() => {
    if (!bounds) return null
    return {
      limit: 3,
      swLat: bounds.swLat,
      swLng: bounds.swLng,
      neLat: bounds.neLat,
      neLng: bounds.neLng,
      city: filters.city || undefined,
      furnished: filters.furnished || undefined,
      bhk: filters.bhk?.length ? filters.bhk.join(',') : undefined,
    }
  }, [bounds, filters.city, filters.furnished, filters.bhk])

  const { data, isLoading, isError } = useQuery({
    queryKey: ['properties-in-view', params],
    queryFn: () => propertyService.getList(params).then((r) => r.data),
    enabled: !!params,
  })

  const properties = data ?? []
  const cityLabel = filters.city || properties[0]?.city || 'This area'
  const viewAllLink = filters.city ? `/properties?city=${encodeURIComponent(filters.city)}` : '/properties'

  return (
    <div className="bg-white p-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <p className="text-base font-bold text-slate-900 truncate">Homes in this area</p>
          {properties.length > 0 && (
            <span className="shrink-0 min-w-[20px] h-5 px-1.5 flex items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-500">
              {properties.length}
            </span>
          )}
        </div>
        <Link to={viewAllLink} className="text-xs font-semibold text-brand-600 hover:text-brand-700 no-underline shrink-0">
          View all ›
        </Link>
      </div>
      <p className="text-xs text-slate-400 mt-0.5 mb-4 truncate">{cityLabel} · sorted by best match</p>

      {isError ? (
        <p className="text-sm text-slate-400 py-10 text-center">Couldn&apos;t load properties.</p>
      ) : !bounds || isLoading ? (
        <div className="flex flex-col gap-4">
          {Array.from({ length: 3 }).map((_, i) => <CardSkeleton key={i} />)}
        </div>
      ) : properties.length === 0 ? (
        <p className="text-sm text-slate-400 py-10 text-center">No properties in this area.</p>
      ) : (
        <div className="flex flex-col gap-4">
          {properties.map((property, i) => (
            <MapPropertyCard key={property.id} property={property} index={i} />
          ))}
        </div>
      )}
    </div>
  )
}
