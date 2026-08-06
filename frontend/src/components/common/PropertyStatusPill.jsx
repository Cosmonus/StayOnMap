import { Circle, Pencil, Hourglass, Pause, House, Ban, CircleX, CircleHelp } from 'lucide-react'

// Shared property status pill — used in both owner dashboard and admin panel.
// Keeps status labels, colours and icons consistent app-wide.
//
// Lucide, not emoji (changed 2026-08-07). An emoji renders in the OS font, so
// these pills were drawn by Apple or Google rather than by us — different shapes
// on every platform, at a weight we do not control, beside a label set in Plus
// Jakarta Sans. 🟢 in particular is a filled circle in one font and a ring in
// another, which is the entire signal that pill carries.
export const PROPERTY_STATUS_CONFIG = {
  ACTIVE:    { label: 'Active',    icon: Circle,     bg: 'bg-green-50',   text: 'text-green-700'  },
  DRAFT:     { label: 'Draft',     icon: Pencil,     bg: 'bg-slate-100',  text: 'text-slate-600'  },
  PENDING:   { label: 'In Review', icon: Hourglass,  bg: 'bg-yellow-50',  text: 'text-yellow-700' },
  INACTIVE:  { label: 'Inactive',  icon: Pause,      bg: 'bg-slate-100',  text: 'text-slate-500'  },
  OCCUPIED:  { label: 'Occupied',  icon: House,      bg: 'bg-indigo-50',  text: 'text-indigo-700' },
  SUSPENDED: { label: 'Suspended', icon: Ban,        bg: 'bg-red-50',     text: 'text-red-600'    },
  REJECTED:  { label: 'Rejected',  icon: CircleX,    bg: 'bg-red-50',     text: 'text-red-600'    },
}

const FALLBACK = { label: 'Unknown', icon: CircleHelp, bg: 'bg-slate-100', text: 'text-slate-500' }

/**
 * PropertyStatusPill
 * @param {string}  status   — ACTIVE | DRAFT | PENDING | INACTIVE | OCCUPIED | SUSPENDED | REJECTED
 * @param {'sm'|'md'} size   — sm = compact (card overlay), md = normal (list rows)
 */
export default function PropertyStatusPill({ status, size = 'md' }) {
  const cfg = PROPERTY_STATUS_CONFIG[status] ?? FALLBACK
  const Icon = cfg.icon
  const sm = size === 'sm'
  const cls = sm
    ? 'px-2 py-0.5 rounded-full text-[11px] font-bold gap-1'
    : 'px-2.5 py-1 rounded-full text-xs font-bold gap-1.5'
  return (
    <span className={`inline-flex items-center ${cls} ${cfg.bg} ${cfg.text}`}>
      <Icon
        className={sm ? 'w-3 h-3 shrink-0' : 'w-3.5 h-3.5 shrink-0'}
        strokeWidth={2.5}
        // ACTIVE is the one state where the glyph carries meaning on its own —
        // a filled dot reads as "live" the way a hollow ring does not.
        fill={status === 'ACTIVE' ? 'currentColor' : 'none'}
        aria-hidden="true"
      />
      {cfg.label}
    </span>
  )
}
