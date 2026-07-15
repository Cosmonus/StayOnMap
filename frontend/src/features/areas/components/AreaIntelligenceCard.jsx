import { useQuery } from '@tanstack/react-query'
import { placesService } from '@services/places.service'

// Live, API-computed neighborhood intelligence for this exact lat/lng —
// unlike PropertyAreaInsight (hand-authored estimates for ~16 named
// neighborhoods, Chennai/Bengaluru only), this works for ANY coordinate by
// querying Google directly. See backend/src/features/places/areaIntelligence.service.js.

// Higher score = better access (metro/rail/bus/IT corridor proximity)
function accessLabel(score) {
  if (score == null) return null
  if (score <= 2) return { label: 'Bad',       bg: 'bg-red-50',     text: 'text-red-700'     }
  if (score <= 5) return { label: 'Moderate',  bg: 'bg-amber-50',   text: 'text-amber-700'   }
  if (score <= 8) return { label: 'Good',      bg: 'bg-emerald-50', text: 'text-emerald-700' }
  return              { label: 'Very good', bg: 'bg-brand-50',  text: 'text-brand-700'   }
}

// Inverted: a high traffic score means heavier congestion, so it maps to the
// worse label — unlike accessLabel, where a high score is a good thing.
function trafficLabel(score) {
  if (score == null) return null
  if (score <= 2) return { label: 'Very good', bg: 'bg-brand-50',  text: 'text-brand-700'   }
  if (score <= 5) return { label: 'Good',      bg: 'bg-emerald-50', text: 'text-emerald-700' }
  if (score <= 8) return { label: 'Moderate',  bg: 'bg-amber-50',   text: 'text-amber-700'   }
  return              { label: 'Bad',       bg: 'bg-red-50',     text: 'text-red-700'     }
}

function formatDistance(m) {
  return m < 1000 ? `${m}m` : `${(m / 1000).toFixed(1)}km`
}

function Badge({ bg, text, label }) {
  return <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-md ${bg} ${text}`}>{label}</span>
}

function ScoreRow({ label, score, nearest, labelFn = accessLabel }) {
  const cfg = labelFn(score)
  if (!cfg) return null
  return (
    <div className="flex items-center justify-between gap-2 py-2 border-b border-slate-50 last:border-0">
      <div className="min-w-0">
        <p className="text-xs text-slate-600">{label}</p>
        {nearest && (
          <p className="text-[10px] text-slate-400 truncate mt-0.5">{nearest.name} · {formatDistance(nearest.distanceM)}</p>
        )}
      </div>
      <Badge bg={cfg.bg} text={cfg.text} label={cfg.label} />
    </div>
  )
}

const ESSENTIAL_LABELS = {
  hospital: 'Nearest hospital', police: 'Nearest police station', pharmacy: 'Nearest pharmacy',
  school: 'Nearest school', supermarket: 'Nearest supermarket', atm: 'Nearest ATM',
}

function EssentialRow({ label, nearest }) {
  if (!nearest) return null
  return (
    <div className="flex items-center justify-between gap-2 py-2 border-b border-slate-50 last:border-0">
      <span className="text-xs text-slate-600">{label}</span>
      <span className="text-[10px] font-semibold text-slate-500 truncate max-w-[55%]" title={nearest.name}>
        {formatDistance(nearest.distanceM)}
      </span>
    </div>
  )
}

export default function AreaIntelligenceCard({ lat, lng }) {
  const { data, isLoading } = useQuery({
    queryKey: ['area-intelligence', lat, lng],
    queryFn: () => placesService.getAreaIntelligence(lat, lng).then((r) => r.data),
    enabled: lat != null && lng != null,
    staleTime: 10 * 60 * 1000,
  })

  if (lat == null || lng == null) return null

  if (isLoading) {
    return (
      <div className="bg-white rounded-2xl border border-slate-100 p-5 space-y-2 animate-pulse">
        <div className="h-4 w-40 bg-slate-100 rounded" />
        <div className="h-3 w-52 bg-slate-100 rounded" />
        <div className="space-y-2 pt-2">
          {[1, 2, 3, 4].map((i) => <div key={i} className="h-4 bg-slate-100 rounded" />)}
        </div>
      </div>
    )
  }

  // Errored or empty response — the section is optional intelligence, so
  // render nothing rather than a permanent skeleton or an error banner.
  if (!data) return null

  const { transit, essentials, itCorridor, traffic } = data
  const nearbyEssentials = Object.entries(essentials ?? {}).filter(([, v]) => v.nearest)

  return (
    <div className="bg-white rounded-2xl border border-slate-100 p-5">
      <h3 className="text-sm font-bold text-slate-800">Neighborhood intelligence</h3>
      <p className="text-[11px] text-slate-400 mt-0.5 mb-3">Live, computed from this property&apos;s exact location</p>

      <div>
        <ScoreRow label="Metro access" score={transit.metroScore} nearest={transit.nearestMetro} />
        <ScoreRow label="Rail access"  score={transit.railScore}  nearest={transit.nearestRail} />
        <ScoreRow label="Bus access"   score={transit.busScore}   nearest={transit.nearestBus} />
        <ScoreRow label="IT corridor"  score={itCorridor.itScore} nearest={itCorridor.nearestItPark} />
        {/* Omitted entirely (not shown as "unavailable") when Distance Matrix
            API isn't enabled on the backend key — a row that only ever says
            "unavailable" is chrome, not information. */}
        {traffic && <ScoreRow label="Traffic" score={traffic.score} labelFn={trafficLabel} />}
      </div>

      {nearbyEssentials.length > 0 && (
        <div className="mt-3 pt-3 border-t border-slate-100">
          {nearbyEssentials.map(([type, v]) => (
            <EssentialRow key={type} label={ESSENTIAL_LABELS[type] ?? type} nearest={v.nearest} />
          ))}
        </div>
      )}
    </div>
  )
}
