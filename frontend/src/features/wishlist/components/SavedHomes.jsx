import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { Heart, ImageIcon } from 'lucide-react'
import { savedService } from '@services/saved.service'
import { formatCurrency, imgUrl } from '@utils/format'
import { formatTime } from '@utils/time'
import Price from '@components/listing/Price'
import SpecLine from '@components/listing/SpecLine'
import HomesForYou from './HomesForYou'

// Saved homes — the one page a renter comes BACK to, so every row says what
// CHANGED since they saved it. Mirrors mobile's SavedScreen: same three
// measured signals, same rule that a row shows at most one of them.
//
// It replaced a grid of generic PropertyCards. Those are right for a search
// result and wrong here: they repeat what the renter already decided on and
// have nowhere to put the reason they came back.

function visitLabel(visit) {
  const when = visit.scheduledAt ?? visit.requestedDate
  const day = new Date(when).toLocaleDateString('en-IN', { weekday: 'short' })
  return `Visit booked · ${day} ${formatTime(visit.requestedTime)}`.trim()
}

function Chip({ children, muted }) {
  return (
    <span className={`inline-block mt-2 px-3 py-1.5 rounded-full text-sm font-semibold ${
      muted ? 'bg-slate-100 text-slate-600' : 'bg-brand-50 text-brand-700'
    }`}>
      {children}
    </span>
  )
}

function SavedRow({ item }) {
  const p = item.property
  const url = p.images?.[0]?.url

  return (
    <Link
      to={`/property/${p.id}`}
      className="flex items-start gap-4 p-4 bg-white rounded-2xl border border-slate-200 hover:border-slate-300 no-underline transition-colors"
    >
      <div className="w-[88px] h-[88px] shrink-0 rounded-xl bg-slate-100 overflow-hidden flex items-center justify-center">
        {url
          ? <img src={imgUrl(url)} alt="" loading="lazy" decoding="async" className="w-full h-full object-cover" />
          : <ImageIcon className="w-6 h-6 text-slate-500" strokeWidth={1.6} />}
      </div>

      <div className="flex-1 min-w-0">
        <Price property={p} size="card" />
        <p className="text-base font-semibold text-slate-900 truncate mt-0.5">{p.title}</p>
        {/* The row's own meta line used to be BHK-or-sharing plus furnishing,
            so a saved PLOT or SHORT STAY fell through to its landmark and a
            saved shop said nothing about its size. `text-sm` rather than
            SpecLine's default: this row is denser than a grid card. */}
        <SpecLine property={p} className="!text-sm mt-0.5" />

        {/* At most one chip — the most actionable wins. Stacked chips turn a row
            into a noticeboard. */}
        {!item.isAvailable ? (
          <Chip muted>No longer available</Chip>
        ) : item.visit ? (
          <Chip>{visitLabel(item.visit)}</Chip>
        ) : item.priceDrop > 0 ? (
          <Chip>{formatCurrency(item.priceDrop)} cheaper than when you saved</Chip>
        ) : null}
      </div>
    </Link>
  )
}

export default function SavedHomes() {
  const { data: saved = [], isLoading } = useQuery({
    queryKey: ['saved'],
    queryFn: () => savedService.getMySaved().then((r) => r.data),
  })

  // Fetching this RECORDS the visit, which is what "since you last looked"
  // measures against — so it waits until there is a list to look at.
  const { data: summary } = useQuery({
    queryKey: ['saved-summary'],
    queryFn: () => savedService.summary().then((r) => r.data),
    enabled: saved.length > 0,
  })

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => <div key={i} className="h-[120px] rounded-2xl bg-slate-100 animate-pulse" />)}
      </div>
    )
  }

  if (!saved.length) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <div className="w-14 h-14 rounded-2xl bg-brand-50 flex items-center justify-center text-brand-600 mb-4">
          <Heart size={24} strokeWidth={1.8} />
        </div>
        <h2 className="text-lg font-bold text-slate-800 mb-1">No saved homes yet</h2>
        <p className="text-sm text-slate-500 max-w-xs">
          Tap the heart on any listing to save it here for later.
        </p>
        <Link
          to="/"
          className="mt-6 px-5 py-3 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-sm font-bold no-underline transition-colors"
        >
          Explore homes
        </Link>
      </div>
    )
  }

  // "2 still available" is only worth saying when some are NOT.
  const subline = summary
    ? [
      `${summary.savedCount} saved`,
      summary.availableCount < summary.savedCount ? `${summary.availableCount} still available` : null,
    ].filter(Boolean).join(' · ')
    : null

  const matches = summary?.newMatches

  return (
    <div className="space-y-4 max-w-3xl">
      <div>
        <h1 className="font-display text-2xl font-bold text-slate-900 tracking-tight">Saved homes</h1>
        {subline && <p className="text-sm text-slate-600 mt-1">{subline}</p>}
      </div>

      <div className="space-y-3">
        {saved.map((item) => <SavedRow key={item.id} item={item} />)}
      </div>

      {/* Derived from these very saves, so it belongs beside them. Renders
          nothing — heading included — when we do not yet know enough. */}
      <HomesForYou />

      {/* Only when the backend actually counted some — there is no empty version
          of this card. */}
      {matches && (
        <div className="p-5 rounded-2xl bg-slate-900">
          <p className="text-base text-white leading-relaxed">
            <strong className="font-bold">{matches.count} new {matches.bhk ? `${matches.bhk} BHKs` : 'homes'}</strong>
            {' '}in {matches.area} since you last looked.
          </p>
          <Link
            to="/"
            className="mt-4 block w-full text-center px-5 py-3 rounded-xl bg-white text-slate-900 text-base font-bold no-underline hover:bg-slate-100 transition-colors"
          >
            See what is new
          </Link>
        </div>
      )}
    </div>
  )
}
