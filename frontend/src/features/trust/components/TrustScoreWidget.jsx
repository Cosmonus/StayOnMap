import { useId } from 'react'
import TrustBadge from '@components/common/TrustBadge'

function Stars({ score }) {
  const uid     = useId()
  const clamped = Math.max(0, Math.min(5, score ?? 0))
  return (
    <div className="flex gap-0.5 items-center">
      {Array.from({ length: 5 }).map((_, i) => {
        const filled = clamped >= i + 1
        const half   = !filled && clamped >= i + 0.5
        const id     = `${uid}-${i}`
        return (
          <svg key={i} width="26" height="26" viewBox="0 0 24 24">
            {half && (
              <defs>
                <linearGradient id={id} x1="0" x2="1" y1="0" y2="0">
                  <stop offset="50%" stopColor="#f59e0b"/>
                  <stop offset="50%" stopColor="#e2e8f0"/>
                </linearGradient>
              </defs>
            )}
            <path
              fill={half ? `url(#${id})` : filled ? '#f59e0b' : '#e2e8f0'}
              d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
            />
          </svg>
        )
      })}
    </div>
  )
}

function ScoreRow({ label, value, uid }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-xs font-medium text-slate-500 w-24 shrink-0">{label}</span>
      <div className="flex items-center gap-2">
        <span className="text-sm font-bold text-slate-800 tabular-nums">
          {value > 0 ? value.toFixed(1) : '—'}<span className="font-normal text-slate-500 text-xs">/5</span>
        </span>
        <MiniStars score={value} uid={uid} />
      </div>
    </div>
  )
}

function MiniStars({ score, uid }) {
  const clamped = Math.max(0, Math.min(5, score ?? 0))
  return (
    <div className="flex gap-0.5 items-center">
      {Array.from({ length: 5 }).map((_, i) => {
        const filled = clamped >= i + 1
        const half   = !filled && clamped >= i + 0.5
        const id     = `${uid}-mini-${i}`
        return (
          <svg key={i} width="14" height="14" viewBox="0 0 24 24">
            {half && (
              <defs>
                <linearGradient id={id} x1="0" x2="1" y1="0" y2="0">
                  <stop offset="50%" stopColor="#f59e0b"/>
                  <stop offset="50%" stopColor="#e2e8f0"/>
                </linearGradient>
              </defs>
            )}
            <path
              fill={half ? `url(#${id})` : filled ? '#f59e0b' : '#e2e8f0'}
              d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
            />
          </svg>
        )
      })}
    </div>
  )
}

function InsightTile({ label, value, max = 10 }) {
  return (
    <div className="p-3 text-center rounded-xl border" style={{ background: '#f8fafc', borderColor: '#f1f5f9' }}>
      <div className="text-lg font-bold leading-none text-slate-800">
        {value > 0 ? value.toFixed(1) : '—'}
        <span className="font-normal text-[0.65rem] opacity-60">/{max}</span>
      </div>
      <div className="text-[0.7rem] mt-1 font-medium text-slate-500">{label}</div>
    </div>
  )
}

export default function TrustScoreWidget({ trustScore, riskScore: _riskScore }) {
  const uid = useId()
  if (!trustScore) {
    return (
      <div className="py-6 text-center">
        <p className="text-sm font-medium text-slate-500">No community data yet</p>
        <p className="text-xs text-slate-500 mt-1">Be the first to review this property.</p>
      </div>
    )
  }

  const score        = Number(trustScore.overallScore ?? 0)
  const hasReviews   = (trustScore.totalReviews ?? 0) > 0
  const recommendPct = Number(trustScore.recommendPercent ?? 0)

  const hasAreaScores   = (trustScore.areaScore > 0) || (trustScore.waterScore > 0) || (trustScore.floodSafeRating > 0)
  const hasReviewScores = hasReviews && (
    (trustScore.safetyScore > 0) || (trustScore.cleanlinessScore > 0) || (trustScore.neighborhoodScore > 0)
  )

  return (
    <div className="space-y-4">

      {/* Header */}
      <div>
        <p className="text-2xl font-bold text-slate-900 leading-none mb-2">
          {hasReviews && score > 0 ? score.toFixed(1) : '—'}<span className="text-slate-500 font-normal">/5</span>
        </p>
        {/* The star row has to obey the same gate as the number above it. It
            didn't, so a listing carrying a stored score with zero reviews
            printed "—/5", "No reviews yet", and four gold stars — the one card
            on the page whose entire job is not overstating what we know. */}
        {hasReviews && score > 0 && <div className="mb-2"><Stars score={score} /></div>}
        <p className="text-xs text-slate-500 mt-2">
          {hasReviews
            ? <>{recommendPct.toFixed(0)}% recommend &middot; {trustScore.totalReviews} review{trustScore.totalReviews !== 1 ? 's' : ''}</>
            : 'No reviews yet'
          }
        </p>
        {trustScore.badge && <div className="mt-2"><TrustBadge badge={trustScore.badge} size="sm" /></div>}
      </div>

      <div className="border-t border-slate-100" />

      {/* Area insights */}
      {hasAreaScores && (
        <div>
          <p className="text-[0.7rem] font-semibold text-slate-500 uppercase tracking-widest mb-2.5">Area Insights</p>
          <div className="grid grid-cols-2 gap-2">
            {trustScore.areaScore > 0        && <InsightTile label="Area"          value={trustScore.areaScore}        />}
            {trustScore.waterScore > 0       && <InsightTile label="Water"         value={trustScore.waterScore}       />}
            {trustScore.floodSafeRating > 0  && <InsightTile label="Flood safety"  value={trustScore.floodSafeRating}  />}
          </div>
        </div>
      )}

      {/* Review scores */}
      {hasReviewScores ? (
        <div>
          <p className="text-[0.7rem] font-semibold text-slate-500 uppercase tracking-widest mb-3">From Reviews</p>
          <div className="flex flex-col gap-3">
            <ScoreRow label="Safety"        value={Number(trustScore.safetyScore       ?? 0)} uid={`${uid}-s`} />
            <ScoreRow label="Cleanliness"   value={Number(trustScore.cleanlinessScore  ?? 0)} uid={`${uid}-c`} />
            <ScoreRow label="Neighbourhood" value={Number(trustScore.neighborhoodScore ?? 0)} uid={`${uid}-n`} />
          </div>
        </div>
      ) : (
        <div className="py-4 bg-slate-50 rounded-xl text-center">
          <p className="text-xs text-slate-500">Scores appear once tenants review this property.</p>
        </div>
      )}

    </div>
  )
}
