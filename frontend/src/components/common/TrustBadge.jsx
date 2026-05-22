const BADGE_CONFIG = {
  UNRATED:            { label: 'Unrated',              bg: 'bg-slate-100',   text: 'text-slate-600',   dot: 'bg-slate-400'   },
  TRUSTED:            { label: 'Trusted',              bg: 'bg-brand-100',   text: 'text-brand-800',   dot: 'bg-brand-500'   },
  WELL_REVIEWED:      { label: 'Well Reviewed',        bg: 'bg-cyan-100',    text: 'text-cyan-800',    dot: 'bg-cyan-500'    },
  HIGHLY_TRUSTED:     { label: 'Highly Trusted',       bg: 'bg-green-100',   text: 'text-green-800',   dot: 'bg-green-500'   },
  COMMUNITY_FAVOURITE:{ label: 'Community Favourite',  bg: 'bg-emerald-100', text: 'text-emerald-800', dot: 'bg-emerald-500' },
  VERIFIED_OWNER:     { label: 'Verified Owner',       bg: 'bg-brand-50',    text: 'text-brand-700',   dot: 'bg-brand-600'   },
  UNDER_REVIEW:       { label: 'Under Review',         bg: 'bg-yellow-100',  text: 'text-yellow-800',  dot: 'bg-yellow-500'  },
  FLAGGED:            { label: 'Flagged',              bg: 'bg-red-100',     text: 'text-red-800',     dot: 'bg-red-500'     },
}

const SIZE_CLASSES = {
  sm: 'text-[11px] px-2 py-0.5',
  md: 'text-xs px-2.5 py-1',
  lg: 'text-sm px-3 py-1',
}

export default function TrustBadge({ badge, size = 'sm' }) {
  if (!badge || badge === 'UNRATED') return null
  const cfg = BADGE_CONFIG[badge]
  if (!cfg) return null
  return (
    <span className={`inline-flex items-center gap-1 rounded-full font-semibold ${cfg.bg} ${cfg.text} ${SIZE_CLASSES[size] ?? SIZE_CLASSES.sm}`}>
      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${cfg.dot}`} />
      {cfg.label}
    </span>
  )
}
