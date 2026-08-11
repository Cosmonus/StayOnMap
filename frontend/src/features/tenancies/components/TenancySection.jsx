import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Star, KeyRound, Check, X } from 'lucide-react'
import { tenancyService } from '@services/tenancy.service'
import { useUiStore } from '@store/uiStore'
import Modal from '@components/common/Modal'
import { toast } from '@components/common/Toaster'

// The tenancy record, on the Rented/leases tab for both hats. Renter mode
// shows where YOU have lived (confirm prompts included); host mode shows who
// has lived in YOUR listings. Renders nothing when there is no history — the
// record announces itself through the confirm notification, not an empty box.

function monthsLabel(t) {
  const end = t.endedAt ? new Date(t.endedAt) : new Date()
  const months = Math.max(0, Math.floor((end - new Date(t.startedAt)) / (30 * 864e5)))
  const span = t.endedAt ? 'lived here' : 'so far'
  return months < 1 ? 'less than a month' : `${months} month${months === 1 ? '' : 's'} ${span}`
}

function Stars({ value }) {
  return (
    <span className="inline-flex items-center gap-0.5" role="img" aria-label={`Rated ${value} out of 5`}>
      {[1, 2, 3, 4, 5].map((n) => (
        // eslint-disable-next-line no-restricted-syntax -- aria-hidden glyph in a role=img group; the label carries the rating, the grey star is decorative
        <Star key={n} size={13} aria-hidden="true" className={n <= value ? 'text-amber-500 fill-amber-500' : 'text-slate-300'} />
      ))}
    </span>
  )
}

function ReviewModal({ tenancy, otherRole, onClose }) {
  const qc = useQueryClient()
  const [rating, setRating] = useState(0)
  const [content, setContent] = useState('')

  const mutation = useMutation({
    mutationFn: () => tenancyService.addReview(tenancy.id, { rating, content: content.trim() }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tenancies'] })
      onClose()
      toast.success('Review submitted', 'It becomes visible once both of you have written one — or after 14 days.')
    },
    onError: (err) => toast.error('Couldn’t submit', err?.message),
  })

  return (
    <Modal isOpen onClose={onClose} title={`Review your ${otherRole}`}>
      <div className="space-y-4">
        <p className="text-sm text-slate-600">
          Reviews are <span className="font-semibold">double-blind</span>: neither of you sees the
          other&rsquo;s until both are written, or 14 days pass. Write it honestly — it can&rsquo;t be
          answered back at.
        </p>
        <div className="flex gap-1" role="radiogroup" aria-label="Rating">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              onClick={() => setRating(n)}
              role="radio"
              aria-checked={n === rating}
              aria-label={`${n} star${n === 1 ? '' : 's'}`}
              className="flex h-11 w-11 items-center justify-center rounded-xl hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
            >
              {/* eslint-disable-next-line no-restricted-syntax -- aria-hidden glyph; the button's own aria-label carries the rating, the grey star is decorative */}
              <Star size={22} aria-hidden="true" className={n <= rating ? 'text-amber-500 fill-amber-500' : 'text-slate-300'} />
            </button>
          ))}
        </div>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          maxLength={1000}
          rows={4}
          placeholder="How was the tenancy? Rent on time, communication, the state of the home…"
          className="w-full rounded-xl border border-slate-200 px-3 py-3 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-500"
          aria-label="Review text"
        />
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="min-h-[40px] px-4 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-100">
            Cancel
          </button>
          <button
            onClick={() => mutation.mutate()}
            disabled={!rating || content.trim().length < 10 || mutation.isPending}
            className="min-h-[40px] px-5 rounded-xl bg-[#111111] text-white text-sm font-semibold hover:bg-[#2a2a2a] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {mutation.isPending ? 'Submitting…' : 'Submit review'}
          </button>
        </div>
      </div>
    </Modal>
  )
}

function TenancyRow({ t, hat, onReview }) {
  const qc = useQueryClient()
  const otherRole = hat === 'owner' ? 'tenant' : 'owner'
  const confirm = useMutation({
    mutationFn: () => tenancyService.confirm(t.id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['tenancies'] }); toast.success('Tenancy confirmed', 'It now counts toward your rental history.') },
    onError: (err) => toast.error('Couldn’t confirm', err?.message),
  })
  const decline = useMutation({
    mutationFn: () => tenancyService.decline(t.id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['tenancies'] }); toast.info('Removed', 'The owner has been told this record was wrong.') },
    onError: (err) => toast.error('Couldn’t remove', err?.message),
  })

  const needsConfirm = hat === 'tenant' && !t.confirmedAt

  return (
    <div className="p-4 bg-white rounded-2xl border border-slate-200">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-800 truncate">{t.property.title}</p>
          <p className="text-xs text-slate-500 mt-0.5">
            {t.property.city} · {monthsLabel(t)}{t.endedAt ? '' : ' · ongoing'}
          </p>
        </div>

        {needsConfirm ? (
          <div className="flex gap-2 shrink-0">
            <button
              onClick={() => confirm.mutate()}
              disabled={confirm.isPending || decline.isPending}
              className="inline-flex items-center gap-1.5 min-h-[40px] px-4 rounded-xl bg-brand-600 text-white text-sm font-semibold hover:bg-brand-700 disabled:opacity-60"
            >
              <Check size={14} aria-hidden="true" /> Yes, I rent here
            </button>
            <button
              onClick={() => decline.mutate()}
              disabled={confirm.isPending || decline.isPending}
              className="inline-flex items-center gap-1.5 min-h-[40px] px-4 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:border-red-300 hover:text-red-600 disabled:opacity-60"
            >
              <X size={14} aria-hidden="true" /> Not me
            </button>
          </div>
        ) : t.canReview ? (
          <button
            onClick={() => onReview(t)}
            className="shrink-0 min-h-[40px] px-4 rounded-xl border border-slate-200 text-sm font-semibold text-slate-700 hover:border-brand-500 hover:text-brand-700"
          >
            Review your {otherRole}
          </button>
        ) : null}
      </div>

      {needsConfirm && (
        <p className="text-xs text-amber-700 mt-2">
          The owner marked you as their tenant. Confirming builds your rental history; it counts
          for nothing until you do.
        </p>
      )}

      {t.myReview && (
        <div className="mt-3 rounded-xl bg-slate-50 p-3">
          <p className="text-xs font-semibold text-slate-600 mb-1">Your review <Stars value={t.myReview.rating} /></p>
          <p className="text-sm text-slate-700 leading-relaxed">{t.myReview.content}</p>
        </div>
      )}
      {t.theirReview && (
        <div className="mt-2 rounded-xl bg-brand-50 p-3">
          <p className="text-xs font-semibold text-brand-700 mb-1">Their review <Stars value={t.theirReview.rating} /></p>
          <p className="text-sm text-slate-700 leading-relaxed">{t.theirReview.content}</p>
        </div>
      )}
      {t.theirReviewPending && (
        <p className="text-xs text-slate-500 mt-2">
          They&rsquo;ve written a review — write yours to see it, or it becomes visible in 14 days.
        </p>
      )}
      {t.reviewBlockedReason && !t.myReview && !needsConfirm && (
        <p className="text-xs text-slate-500 mt-2">{t.reviewBlockedReason}</p>
      )}
    </div>
  )
}

export default function TenancySection() {
  const hostMode = useUiStore((s) => s.hostMode)
  const hat = hostMode ? 'owner' : 'tenant'
  const [reviewing, setReviewing] = useState(null)

  const { data: tenancies = [] } = useQuery({
    queryKey: ['tenancies', hat],
    queryFn: () => tenancyService.mine(hat).then((r) => r.data),
  })

  if (!tenancies.length) return null

  return (
    <section className="mb-8">
      <h2 className="flex items-center gap-2 text-base font-bold text-slate-800 mb-3">
        <KeyRound size={16} className="text-brand-600" aria-hidden="true" />
        {hostMode ? 'Tenancy record' : 'Where you’ve rented'}
      </h2>
      <div className="space-y-2">
        {tenancies.map((t) => (
          <TenancyRow key={t.id} t={t} hat={hat} onReview={setReviewing} />
        ))}
      </div>
      {reviewing && (
        <ReviewModal
          tenancy={reviewing}
          otherRole={hat === 'owner' ? 'tenant' : 'owner'}
          onClose={() => setReviewing(null)}
        />
      )}
    </section>
  )
}
