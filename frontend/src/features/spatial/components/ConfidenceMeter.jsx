// How sure the system is, and why.
//
// The band is the headline and the percentage is the detail, deliberately.
// A bare "61%" implies a precision the method doesn't have — the number is
// just the weighted share of expected inputs that happened to be available
// (backend/src/features/spatial/envelope.js's computeConfidence), so the
// basis line is the honest part and gets equal billing.

const BANDS = {
  HIGH:     { label: 'High confidence',     bar: 'bg-brand-600',  text: 'text-brand-700'  },
  MODERATE: { label: 'Moderate confidence', bar: 'bg-brand-400',  text: 'text-slate-600'  },
  LOW:      { label: 'Low confidence',      bar: 'bg-amber-400',  text: 'text-amber-700'  },
  MINIMAL:  { label: 'Very limited data',   bar: 'bg-slate-300',  text: 'text-slate-500'  },
}

export default function ConfidenceMeter({ confidence }) {
  const cfg = BANDS[confidence?.band]
  if (!cfg) return null

  return (
    <div className="mt-3 pt-3 border-t border-slate-100">
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <span className={`text-[11px] font-semibold ${cfg.text}`}>{cfg.label}</span>
        <span className="text-[10px] text-slate-400 tabular-nums">
          {Math.round(confidence.value * 100)}%
        </span>
      </div>

      <div
        className="h-1 w-full bg-slate-100 rounded-full overflow-hidden"
        role="meter"
        aria-valuenow={Math.round(confidence.value * 100)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${cfg.label} — ${confidence.basis}`}
      >
        <div className={`h-full rounded-full ${cfg.bar}`} style={{ width: `${confidence.value * 100}%` }} />
      </div>

      <p className="text-[10px] text-slate-400 mt-1.5">{confidence.basis}</p>
    </div>
  )
}
