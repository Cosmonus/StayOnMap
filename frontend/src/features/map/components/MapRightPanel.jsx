import { useQuery } from '@tanstack/react-query'
import { useMapStore } from '@store/mapStore'
import PropertyPopup from './PropertyPopup'
import PropertyCard from '@features/properties/components/PropertyCard'
import { propertyService } from '@services/property.service'

/* ─── Mobile property card (fetches + renders PropertyCard) ── */
function MobilePropertyCard({ propertyId }) {
  const { data: property, isLoading } = useQuery({
    queryKey: ['property-popup', propertyId],
    queryFn:  () => propertyService.getById(propertyId).then((r) => r.data),
    enabled:  !!propertyId,
    staleTime: 60_000,
  })

  if (isLoading) return (
    <div className="p-4 flex flex-col gap-3">
      <div className="animate-pulse rounded-2xl bg-slate-100 aspect-[4/3]" />
      <div className="h-5 bg-slate-100 rounded-lg animate-pulse w-3/4" />
      <div className="h-4 bg-slate-100 rounded-lg animate-pulse w-1/2" />
    </div>
  )

  if (!property) return null

  return (
    <div className="p-4 pb-6">
      <PropertyCard property={property} />
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════
   MAIN COMPONENT — selected-property preview only. Search and
   filters live in the Header's map bar (MapFilterBar +
   FilterButton) on every screen size; nothing floats over the map.
   ═══════════════════════════════════════════════════════════ */
export default function MapRightPanel({ topClass = 'top-32', contained = false }) {
  const selectedPinId  = useMapStore((s) => s.selectedPinId)
  const clearSelection = useMapStore((s) => s.clearSelection)

  return (
    <>
      {/* ══ DESKTOP: selected-property popup (Metro/IT/Traffic toggles now live in MapControls' pills) ══ */}
      <div
        className={`hidden md:flex flex-col ${contained ? 'absolute' : 'fixed'} right-5 ${topClass} z-20 w-80 gap-3 overflow-y-auto`}
        style={{ maxHeight: 'calc(100vh - 6rem)', scrollbarWidth: 'none' }}
      >
        {selectedPinId && <PropertyPopup />}
      </div>

      {/* ══ MOBILE: property bottom sheet ════════════════════ */}
      {selectedPinId && (
        <div className="md:hidden fixed inset-0 z-30">
          {/* Tap-outside to close */}
          <div className="absolute inset-0 bg-black/20" onClick={clearSelection} />

          {/* Sheet */}
          <div
            className="absolute bottom-0 inset-x-0 bg-white rounded-t-3xl overflow-y-auto"
            style={{ maxHeight: '62vh', scrollbarWidth: 'none', boxShadow: '0 -8px 40px rgba(0,0,0,0.15)' }}
          >
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 bg-slate-200 rounded-full" />
            </div>
            <MobilePropertyCard propertyId={selectedPinId} />
          </div>
        </div>
      )}
    </>
  )
}
