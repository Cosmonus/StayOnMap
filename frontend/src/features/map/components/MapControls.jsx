// Floating layer-toggle panel — bottom-right of the map
import { useMapStore } from '@store/mapStore'

const LAYERS = [
  {
    key:   'metro',
    label: 'Metro',
    icon:  (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14H9V8h2v8zm4 0h-2V8h2v8z"/>
      </svg>
    ),
  },
  {
    key:   'itCorridors',
    label: 'IT Zones',
    icon:  (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
        <path d="M20 6h-2.18c.07-.44.18-.88.18-1.36C18 2.53 15.5 1 13 1c-1.5 0-2.87.5-3.98 1.36L7.5 3.84C6.86 3.31 6.07 3 5.2 3 3.43 3 2 4.43 2 6.2v11.6C2 19.57 3.43 21 5.2 21h14.6c1.77 0 3.2-1.43 3.2-3.2V9c0-1.66-1.34-3-3-3zM11 15H9v-2h2v2zm0-4H9V9h2v2zm4 4h-2v-2h2v2zm0-4h-2V9h2v2z"/>
      </svg>
    ),
  },
  {
    key:   'traffic',
    label: 'Traffic',
    icon:  (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2c-4.42 0-8 3.58-8 8 0 5.25 8 13 8 13s8-7.75 8-13c0-4.42-3.58-8-8-8zm0 3c1.1 0 2 .9 2 2s-.9 2-2 2-2-.9-2-2 .9-2 2-2zm0 14.3c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z"/>
      </svg>
    ),
  },
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
    <div
      className="absolute z-10 hidden md:flex flex-col gap-1.5"
      style={{ bottom: '90px', right: '10px' }}
    >
      {LAYERS.map(({ key, label, icon }) => {
        const active = activeLayers[key]
        return (
          <button
            key={key}
            onClick={() => toggleLayer(key)}
            title={label}
            className={[
              'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-semibold',
              'shadow-md transition-all duration-150 whitespace-nowrap',
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
