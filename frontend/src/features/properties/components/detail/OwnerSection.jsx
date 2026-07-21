import { Check } from 'lucide-react'
import Avatar from '@components/common/Avatar'
import { SheetSection } from './SheetPrimitives'

// ── OwnerTrust display ───────────────────────────────────────────────────────
const OWNER_TRUST_COLORS = {
  EXCELLENT: { pill: 'bg-emerald-50 text-emerald-700 border-emerald-200', bar: 'bg-emerald-500' },
  HIGH:      { pill: 'bg-green-50  text-green-700  border-green-200',     bar: 'bg-green-500'   },
  MEDIUM:    { pill: 'bg-yellow-50 text-yellow-700 border-yellow-200',    bar: 'bg-yellow-500'  },
  LOW:       { pill: 'bg-orange-50 text-orange-700 border-orange-200',    bar: 'bg-orange-400'  },
}

function OwnerTrustPill({ ownerTrust }) {
  const cfg = OWNER_TRUST_COLORS[ownerTrust.level] ?? OWNER_TRUST_COLORS.MEDIUM
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-semibold rounded-full border ${cfg.pill}`}>
      OwnerTrust: {ownerTrust.score}/100
    </span>
  )
}

function OwnerTrustBar({ ownerTrust }) {
  const cfg = OWNER_TRUST_COLORS[ownerTrust.level] ?? OWNER_TRUST_COLORS.MEDIUM
  return (
    <div className="mt-2.5 space-y-1">
      <div className="flex items-center justify-between text-[10px] text-slate-400">
        <span className="font-medium">OwnerTrust™</span>
        <span>{ownerTrust.level?.charAt(0) + ownerTrust.level?.slice(1).toLowerCase()} · {ownerTrust.score}/100</span>
      </div>
      <div className="h-1 bg-slate-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${cfg.bar}`} style={{ width: `${ownerTrust.score}%` }} />
      </div>
      {ownerTrust.responseRate > 0 && (
        <p className="text-[10px] text-slate-400">{ownerTrust.responseRate.toFixed(0)}% response rate</p>
      )}
    </div>
  )
}

// ── "Listed by the owner" sheet section ──────────────────────────────────────
// `createdAt`/`ownerTrustScore` are guarded, not assumed: the admin payload's
// owner select may omit them, and the section must degrade rather than render
// "Member since Invalid Date".
export default function OwnerSection({ owner }) {
  if (!owner) return null
  return (
    <SheetSection title="Listed by the owner">
      <div className="flex items-start gap-4">
        <Avatar src={owner.avatarUrl} name={owner.name || 'Owner'} size="lg" className="shrink-0 border border-slate-100" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-base font-bold text-slate-900">
            {owner.name ?? 'Owner'}
          </p>
          {owner.createdAt && (
            <p className="mt-0.5 text-xs text-slate-400">
              Member since {new Date(owner.createdAt).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}
            </p>
          )}
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-100 bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
              <Check className="h-3 w-3" strokeWidth={2.5} />
              Direct owner — no brokerage
            </span>
            {owner.ownerTrustScore && owner.ownerTrustScore.level !== 'UNRATED' && (
              <OwnerTrustPill ownerTrust={owner.ownerTrustScore} />
            )}
          </div>
          {owner.ownerTrustScore && owner.ownerTrustScore.level !== 'UNRATED' && (
            <OwnerTrustBar ownerTrust={owner.ownerTrustScore} />
          )}
        </div>
      </div>
    </SheetSection>
  )
}
