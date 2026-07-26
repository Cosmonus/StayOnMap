import { useMapStore } from '@store/mapStore'

const ENTRIES = {
  metro: [
    { swatch: 'line', color: '#7c3aed', label: 'Line 1' },
    { swatch: 'line', color: '#059669', label: 'Line 2' },
    { swatch: 'dot',  color: '#ffffff', border: '#7c3aed', label: 'Station' },
  ],
  itCorridors: [
    { swatch: 'circle', color: '#2563eb', label: 'Major IT zone' },
    { swatch: 'circle', color: '#60a5fa', label: 'IT zone' },
  ],
  floodZones: [
    { swatch: 'area', color: '#ef4444', label: 'High flood risk' },
    { swatch: 'area', color: '#f59e0b', label: 'Medium flood risk' },
  ],
  traffic: [
    { swatch: 'line', color: '#22c55e', label: 'Light'    },
    { swatch: 'line', color: '#f59e0b', label: 'Moderate' },
    { swatch: 'line', color: '#ef4444', label: 'Heavy'    },
  ],
}

function Swatch({ swatch, color, border }) {
  if (swatch === 'line') {
    return (
      <span
        className="shrink-0 rounded-full"
        style={{ width: 20, height: 3, background: color, display: 'inline-block' }}
      />
    )
  }
  if (swatch === 'dot') {
    return (
      <span
        className="shrink-0 rounded-full"
        style={{
          width: 8, height: 8, display: 'inline-block',
          background: color,
          border: `2px solid ${border ?? color}`,
        }}
      />
    )
  }
  if (swatch === 'circle') {
    return (
      <span
        className="shrink-0 rounded-full"
        style={{
          width: 12, height: 12, display: 'inline-block',
          background: color,
          opacity: 0.6,
          border: `1.5px solid ${color}`,
        }}
      />
    )
  }
  // area
  return (
    <span
      className="shrink-0 rounded"
      style={{
        width: 14, height: 10, display: 'inline-block',
        background: color,
        opacity: 0.6,
        border: `1.5px solid ${color}`,
      }}
    />
  )
}

export default function MapLegend() {
  const activeLayers = useMapStore((s) => s.activeLayers)

  const active = Object.entries(activeLayers)
    .filter(([, on]) => on)
    .map(([key]) => key)

  if (active.length === 0) return null

  return (
    <div
      /* Sits ABOVE MapViewportBar, which now owns the bottom strip — at
         bottom-3 the two overlapped and the legend was unreadable. Taller
         offset on mobile because the viewport bar stacks into two rows there. */
      className="absolute bottom-32 md:bottom-20 left-1/2 -translate-x-1/2 z-10 bg-white/95 backdrop-blur-sm border border-slate-200 rounded-2xl shadow-sm px-4 py-2.5 flex flex-wrap items-center gap-x-5 gap-y-2 max-w-[90vw]"
      style={{ transition: 'opacity 0.2s' }}
    >
      {active.map((key) =>
        ENTRIES[key]?.map((entry) => (
          <div key={`${key}-${entry.label}`} className="flex items-center gap-1.5 shrink-0">
            <Swatch swatch={entry.swatch} color={entry.color} border={entry.border} />
            <span className="text-[11px] font-medium text-slate-600 whitespace-nowrap">
              {entry.label}
            </span>
          </div>
        ))
      )}
    </div>
  )
}
