import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, MoreHorizontal, X } from 'lucide-react'
import { hostService } from '@services/host.service'
import { appointmentService } from '@services/appointment.service'
import { reviewService } from '@services/review.service'
import { toast } from '@components/common/Toaster'
import Modal from '@components/common/Modal'
import TimeSelect from '@components/common/TimeSelect'
import ActionMenu from '@components/common/ActionMenu'
import Select from '@components/common/Select'
import { VISIT_SLOTS, formatTime } from '@utils/time'

// The owner's home screen. One question first — is anyone waiting on me? — and
// every number second.
//
// What it deliberately does NOT do: greet, congratulate, or show a chart. An
// owner opens this between other things; the two visit requests at the top are
// the whole reason the page exists.

// Local date parts, not toISOString(): the ISO string is UTC, so between
// midnight and 05:30 IST it names YESTERDAY, and "Today" would carry the wrong
// date. Same fix AppointmentForm carries.
const NEXT_14_DAYS = Array.from({ length: 14 }, (_, i) => {
  const d = new Date()
  d.setDate(d.getDate() + i)
  const pad = (n) => String(n).padStart(2, '0')
  return {
    value: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
    label: i === 0 ? 'Today' : i === 1 ? 'Tomorrow'
      : d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' }),
  }
})

function sinceLabel(date) {
  const mins = Math.floor((Date.now() - new Date(date).getTime()) / 60000)
  if (mins < 2) return 'just now'
  if (mins < 60) return `${mins} minutes ago`
  const hours = Math.round(mins / 60)
  if (hours < 24) return `${hours} ${hours === 1 ? 'hour' : 'hours'} ago`
  const days = Math.round(hours / 24)
  return days === 1 ? 'yesterday' : `${days} days ago`
}

function visitWhen(item) {
  const d = new Date(item.requestedDate)
  const date = d.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })
  return item.requestedTime ? `${date}, ${formatTime(item.requestedTime)}` : date
}

function Tag({ children, tone = 'brand' }) {
  const tones = {
    brand: 'bg-brand-600 text-white',
    amber: 'bg-amber-600 text-white',
  }[tone]
  return (
    <span className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-bold ${tones}`}>{children}</span>
  )
}

function Action({ children, onClick, variant = 'outline', disabled }) {
  const styles = {
    primary: 'bg-brand-600 hover:bg-brand-700 text-white border-transparent',
    outline: 'bg-white hover:border-slate-400 text-slate-700 border-slate-200',
  }[variant]
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`w-full sm:w-auto shrink-0 min-h-[44px] px-4 py-3 rounded-xl border text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${styles}`}
    >
      {children}
    </button>
  )
}

// Accept leads, "Another time" sits beside it, and declining is one tap deeper
// — the same weighting the mobile card already used, and the same two-buttons-
// plus-a-menu shape as the listing rows. Three side-by-side buttons never fit a
// phone: this row didn't wrap, so "Suggest another time" and "Decline" were
// squeezed to unreadable slivers at 375px.
function VisitRow({ item, onAccept, onSuggest, onDecline, busy }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
      <div className="flex items-start gap-3 min-w-0 flex-1 sm:items-center sm:gap-4">
        <Tag>Visit request</Tag>
        <div className="flex-1 min-w-0">
          <p className="text-base font-bold text-slate-900 truncate">
            {item.person} wants to visit {visitWhen(item)}
          </p>
          <p className="text-sm text-slate-600 truncate mt-0.5">
            {item.listing} · asked {sinceLabel(item.askedAt)}
            {/* Only when we have a record. "viewed it 0 times" would be a claim —
                someone can request a visit straight from a map pin. */}
            {item.viewerViews ? ` · viewed it ${item.viewerViews} ${item.viewerViews === 1 ? 'time' : 'times'}` : ''}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <Action variant="primary" onClick={() => onAccept(item)} disabled={busy}>Accept</Action>
        <Action onClick={() => onSuggest(item)} disabled={busy}>Another time</Action>
        <ActionMenu
          label={`More responses to ${item.person}'s request`}
          items={[{ key: 'decline', label: 'Decline visit', icon: <X size={16} strokeWidth={1.8} />, danger: true, onClick: () => onDecline(item) }]}
          trigger={<MoreHorizontal size={18} strokeWidth={2} />}
          triggerClassName="flex items-center justify-center w-11 h-11 shrink-0 rounded-xl border border-slate-200 bg-white text-slate-600 hover:border-slate-400 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
        />
      </div>
    </div>
  )
}

function ReviewRow({ item, onReply }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
      <div className="flex items-start gap-3 min-w-0 flex-1 sm:items-center sm:gap-4">
        <Tag tone="amber">Review</Tag>
        <div className="flex-1 min-w-0">
          <p className="text-base font-bold text-slate-900 truncate">
            A tenant left you {item.rating ?? '—'} stars
          </p>
          <p className="text-sm text-brand-700 truncate mt-0.5">&ldquo;{item.quote}&rdquo;</p>
        </div>
      </div>
      <Action onClick={() => onReply(item)}>Reply</Action>
    </div>
  )
}

function StatCard({ value, label, sub }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5">
      <p className="font-serif text-4xl font-bold text-slate-900 leading-none">{value}</p>
      <p className="text-sm font-semibold text-slate-800 mt-3">{label}</p>
      {sub && <p className="text-sm text-brand-700 mt-1">{sub}</p>}
    </div>
  )
}

// "+6 vs last month" only when there IS a previous period to compare with — on
// a new listing "+0 vs last month" reads as failure rather than as no history.
function deltaLabel(now, prev) {
  if (!prev) return null
  const diff = now - prev
  if (diff === 0) return 'same as last month'
  return `${diff > 0 ? '+' : ''}${diff} vs last month`
}

export default function HostDashboard({ onAddListing }) {
  const qc = useQueryClient()
  const [suggestFor, setSuggestFor] = useState(null)
  const [replyTo, setReplyTo] = useState(null)
  const [suggestion, setSuggestion] = useState({ date: '', time: '' })
  const [replyText, setReplyText] = useState('')

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['host-dashboard'],
    queryFn: () => hostService.dashboard().then((r) => r.data),
  })

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['host-dashboard'] })
    qc.invalidateQueries({ queryKey: ['owner-appointments'] })
  }

  const { mutate: setStatus, isPending: statusPending } = useMutation({
    mutationFn: ({ id, ...body }) => appointmentService.updateStatus(id, body),
    onSuccess: () => { invalidate(); setSuggestFor(null) },
    onError: (err) => toast.error('Couldn’t update', err.message ?? 'Please try again'),
  })

  const { mutate: reply, isPending: replyPending } = useMutation({
    mutationFn: ({ propertyId, id, response }) => reviewService.respond(propertyId, id, response),
    onSuccess: () => {
      invalidate()
      setReplyTo(null)
      setReplyText('')
      toast.success('Reply posted', 'Renters will see it under the review')
    },
    onError: (err) => toast.error('Couldn’t reply', err.message ?? 'Please try again'),
  })

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => <div key={i} className="h-[84px] rounded-2xl bg-slate-100 animate-pulse" />)}
      </div>
    )
  }

  if (isError) {
    return (
      <div className="text-center py-16">
        <p className="text-sm text-slate-600">We couldn&apos;t load your dashboard.</p>
        <button onClick={() => refetch()} className="min-h-[44px] mt-3 px-4 py-3 rounded-xl border border-slate-200 text-sm font-semibold text-slate-700 hover:border-slate-400">
          Try again
        </button>
      </div>
    )
  }

  const queue = data?.needsYouToday ?? []
  const s = data?.last30Days ?? {}
  const visitCount = queue.filter((q) => q.kind === 'VISIT_REQUEST').length

  // Says what is waiting, in words, or says plainly that nothing is.
  const headline = visitCount > 0
    ? `${visitCount} visit ${visitCount === 1 ? 'request needs' : 'requests need'} an answer today`
    : queue.length > 0
      ? `${queue.length} ${queue.length === 1 ? 'thing needs' : 'things need'} your attention`
      : 'Nothing needs you right now'

  return (
    <div className="space-y-8">
      <div className="flex items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900 tracking-tight">Hosting</h1>
          <p className="text-sm text-slate-600 mt-1">{headline}</p>
        </div>
        <button
          onClick={onAddListing}
          className="shrink-0 flex items-center gap-2 px-5 py-3 text-sm font-bold text-white rounded-xl bg-[#111111] hover:bg-[#2a2a2a] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
        >
          <Plus size={15} strokeWidth={2.4} />
          Add listing
        </button>
      </div>

      {queue.length > 0 && (
        <section>
          <h2 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">Needs you today</h2>
          <div className="space-y-3">
            {queue.map((item) => item.kind === 'VISIT_REQUEST' ? (
              <VisitRow
                key={item.id}
                item={item}
                busy={statusPending}
                onAccept={(i) => setStatus({ id: i.id, status: 'ACCEPTED' })}
                onDecline={(i) => setStatus({ id: i.id, status: 'REJECTED' })}
                onSuggest={(i) => { setSuggestFor(i); setSuggestion({ date: '', time: '' }) }}
              />
            ) : (
              <ReviewRow key={item.id} item={item} onReply={(i) => { setReplyTo(i); setReplyText('') }} />
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">
          Last {s.windowDays ?? 30} days
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            value={s.views ?? 0}
            label="Views"
            sub={s.listingCount ? `across ${s.listingCount} ${s.listingCount === 1 ? 'listing' : 'listings'}` : 'no live listings'}
          />
          <StatCard value={s.saves ?? 0} label="Saves" sub={deltaLabel(s.saves ?? 0, s.savesPrev ?? 0)} />
          <StatCard
            value={s.visitRequests ?? 0}
            label="Visit requests"
            sub={s.visitRequests ? `${s.visitsAccepted ?? 0} accepted` : null}
          />
          <StatCard
            value={s.signedLeases ?? 0}
            label={s.signedLeases === 1 ? 'Signed lease' : 'Signed leases'}
            sub={s.signedLeaseListing}
          />
        </div>
      </section>

      {/* Suggesting a time is a real reschedule, not a decline with a note —
          the tenant gets the new slot on the same appointment. */}
      <Modal isOpen={!!suggestFor} onClose={() => setSuggestFor(null)} title="Suggest another time">
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            {suggestFor?.person} asked for {suggestFor && visitWhen(suggestFor)}. Offer a slot that suits you.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <p className="text-sm font-medium text-slate-700 mb-2">Date</p>
              {/* Named days, not a calendar widget — the same list a renter
                  picks from, and the same next-14-days list mobile offers here.
                  A native date input also let an owner suggest last Tuesday. */}
              <Select
                value={suggestion.date}
                onChange={(v) => setSuggestion((s) => ({ ...s, date: v }))}
                placeholder="Select date"
                options={NEXT_14_DAYS}
              />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-700 mb-2">Time</p>
              {/* The same half-hour slots a renter is offered — an owner
                  suggesting 22:37 was never a slot anyone could book. */}
              <TimeSelect
                value={suggestion.time}
                onChange={(v) => setSuggestion((s) => ({ ...s, time: v }))}
                slots={VISIT_SLOTS}
              />
            </div>
          </div>
          <button
            type="button"
            disabled={!suggestion.date || !suggestion.time || statusPending}
            onClick={() => setStatus({
              id: suggestFor.id,
              status: 'RESCHEDULED',
              scheduledAt: new Date(`${suggestion.date}T${suggestion.time}`).toISOString(),
              ownerNote: `Suggested ${suggestion.date} at ${formatTime(suggestion.time)}`,
            })}
            className="w-full py-3 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-sm font-bold disabled:opacity-50 transition-colors"
          >
            {statusPending ? 'Sending…' : 'Send suggestion'}
          </button>
        </div>
      </Modal>

      <Modal isOpen={!!replyTo} onClose={() => setReplyTo(null)} title="Reply to this review">
        <div className="space-y-4">
          <p className="text-sm text-slate-600 italic">&ldquo;{replyTo?.quote}&rdquo;</p>
          <textarea
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
            rows={4}
            placeholder="Thanks for the note — the water tank is being serviced next week."
            className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-500 resize-none leading-relaxed"
          />
          <button
            type="button"
            disabled={replyText.trim().length < 2 || replyPending}
            onClick={() => reply({ propertyId: replyTo.propertyId, id: replyTo.id, response: replyText.trim() })}
            className="w-full py-3 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-sm font-bold disabled:opacity-50 transition-colors"
          >
            {replyPending ? 'Posting…' : 'Post reply'}
          </button>
        </div>
      </Modal>
    </div>
  )
}
