import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Home } from 'lucide-react'
import { propertyService } from '@services/property.service'
import { resolvePlace } from '@lib/googleMaps'
import { useFilterStore } from '@store/filterStore'
import { useFilterUrlSync } from '@features/filters/hooks/useFilterUrlSync'
import { toQueryParams } from '@/config/filters'
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
      <Home size={24} stroke="#cbd5e1" strokeWidth={1.8} />
      <p className="text-xs text-slate-400 leading-snug">More rentals<br />coming soon</p>
    </div>
  )
}

export default function PropertiesPage() {
  // Two-way URL sync. The hook's own comment says "mount once on map pages" and
  // this page is a grid, so it was never wired up — meaning NO filter here
  // survived a reload or could be shared as a link. Verified in a browser:
  // /properties?bhk=2 returned all 22 listings, and bhk long predates today.
  //
  // A filtered grid is exactly the thing people paste into a WhatsApp message.
  useFilterUrlSync()

  const filters = useFilterStore((s) => s.filters)

  // The header search sets `area` — on the map that flies the viewport, but a
  // grid has no viewport, so searching a place here used to do NOTHING (the
  // operator-reported "typed chennai, Chennai listings didn't show" bug).
  // Resolve the place and constrain the grid with its own extent: a city
  // query carries its whole municipal viewport, a neighbourhood its few km.
  const area = filters.area || null
  const { data: place, isFetched: placeResolved } = useQuery({
    queryKey: ['resolve-area', area, filters.city],
    queryFn: () => resolvePlace(area, filters.city),
    enabled: !!area,
    staleTime: Infinity,
    retry: 1,
  })

  const bounds = useMemo(() => {
    if (!area || !place) return null
    if (place.viewport) return place.viewport
    // No viewport on the geometry (rare) — a ~2km box around the point beats
    // silently ignoring the search.
    const d = 0.02
    return { swLat: place.lat - d, swLng: place.lng - d, neLat: place.lat + d, neLng: place.lng + d }
  }, [area, place])

  // Every active filter (modal included) shapes the grid — same schema-driven
  // params the map's pin fetch uses, plus the searched place's bounds.
  const params = useMemo(
    () => ({ limit: 50, ...toQueryParams(filters), ...(bounds ?? {}) }),
    [filters, bounds]
  )

  const { data, isPending, isError } = useQuery({
    queryKey: ['properties', params],
    // The whole envelope, not just `.data` — `meta.proximity` says how many
    // listings a distance filter had to set aside for lack of map data, and
    // dropping it here would silently hide them.
    queryFn: () => propertyService.getList(params),
    // Hold the fetch until the searched place resolves — fetching unbounded
    // first would flash every listing before snapping to the searched area.
    // A failed/unresolvable geocode falls through to an unbounded fetch.
    enabled: !area || placeResolved,
  })
  // isPending (not isLoading) so the geocode wait renders skeletons too —
  // a disabled query is pending but not "loading" in React Query v5 terms.
  const isLoading = isPending

  const properties = data?.data ?? []
  // Present only when a proximity filter is active AND some listings could not
  // be judged either way.
  const unjudged = data?.meta?.proximity?.unknown ?? 0
  const proximityLabel = data?.meta?.proximity?.label
  const locationLabel = (area && (place?.name ?? area)) || filters.city || null

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

      <main className="min-h-screen bg-white pt-[132px] md:pt-40 pb-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-0 lg:w-[80%]">
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

            {/*
              The listings this filter could not judge either way.

              Without this line, a home excluded because we have no map data for
              its area looks identical to one we measured and rejected — and the
              owner whose listing vanished is never told why. A filtered list is
              the one surface with nowhere to put a provenance chip, so the count
              has to be said out loud.
            */}
            {unjudged > 0 && (
              <p className="text-sm text-amber-700 mt-2">
                {unjudged} home{unjudged !== 1 ? 's are' : ' is'} not shown — we don’t have
                map data for {unjudged !== 1 ? 'their areas' : 'its area'} yet, so we can’t tell
                whether {unjudged !== 1 ? 'they’re' : 'it’s'} within {proximityLabel}.
              </p>
            )}
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
