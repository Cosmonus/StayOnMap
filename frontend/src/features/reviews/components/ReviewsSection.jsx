import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Star, X, Check, Reply, SquarePen } from 'lucide-react'
import { reviewService } from '@services/review.service'
import { toast } from '@components/common/Toaster'
import { useAuth } from '@features/auth/hooks/useAuth'
import { useUiStore } from '@store/uiStore'

const RATING_LABELS = {
  ratingsSafety:        'Safety',
  ratingsClean:         'Cleanliness',
  ratingsWater:         'Water',
  ratingsNoise:         'Noise',
  ratingsInternet:      'Internet',
  ratingsParking:       'Parking',
  ratingsNeighborhood:  'Neighborhood',
  ratingsTransport:     'Transport',
  ratingsMaintenance:   'Maintenance',
  ratingsOwnerBehavior: 'Owner',
  ratingsSecurity:      'Security',
  ratingsPowerBackup:   'Power',
}

const REVIEWER_TYPES = [
  { value: 'TENANT',          label: 'Current Tenant'   },
  { value: 'PREVIOUS_TENANT', label: 'Previous Tenant'  },
  { value: 'NEIGHBOR',        label: 'Neighbor'         },
  { value: 'COMMUNITY',       label: 'Community Member' },
]

function avgRating(review) {
  const keys = Object.keys(RATING_LABELS)
  return keys.reduce((s, k) => s + (review[k] ?? 0), 0) / keys.length
}

function StarDisplay({ value, max = 5, size = 'sm' }) {
  const w = size === 'sm' ? 'w-3.5 h-3.5' : 'w-5 h-5'
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: max }).map((_, i) => (
        <Star key={i} className={`${w} ${i < Math.round(value) ? 'text-amber-400' : 'text-slate-200'}`} fill="currentColor" stroke="none" />
      ))}
    </div>
  )
}

function RatingRow({ label, value, onChange }) {
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-slate-50 last:border-0">
      <span className="text-sm text-slate-600 min-w-0 flex-1">{label}</span>
      <div className="flex gap-0.5 shrink-0">
        {[1, 2, 3, 4, 5].map(n => (
          <button key={n} type="button" onClick={() => onChange(n)} className="p-0.5 transition-transform hover:scale-110 active:scale-95">
            <Star className={`w-6 h-6 transition-colors ${n <= value ? 'text-amber-400' : 'text-slate-200 hover:text-amber-200'}`} fill="currentColor" stroke="none" />
          </button>
        ))}
      </div>
    </div>
  )
}

function WriteReviewForm({ propertyId, onCancel, onSuccess }) {
  const qc = useQueryClient()
  const defaultRatings = Object.fromEntries(Object.keys(RATING_LABELS).map(k => [k, 3]))
  const [form, setForm] = useState({ reviewerType: 'TENANT', recommend: true, isAnonymous: false, body: '', ...defaultRatings })

  const mutation = useMutation({
    mutationFn: (data) => reviewService.submit(propertyId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['reviews', propertyId] })
      toast.success('Review submitted', 'Your review is under moderation and will appear once approved.')
      onSuccess?.()
    },
    onError: (err) => {
      const msg = err?.message ?? err?.error ?? 'Failed to submit review. Please try again.'
      toast.error('Submission failed', msg)
    },
  })

  const setRating = (key, val) => setForm(f => ({ ...f, [key]: val }))
  const MIN_CHARS = 10
  const isValid = form.body.trim().length >= MIN_CHARS && !mutation.isPending

  return (
    <div className="rounded-2xl border border-brand-100 bg-brand-50/30 p-5 space-y-5">
      <div className="flex items-center justify-between">
        <p className="text-sm font-bold text-slate-800">Write a review</p>
        <button onClick={onCancel} className="w-7 h-7 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-400 transition-colors">
          <X className="w-3.5 h-3.5" strokeWidth={2.5} />
        </button>
      </div>

      {/* Reviewer type */}
      <div>
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">You are a</p>
        <div className="flex flex-wrap gap-2">
          {REVIEWER_TYPES.map(t => (
            <button
              key={t.value}
              type="button"
              onClick={() => setForm(f => ({ ...f, reviewerType: t.value }))}
              className={`px-3.5 py-1.5 rounded-xl border text-sm font-medium transition-all ${
                form.reviewerType === t.value
                  ? 'bg-brand-600 border-brand-600 text-white'
                  : 'bg-white border-slate-200 text-slate-600 hover:border-brand-300 hover:text-brand-600'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Toggles */}
      <div className="flex gap-2 flex-wrap">
        {[
          { key: 'recommend',   label: 'I recommend this' },
          { key: 'isAnonymous', label: 'Post anonymously'  },
        ].map(({ key, label }) => (
          <button
            key={key}
            type="button"
            onClick={() => setForm(f => ({ ...f, [key]: !f[key] }))}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl border text-sm font-medium transition-all ${
              form[key]
                ? 'bg-emerald-50 border-emerald-300 text-emerald-700'
                : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'
            }`}
          >
            <div className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${form[key] ? 'bg-emerald-500 border-emerald-500' : 'border-slate-300'}`}>
              {form[key] && <Check className="w-2.5 h-2.5 text-white" strokeWidth={3} />}
            </div>
            {label}
          </button>
        ))}
      </div>

      {/* Ratings */}
      <div>
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">Rate each category</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8">
          {Object.entries(RATING_LABELS).map(([key, label]) => (
            <RatingRow key={key} label={label} value={form[key]} onChange={v => setRating(key, v)} />
          ))}
        </div>
      </div>

      {/* Body */}
      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1.5">Your experience</label>
        <textarea
          rows={4}
          value={form.body}
          onChange={e => setForm(f => ({ ...f, body: e.target.value }))}
          placeholder="Share your experience — what was great, what could be better"
          className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none bg-white"
        />
        {form.body.trim().length < MIN_CHARS ? (
          <p className="text-xs mt-1 text-slate-400">
            {MIN_CHARS - form.body.trim().length} more character{MIN_CHARS - form.body.trim().length !== 1 ? 's' : ''} needed
          </p>
        ) : (
          <p className="text-xs mt-1 text-emerald-500">Looks good ✓</p>
        )}
      </div>

      {mutation.isError && (
        <p className="text-sm text-red-600">{mutation.error?.message ?? 'Failed to submit. Please try again.'}</p>
      )}

      <button
        disabled={!isValid}
        onClick={() => mutation.mutate(form)}
        className="w-full py-3 rounded-xl bg-brand-600 text-white font-semibold text-sm hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {mutation.isPending ? 'Submitting…' : 'Submit Review'}
      </button>
    </div>
  )
}

function ReviewCard({ review, propertyId, isOwner, ownerInfo }) {
  const qc = useQueryClient()
  const [replyOpen, setReplyOpen] = useState(false)
  const [draft, setDraft] = useState(review.ownerResponse ?? '')

  const name    = review.isAnonymous ? 'Anonymous' : (review.reviewer?.name ?? 'Community Member')
  const initial = name[0].toUpperCase()
  const avg     = avgRating(review)
  const date    = new Date(review.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
  const type    = REVIEWER_TYPES.find(t => t.value === review.reviewerType)?.label ?? review.reviewerType?.replace('_', ' ')

  const replyMutation = useMutation({
    mutationFn: (text) => reviewService.respond(propertyId, review.id, text),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['reviews', propertyId] })
      setReplyOpen(false)
      toast.success('Response saved', 'Your reply is now visible on this review.')
    },
    onError: () => toast.error('Failed', 'Could not save your response.'),
  })

  return (
    <div className="p-4 rounded-xl border border-slate-100 bg-white">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          {review.reviewer?.avatarUrl && !review.isAnonymous ? (
            <img src={review.reviewer.avatarUrl} alt="" className="w-9 h-9 rounded-full object-cover shrink-0" />
          ) : (
            <div className="w-9 h-9 rounded-full bg-brand-50 text-brand-700 text-sm font-bold flex items-center justify-center shrink-0">
              {review.isAnonymous ? '?' : initial}
            </div>
          )}
          <div>
            <p className="text-sm font-semibold text-slate-800">{name}</p>
            <p className="text-xs text-slate-400">{type} · {date}</p>
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <span className="text-sm font-bold text-slate-800">{avg.toFixed(1)}</span>
          <Star className="w-4 h-4 text-amber-400" fill="currentColor" stroke="none" />
        </div>
      </div>

      <p className="text-sm text-slate-700 leading-relaxed">{review.body}</p>

      {review.recommend !== undefined && (
        <div className={`mt-2.5 inline-flex items-center gap-1.5 text-xs font-medium ${review.recommend ? 'text-emerald-600' : 'text-red-500'}`}>
          {review.recommend ? <Check className="w-3.5 h-3.5" strokeWidth={2.5} /> : <X className="w-3.5 h-3.5" strokeWidth={2.5} />}
          {review.recommend ? 'Recommends this property' : 'Does not recommend'}
        </div>
      )}

      {review.ownerResponse && !replyOpen && (
        <div className="mt-3 ml-3 border-l-2 border-brand-200 pl-3">
          <div className="flex items-center gap-2 mb-1.5">
            {ownerInfo?.avatarUrl ? (
              <img src={ownerInfo.avatarUrl} alt="" className="w-6 h-6 rounded-full object-cover shrink-0" />
            ) : (
              <div className="w-6 h-6 rounded-full bg-brand-100 text-brand-700 text-[10px] font-bold flex items-center justify-center shrink-0">
                {(ownerInfo?.name ?? 'O')[0].toUpperCase()}
              </div>
            )}
            <span className="text-[11px] font-semibold text-brand-700">{ownerInfo?.name ?? 'Owner'}</span>
            <span className="text-[10px] text-slate-400">· Owner response</span>
          </div>
          <p className="text-xs text-slate-700 leading-relaxed">{review.ownerResponse}</p>
          {isOwner && (
            <button onClick={() => { setDraft(review.ownerResponse ?? ''); setReplyOpen(true) }} className="mt-1.5 text-[10px] font-semibold text-brand-600 hover:underline">
              Edit response
            </button>
          )}
        </div>
      )}

      {isOwner && !review.ownerResponse && !replyOpen && (
        <button onClick={() => setReplyOpen(true)} className="mt-3 flex items-center gap-1.5 text-xs font-medium text-slate-400 hover:text-brand-600 transition-colors">
          <Reply className="w-3.5 h-3.5" strokeWidth={2} />
          Reply as owner
        </button>
      )}

      {isOwner && replyOpen && (
        <div className="mt-3 space-y-2">
          <textarea
            rows={3}
            value={draft}
            onChange={e => setDraft(e.target.value)}
            placeholder="Write a professional, helpful response to this review…"
            className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none"
          />
          <div className="flex gap-2">
            <button onClick={() => replyMutation.mutate(draft.trim())} disabled={replyMutation.isPending || !draft.trim()} className="flex-1 py-2 rounded-xl bg-brand-600 text-white text-xs font-semibold hover:bg-brand-700 disabled:opacity-50 transition-colors">
              {replyMutation.isPending ? 'Saving…' : 'Post response'}
            </button>
            {review.ownerResponse && (
              <button onClick={() => replyMutation.mutate('')} disabled={replyMutation.isPending} className="px-3 py-2 rounded-xl bg-red-50 text-red-600 text-xs font-semibold hover:bg-red-100 disabled:opacity-50 transition-colors">
                Remove
              </button>
            )}
            <button onClick={() => setReplyOpen(false)} className="px-3 py-2 rounded-xl bg-slate-100 text-slate-500 text-xs font-semibold hover:bg-slate-200 transition-colors">
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default function ReviewsSection({ propertyId, isOwner = false, ownerInfo = null }) {
  const [writeOpen, setWriteOpen] = useState(false)
  const { user } = useAuth()
  const openLoginModal = useUiStore(s => s.openLoginModal)

  const { data: reviews = [], isLoading } = useQuery({
    queryKey: ['reviews', propertyId],
    queryFn: () => reviewService.list(propertyId).then(r => r.data),
  })

  if (isLoading) {
    return <div className="h-24 bg-slate-50 rounded-xl animate-pulse" />
  }

  const count       = reviews.length
  const totalAvg    = count > 0 ? reviews.reduce((s, r) => s + avgRating(r), 0) / count : 0
  const recommendN  = reviews.filter(r => r.recommend).length
  const recommendPct = count > 0 ? Math.round((recommendN / count) * 100) : 0

  function handleWriteClick() {
    if (!user) { openLoginModal(); return }
    setWriteOpen(v => !v)
  }

  return (
    <div className="space-y-4">

      {/* Header row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {count > 0 && (
            <>
              <span className="text-2xl font-bold text-slate-900">{totalAvg.toFixed(1)}</span>
              <StarDisplay value={totalAvg} size="md" />
              <span className="text-sm text-slate-400">{count} review{count !== 1 ? 's' : ''}</span>
            </>
          )}
        </div>
        <button
          onClick={handleWriteClick}
          className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl border text-sm font-medium transition-all ${
            writeOpen
              ? 'bg-brand-50 border-brand-300 text-brand-700'
              : 'border-slate-200 text-slate-600 hover:border-brand-400 hover:text-brand-600 hover:bg-brand-50'
          }`}
        >
          <SquarePen className="w-3.5 h-3.5" strokeWidth={2.5} />
          {user ? (writeOpen ? 'Cancel' : 'Write a review') : 'Sign in to review'}
        </button>
      </div>

      {/* Recommend bar — only when reviews exist */}
      {count > 0 && (
        <div className="flex items-center gap-3">
          <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
            <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${recommendPct}%` }} />
          </div>
          <span className="text-xs font-semibold text-slate-600 shrink-0">{recommendPct}% recommend</span>
        </div>
      )}

      {/* Inline write form */}
      {writeOpen && (
        <WriteReviewForm
          propertyId={propertyId}
          onCancel={() => setWriteOpen(false)}
          onSuccess={() => setWriteOpen(false)}
        />
      )}

      {/* Reviews list */}
      {count === 0 && !writeOpen ? (
        <div className="text-center py-8 bg-slate-50 rounded-xl">
          <p className="text-sm text-slate-400">No reviews yet. Be the first to share your experience.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {reviews.map(r => (
            <ReviewCard key={r.id} review={r} propertyId={propertyId} isOwner={isOwner} ownerInfo={ownerInfo} />
          ))}
        </div>
      )}
    </div>
  )
}
