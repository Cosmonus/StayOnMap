// Matches the TrustBadge enum in backend/prisma/schema.prisma exactly —
// keep in sync with backend/src/features/trust/trust.service.js badge logic.
const BADGE_CONFIG = {
  VERIFIED_OWNER:        { label: 'Verified Owner',        bg: 'bg-brand-50',    text: 'text-brand-700',   dot: 'bg-brand-600'   },
  COMMUNITY_TRUSTED:     { label: 'Community Trusted',     bg: 'bg-brand-100',   text: 'text-brand-800',   dot: 'bg-brand-500'   },
  HIGHLY_RECOMMENDED:    { label: 'Highly Recommended',    bg: 'bg-green-100',   text: 'text-green-800',   dot: 'bg-green-500'   },
  VERIFIED_NEIGHBORHOOD: { label: 'Verified Neighborhood', bg: 'bg-blue-100',    text: 'text-blue-800',    dot: 'bg-blue-500'    },
  LOW_COMPLAINT:         { label: 'Low Complaint',         bg: 'bg-slate-100',   text: 'text-slate-600',   dot: 'bg-slate-400'   },
  UNDER_REVIEW:          { label: 'Under Review',          bg: 'bg-yellow-100',  text: 'text-yellow-800',  dot: 'bg-yellow-500'  },
  SUSPICIOUS:            { label: 'Suspicious',            bg: 'bg-red-100',     text: 'text-red-900',     dot: 'bg-red-600'     },
  NEEDS_ATTENTION:       { label: 'Needs Attention',       bg: 'bg-red-100',     text: 'text-red-800',     dot: 'bg-red-500'     },
}

const SIZE_CLASSES = {
  sm: 'text-[11px] px-2 py-0.5',
  md: 'text-xs px-2.5 py-1',
  lg: 'text-sm px-3 py-1',
}

export default function TrustBadge({ badge, size = 'sm' }) {
  const cfg = BADGE_CONFIG[badge]
  if (!cfg) return null
  return (
    <span className={`inline-flex items-center gap-1 rounded-full font-semibold ${cfg.bg} ${cfg.text} ${SIZE_CLASSES[size] ?? SIZE_CLASSES.sm}`}>
      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${cfg.dot}`} />
      {cfg.label}
    </span>
  )
}
