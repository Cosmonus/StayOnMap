// Floating layer-toggle panel — top-left of the map
import { TrainFront, Cpu, TrafficCone } from 'lucide-react'
import { useMapStore } from '@store/mapStore'

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

export default function MapControls() {
  const activeLayers = useMapStore((s) => s.activeLayers)
  const toggleLayer  = useMapStore((s) => s.toggleLayer)

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
    </div>
  )
}
