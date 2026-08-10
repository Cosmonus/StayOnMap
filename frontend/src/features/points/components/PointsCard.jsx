import { useQuery } from '@tanstack/react-query'
import { Sparkles } from 'lucide-react'
import { pointsService } from '@services/points.service'

// Why each ledger action existed, in the user's language. The design rule
// (docs/points-and-sharing.md): points reward helping the NEXT renter, never
// activity — so every label names the help, not the click.
const ACTION_LABELS = {
  REVIEW_APPROVED: 'Review approved',
  REPORT_RESOLVED: 'Report confirmed by a moderator',
  INSIGHT_ADDED: 'Neighbourhood insight shared',
  LEASE_SIGNED: 'Lease signed on StayOnMap',
  EMAIL_VERIFIED: 'Email verified',
  PHONE_VERIFIED: 'Phone verified',
  PROFILE_COMPLETED: 'Profile completed',
}

/**
 * Private points summary — a ledger, not a counter, so "why do I have 420
 * points?" always has an answer. No leaderboard, no streaks, by design:
 * points are visible only to the person who earned them.
 */
export default function PointsCard() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['points'],
    queryFn: () => pointsService.getSummary().then((r) => r.data),
  })

  if (isLoading) return <div className="bg-slate-100 animate-pulse rounded-2xl h-40" />
  // Vanishing is acceptable here and a zero is not: the card would otherwise
  // render "0 points" off an undefined payload, telling someone they lost
  // points they still have. Nothing is claimed by an absent card.
  if (isError || !data) return null

  const progressPct = Math.round((data.progress ?? 0) * 100)

  return (
    <div className="bg-white rounded-2xl border border-slate-100 p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-brand-50 flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-brand-600" strokeWidth={1.8} />
          </div>
          <div>
            <p className="text-sm font-bold text-slate-900">{data.name ?? `Level ${data.level}`}</p>
            <p className="text-[11px] text-slate-500">Points for helping the next renter — visible only to you</p>
          </div>
        </div>
        <p className="text-2xl font-bold text-brand-700 tabular-nums">{data.points}</p>
      </div>

      {data.nextLevel != null && (
        <div className="mb-3">
          <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
            <div className="h-full bg-brand-500 rounded-full" style={{ width: `${progressPct}%` }} />
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            {data.pointsToNext} points to level {data.nextLevel}
          </p>
        </div>
      )}

      {data.history?.length ? (
        <ul className="space-y-1.5 border-t border-slate-50 pt-3">
          {data.history.slice(0, 5).map((row) => (
            <li key={row.id} className="flex items-center justify-between text-xs">
              <span className="text-slate-600">{ACTION_LABELS[row.action] ?? row.action}</span>
              <span className="font-semibold text-slate-800 tabular-nums">+{row.points}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-slate-500 border-t border-slate-50 pt-3">
          Earn points when a review is approved, a report you filed is confirmed, or you sign a
          lease here. Anonymous reports earn nothing — that&apos;s the trade for anonymity.
        </p>
      )}
    </div>
  )
}
