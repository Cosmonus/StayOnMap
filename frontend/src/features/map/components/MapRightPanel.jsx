import { useMapStore } from '@store/mapStore'
import PropertyPopup from './PropertyPopup'

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

          {/* Sheet — same enriched content as the desktop popup (photo,
              trust badge, nearby highlights, pricing, directions, phone) */}
          <div
            className="absolute bottom-0 inset-x-0 bg-white rounded-t-3xl overflow-y-auto shadow-sheet"
            style={{ maxHeight: '78vh', scrollbarWidth: 'none' }}
          >
            <div className="flex justify-center pt-3 pb-2">
              <div className="w-10 h-1 bg-slate-200 rounded-full" />
            </div>
            <PropertyPopup bare />
          </div>
        </div>
      )}
    </>
  )
}
