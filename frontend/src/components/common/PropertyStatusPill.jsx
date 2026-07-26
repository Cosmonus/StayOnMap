// Shared property status pill — used in both owner dashboard and admin panel.
// Keeps status labels, colors, and emojis consistent app-wide.
export const PROPERTY_STATUS_CONFIG = {
  ACTIVE:    { label: 'Active',    emoji: '🟢', bg: 'bg-green-50',   text: 'text-green-700'  },
  DRAFT:     { label: 'Draft',     emoji: '✏️',  bg: 'bg-slate-100',  text: 'text-slate-600'  },
  PENDING:   { label: 'In Review', emoji: '⏳',  bg: 'bg-yellow-50',  text: 'text-yellow-700' },
  INACTIVE:  { label: 'Inactive',  emoji: '⏸️',  bg: 'bg-slate-100',  text: 'text-slate-500'  },
  OCCUPIED:  { label: 'Occupied',  emoji: '🏠',  bg: 'bg-indigo-50',  text: 'text-indigo-700' },
  SUSPENDED: { label: 'Suspended', emoji: '🚫',  bg: 'bg-red-50',     text: 'text-red-600'    },
  REJECTED:  { label: 'Rejected',  emoji: '❌',  bg: 'bg-red-50',     text: 'text-red-600'    },
}

const FALLBACK = { label: 'Unknown', emoji: '❓', bg: 'bg-slate-100', text: 'text-slate-500' }

/**
 * PropertyStatusPill
 * @param {string}  status   — ACTIVE | DRAFT | PENDING | INACTIVE | SUSPENDED | REJECTED
 * @param {'sm'|'md'} size   — sm = compact (card overlay), md = normal (list rows)
 */
export default function PropertyStatusPill({ status, size = 'md' }) {
  const cfg = PROPERTY_STATUS_CONFIG[status] ?? FALLBACK
  const cls = size === 'sm'
    ? 'px-2 py-0.5 rounded-full text-[10px] font-bold gap-1'
    : 'px-2.5 py-1 rounded-full text-xs font-bold gap-1.5'
  return (
    <span className={`inline-flex items-center ${cls} ${cfg.bg} ${cfg.text}`}>
      <span className="leading-none">{cfg.emoji}</span>
      {cfg.label}
    </span>
  )
}
