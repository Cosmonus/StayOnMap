// Floating layer-toggle panel — top-left of the map
import { TrainFront, Cpu, TrafficCone, LocateFixed } from 'lucide-react'
import { useMapStore } from '@store/mapStore'
import { confirm } from '@components/common/ConfirmDialog'

const LAYERS = [
  { key: 'metro',       label: 'Metro',    icon: <TrainFront size={14} /> },
  { key: 'itCorridors', label: 'IT zones', icon: <Cpu size={14} /> },
  { key: 'traffic',     label: 'Traffic',  icon: <TrafficCone size={14} /> },
]

// One active colour for all three. The per-layer violet/blue/amber fills used
// to double as a key to what was drawn on the map — MapLegend already does
// that job with real swatches, and three differently-coloured pills in one row
// read as three unrelated controls rather than one set of toggles.
const ACTIVE_PILL = 'bg-brand-600 text-white border-brand-600 hover:bg-brand-700'
const IDLE_PILL   = 'bg-white/95 text-slate-700 border-slate-200 hover:border-slate-400'

const LOCATE_ZOOM = 15

export default function MapControls() {
  const activeLayers    = useMapStore((s) => s.activeLayers)
  const toggleLayer     = useMapStore((s) => s.toggleLayer)
  const locationConsent = useMapStore((s) => s.locationConsent)

  // The browser's own permission prompt only ever fires AFTER the user
  // accepts our explainer. "Not now" isn't persisted — the next tap asks
  // again; an accepted consent is remembered so we never re-ask.
  async function handleLocate() {
    if (!navigator.geolocation) return
    if (!locationConsent) {
      const yes = await confirm({
        title: 'Turn on location?',
        message: 'We use your location to show homes near you. Your location is never stored.',
        confirmLabel: 'Allow',
        cancelLabel: 'Not now',
        variant: 'info',
      })
      if (!yes) return
      useMapStore.getState().grantLocationConsent()
    }
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => useMapStore.getState().flyTo?.({ center: [coords.longitude, coords.latitude], zoom: LOCATE_ZOOM }),
      () => {}, // OS-level denial / unavailable — the map simply stays put
    )
  }

  return (
    // A row, not a column: stacked vertically these four ate the left edge of
    // the map and read as a nav rail. Wraps rather than overflowing on narrow
    // screens, and min-h-[40px] keeps them on the button target size the
    // design standard sets rather than the mock's tighter chip.
    <div className="absolute left-4 top-4 z-10 flex max-w-[calc(100%-2rem)] flex-wrap items-center gap-2">
      {LAYERS.map(({ key, label, icon }) => {
        const active = activeLayers[key]
        return (
          <button
            key={key}
            onClick={() => toggleLayer(key)}
            aria-pressed={active}
            className={[
              'flex min-h-[40px] items-center gap-1.5 whitespace-nowrap rounded-full border px-3.5',
              'text-sm font-semibold shadow-sm backdrop-blur transition-colors duration-150',
              'focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500',
              active ? ACTIVE_PILL : IDLE_PILL,
            ].join(' ')}
          >
            {icon}
            <span>{label}</span>
          </button>
        )
      })}
      <button
        onClick={handleLocate}
        aria-label="Centre the map on my location"
        className={`flex min-h-[40px] items-center gap-1.5 whitespace-nowrap rounded-full border px-3.5 text-sm font-semibold shadow-sm backdrop-blur transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${IDLE_PILL}`}
      >
        <LocateFixed size={14} />
        <span>Near me</span>
      </button>
    </div>
  )
}
