// Floating layer-toggle panel — top-left of the map
import { TrainFront, Cpu, TrafficCone, LocateFixed } from 'lucide-react'
import { useMapStore } from '@store/mapStore'
import { confirm } from '@components/common/ConfirmDialog'

const LAYERS = [
  { key: 'metro',       label: 'Metro',    icon: <TrainFront size={14} /> },
  { key: 'itCorridors', label: 'IT Zones', icon: <Cpu size={14} /> },
  { key: 'traffic',     label: 'Traffic',  icon: <TrafficCone size={14} /> },
]

const ACTIVE_COLORS = {
  metro:       'bg-violet-600 text-white border-violet-600',
  itCorridors: 'bg-blue-600 text-white border-blue-600',
  traffic:     'bg-amber-500 text-white border-amber-500',
}

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
    <div className="absolute z-10 flex flex-col gap-1.5 top-4 left-4">
      {LAYERS.map(({ key, label, icon }) => {
        const active = activeLayers[key]
        return (
          <button
            key={key}
            onClick={() => toggleLayer(key)}
            title={label}
            className={[
              'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-semibold',
              'shadow-sm transition-all duration-150 whitespace-nowrap',
              active
                ? ACTIVE_COLORS[key]
                : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400',
            ].join(' ')}
          >
            {icon}
            <span>{label}</span>
          </button>
        )
      })}
      <button
        onClick={handleLocate}
        title="My location"
        aria-label="Go to my location"
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-semibold shadow-sm transition-all duration-150 whitespace-nowrap bg-white text-slate-600 border-slate-200 hover:border-slate-400"
      >
        <LocateFixed size={14} />
        <span>Locate</span>
      </button>
    </div>
  )
}
