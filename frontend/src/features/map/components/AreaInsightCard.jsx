import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useMapStore } from '@store/mapStore'
import { areasService } from '@services/areas.service'
import { formatCurrency } from '@utils/format'

function scoreLabel(value, type) {
  if (type === 'flood') {
    if (value <= 2) return { label: 'Very low',  color: 'text-emerald-600' }
    if (value <= 4) return { label: 'Low',        color: 'text-emerald-600' }
    if (value <= 6) return { label: 'Medium',     color: 'text-amber-600'  }
    if (value <= 8) return { label: 'High',       color: 'text-red-600'    }
    return               { label: 'Extreme',    color: 'text-red-700'    }
  }
  if (type === 'traffic') {
    if (value <= 3) return { label: 'Light',      color: 'text-emerald-600' }
    if (value <= 5) return { label: 'Moderate',   color: 'text-slate-600'  }
    if (value <= 7) return { label: 'Busy',       color: 'text-amber-600'  }
    return               { label: 'Gridlock',   color: 'text-red-600'    }
  }
  if (value >= 9) return { label: 'Excellent', color: 'text-emerald-600' }
  if (value >= 7) return { label: 'Good',      color: 'text-emerald-600' }
  if (value >= 5) return { label: 'Moderate',  color: 'text-slate-600'  }
  if (value >= 3) return { label: 'Limited',   color: 'text-amber-600'  }
  return               { label: 'Poor',       color: 'text-red-600'    }
}

function Dots({ value, max = 10, danger = false }) {
  const filled = Math.round((value / max) * 5)
  return (
    <span className="flex gap-0.5">
      {Array.from({ length: 5 }, (_, i) => (
        <span
          key={i}
          className={`w-1.5 h-1.5 rounded-full ${
            i < filled
              ? danger && filled >= 4 ? 'bg-red-500' : filled >= 4 ? 'bg-emerald-500' : 'bg-slate-500'
              : 'bg-slate-200'
          }`}
        />
      ))}
    </span>
  )
}

function MetricRow({ label, value, max = 10, type }) {
  const { label: lvl, color } = scoreLabel(value, type)
  return (
    <div className="flex items-center gap-2 py-1">
      <span className="text-xs text-slate-500 w-24 shrink-0">{label}</span>
      <Dots value={value} max={max} danger={type === 'flood' || type === 'traffic'} />
      <span className={`text-xs font-semibold ml-auto ${color}`}>{lvl}</span>
    </div>
  )
}

export default function AreaInsightCard() {
  const selectedArea   = useMapStore((s) => s.selectedArea)
  const setSelectedArea = useMapStore((s) => s.setSelectedArea)

  const { data: area, isLoading } = useQuery({
    queryKey: ['area', selectedArea?.slug],
    queryFn:  () => areasService.get(selectedArea.slug).then((r) => r.data),
    enabled:  !!selectedArea?.slug,
    staleTime: Infinity,
  })

  // Close on Escape
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') setSelectedArea(null) }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [setSelectedArea])

  if (!selectedArea) return null

  return (
    <div className="absolute top-20 right-4 z-20 w-72 bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">

      {/* Header */}
      <div className="px-4 pt-4 pb-3 border-b border-slate-100">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-lg font-bold text-slate-900 leading-tight truncate">
              {isLoading ? <span className="block h-5 w-28 bg-slate-100 animate-pulse rounded" /> : area?.name}
            </p>
            {area?.fullName && area.fullName !== area.name && (
              <p className="text-xs text-slate-400 truncate">{area.fullName}</p>
            )}
          </div>
          <button
            onClick={() => setSelectedArea(null)}
            className="shrink-0 text-slate-400 hover:text-slate-600 mt-0.5"
            aria-label="Close"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {area?.avgRent && (
          <p className="text-sm font-semibold text-brand-700 mt-1">
            ~{formatCurrency(area.avgRent)}<span className="font-normal text-slate-400 text-xs">/mo avg rent</span>
          </p>
        )}
      </div>

      {/* Scores */}
      {area && (
        <div className="px-4 py-3 border-b border-slate-100 divide-y divide-slate-50">
          <MetricRow label="Flood risk"    value={area.floodRisk}   type="flood"   />
          <MetricRow label="Traffic"       value={area.trafficScore} type="traffic" />
          <MetricRow label="Metro access"  value={area.metroScore}  type="metro"   />
          <MetricRow label="IT proximity"  value={area.itScore}     type="it"      />
          <MetricRow label="Water supply"  value={area.waterScore}  type="water"   />
          <MetricRow label="Safety"        value={area.safetyScore} type="safety"  />
        </div>
      )}

      {/* Summary */}
      {area && (
        <div className="px-4 py-3">
          {area.summary && (
            <p className="text-xs text-slate-500 leading-relaxed mb-2">{area.summary}</p>
          )}
          {area.bestFor?.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {area.bestFor.map((b) => (
                <span key={b} className="text-[10px] font-medium bg-brand-50 text-brand-700 rounded-full px-2 py-0.5">
                  {b}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

    </div>
  )
}
