import { useMapStore } from '@store/mapStore'

const LAYERS = [
  {
    key:   'metro',
    label: 'Metro lines',
    sub:   'Stations & routes',
    color: '#7c3aed',
  },
  {
    key:   'itCorridors',
    label: 'IT corridors',
    sub:   'Tech parks & hubs',
    color: '#3b82f6',
  },
  {
    key:   'traffic',
    label: 'Live traffic',
    sub:   'Real-time congestion',
    color: '#22c55e',
  },
]

function LayerIcon({ layerKey, color }) {
  const props = { width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none', stroke: color, strokeWidth: '1.8', strokeLinecap: 'round', strokeLinejoin: 'round' }
  if (layerKey === 'metro') return (
    <svg {...props}>
      <rect x="5" y="5" width="14" height="13" rx="2"/>
      <path d="M5 10h14"/>
      <circle cx="8.5" cy="14.5" r="1" fill={color} stroke="none"/>
      <circle cx="15.5" cy="14.5" r="1" fill={color} stroke="none"/>
      <path d="M8 18l-1.5 2M16 18l1.5 2"/>
    </svg>
  )
  if (layerKey === 'itCorridors') return (
    <svg {...props}>
      <path d="M3 21h18M3 8l9-5 9 5M4 8v13M20 8v13M9 21v-6h6v6"/>
    </svg>
  )
  if (layerKey === 'floodZones') return (
    <svg {...props}>
      <path d="M12 2v8"/>
      <path d="M8 6l4-4 4 4"/>
      <path d="M3 14c1.5-2 3-2 4.5 0s3 2 4.5 0 3-2 4.5 0 3 2 4.5 0"/>
      <path d="M3 18c1.5-2 3-2 4.5 0s3 2 4.5 0 3-2 4.5 0 3 2 4.5 0"/>
    </svg>
  )
  if (layerKey === 'traffic') return (
    <svg {...props}>
      <rect x="8" y="2" width="8" height="20" rx="2"/>
      <circle cx="12" cy="7"  r="1.8" fill={color} stroke="none"/>
      <circle cx="12" cy="12" r="1.8" fill={color} stroke="none"/>
      <circle cx="12" cy="17" r="1.8" fill={color} stroke="none"/>
    </svg>
  )
  return null
}

export default function MapLayerPanel() {
  const activeLayers = useMapStore((s) => s.activeLayers)
  const toggleLayer  = useMapStore((s) => s.toggleLayer)

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
      <div className="px-4 pt-3.5 pb-2 border-b border-slate-100">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest">Map layers</p>
      </div>
      <div className="divide-y divide-slate-50">
        {LAYERS.map((layer) => {
          const on = activeLayers[layer.key]
          return (
            <button
              key={layer.key}
              onClick={() => toggleLayer(layer.key)}
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors text-left"
            >
              <div className="flex items-center justify-center w-9 h-9 rounded-xl shrink-0"
                style={{ background: on ? `${layer.color}15` : '#f1f5f9' }}>
                <LayerIcon layerKey={layer.key} color={on ? layer.color : '#94a3b8'} />
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-medium leading-tight ${on ? 'text-slate-800' : 'text-slate-500'}`}>
                  {layer.label}
                </p>
                <p className="text-[11px] text-slate-400 leading-tight mt-0.5">{layer.sub}</p>
              </div>
              {/* Toggle pill */}
              <div
                className="shrink-0 w-8 h-4 rounded-full transition-colors duration-200 relative"
                style={{ background: on ? layer.color : '#e2e8f0' }}
              >
                <span
                  className="absolute top-0.5 w-3 h-3 bg-white rounded-full shadow-sm transition-transform duration-200"
                  style={{ transform: on ? 'translateX(17px)' : 'translateX(2px)' }}
                />
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
