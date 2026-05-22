import { useQuery } from '@tanstack/react-query'
import { areasService } from '@services/areas.service'
import { formatCurrency } from '@utils/format'

// ── helpers ──────────────────────────────────────────────────────────────────

function floodLabel(v) {
  if (v <= 2) return { label: 'Very low', bg: 'bg-emerald-50', text: 'text-emerald-700' }
  if (v <= 4) return { label: 'Low',      bg: 'bg-emerald-50', text: 'text-emerald-700' }
  if (v <= 6) return { label: 'Medium',   bg: 'bg-amber-50',   text: 'text-amber-700'   }
  if (v <= 8) return { label: 'High',     bg: 'bg-red-50',     text: 'text-red-700'     }
  return              { label: 'Extreme', bg: 'bg-red-100',    text: 'text-red-800'     }
}

function trafficLabel(v) {
  if (v <= 3) return { label: 'Light',    bg: 'bg-emerald-50', text: 'text-emerald-700' }
  if (v <= 5) return { label: 'Moderate', bg: 'bg-slate-100',  text: 'text-slate-700'   }
  if (v <= 7) return { label: 'Busy',     bg: 'bg-amber-50',   text: 'text-amber-700'   }
  return              { label: 'Gridlock', bg: 'bg-red-50',    text: 'text-red-700'     }
}

function accessLabel(v) {
  if (v <= 2) return { label: 'None',      bg: 'bg-slate-100',  text: 'text-slate-500'   }
  if (v <= 4) return { label: 'Poor',      bg: 'bg-red-50',     text: 'text-red-700'     }
  if (v <= 6) return { label: 'Moderate',  bg: 'bg-amber-50',   text: 'text-amber-700'   }
  if (v <= 8) return { label: 'Good',      bg: 'bg-emerald-50', text: 'text-emerald-700' }
  return              { label: 'Excellent', bg: 'bg-brand-50',  text: 'text-brand-700'   }
}

function Badge({ bg, text, label }) {
  return (
    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-md ${bg} ${text}`}>
      {label}
    </span>
  )
}

const TRANSIT_ICON = {
  metro: (
    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="5" y="2" width="14" height="20" rx="2" />
      <path d="M12 6h.01M9 16l3 3 3-3M5 12h14" />
    </svg>
  ),
  rail: (
    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 15l8-8 8 8" />
      <path d="M4 19h16M7 19v-4M17 19v-4" />
    </svg>
  ),
  bus: (
    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 6v6M3 6h18l-1.5 9H4.5z" />
      <circle cx="7.5" cy="17.5" r="1.5" /><circle cx="16.5" cy="17.5" r="1.5" />
      <path d="M3 6H2M22 6h-1" />
    </svg>
  ),
}

function TransitRow({ icon, label, score }) {
  const { bg, text, label: lvl } = accessLabel(score)
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-1.5 text-slate-500">
        {TRANSIT_ICON[icon]}
        <span className="text-xs">{label}</span>
      </div>
      <Badge bg={bg} text={text} label={lvl} />
    </div>
  )
}

function MetricRow({ label, children }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-slate-500">{label}</span>
      {children}
    </div>
  )
}

// ── main component ────────────────────────────────────────────────────────────

export default function PropertyAreaInsight({ city, landmark }) {
  const { data: area, isLoading } = useQuery({
    queryKey: ['area-match', city, landmark],
    queryFn:  () => areasService.match(city, landmark).then((r) => r.data),
    enabled:  !!city,
    staleTime: Infinity,
  })

  if (isLoading) {
    return (
      <div className="bg-white rounded-2xl border border-slate-100 p-5 space-y-2.5 animate-pulse">
        <div className="h-4 w-32 bg-slate-100 rounded" />
        <div className="h-3 w-24 bg-slate-100 rounded" />
        <div className="space-y-2 pt-2">
          {[1,2,3,4].map(i => <div key={i} className="h-3 bg-slate-100 rounded" />)}
        </div>
      </div>
    )
  }

  if (!area) return null

  const flood   = floodLabel(area.floodRisk)
  const traffic = trafficLabel(area.trafficScore)

  return (
    <div className="bg-white rounded-2xl border border-slate-100 p-5">

      {/* Header */}
      <div className="flex items-baseline justify-between gap-2 mb-3">
        <div>
          <h3 className="text-sm font-bold text-slate-800 leading-tight">{area.name}</h3>
          {area.fullName !== area.name && (
            <p className="text-[10px] text-slate-400">{area.fullName}</p>
          )}
        </div>
        {area.avgRent && (
          <p className="text-xs font-semibold text-brand-600 shrink-0">
            ~{formatCurrency(area.avgRent)}
            <span className="font-normal text-slate-400">/mo</span>
          </p>
        )}
      </div>

      {/* Summary */}
      {area.summary && (
        <p className="text-[11px] text-slate-500 leading-relaxed mb-3">{area.summary}</p>
      )}

      {/* Transit section */}
      <div className="space-y-2 mb-3 pb-3 border-b border-slate-100">
        <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Transit</p>
        <TransitRow icon="metro" label="Metro"   score={area.metroScore} />
        <TransitRow icon="rail"  label="Railway" score={area.railScore ?? 3} />
        <TransitRow icon="bus"   label="Bus"     score={area.busScore ?? 5} />
      </div>

      {/* Other metrics */}
      <div className="space-y-2 mb-3 pb-3 border-b border-slate-100">
        <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Area signals</p>
        <MetricRow label="Flood risk">
          <Badge bg={flood.bg} text={flood.text} label={flood.label} />
        </MetricRow>
        <MetricRow label="Traffic">
          <Badge bg={traffic.bg} text={traffic.text} label={traffic.label} />
        </MetricRow>
        <MetricRow label="IT proximity">
          {(() => { const a = accessLabel(area.itScore); return <Badge bg={a.bg} text={a.text} label={a.label} /> })()}
        </MetricRow>
        <MetricRow label="Water supply">
          {(() => { const a = accessLabel(area.waterScore); return <Badge bg={a.bg} text={a.text} label={a.label} /> })()}
        </MetricRow>
      </div>

      {/* Best for */}
      {area.bestFor?.length > 0 && (
        <div>
          <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1.5">Best for</p>
          <div className="flex flex-wrap gap-1">
            {area.bestFor.map((b) => (
              <span key={b} className="text-[10px] font-medium bg-brand-50 text-brand-700 rounded-full px-2 py-0.5">
                {b}
              </span>
            ))}
          </div>
        </div>
      )}

    </div>
  )
}
