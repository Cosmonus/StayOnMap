import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Calendar } from 'lucide-react'
import { appointmentService } from '@services/appointment.service'
import { toast } from '@components/common/Toaster'
import { confirm } from '@components/common/ConfirmDialog'
import { useUiStore } from '@store/uiStore'
import { formatTime } from '@utils/time'

// ── Helpers ─────────────────────────────────────────────────────────
const STATUS = {
  PENDING:     { bg: 'bg-amber-50',  text: 'text-amber-700',  dot: 'bg-amber-400', label: 'Pending' },
  ACCEPTED:    { bg: 'bg-green-50',  text: 'text-green-700',  dot: 'bg-green-400', label: 'Accepted' },
  REJECTED:    { bg: 'bg-red-50',    text: 'text-red-600',    dot: 'bg-red-400',   label: 'Rejected' },
  RESCHEDULED: { bg: 'bg-brand-50',  text: 'text-brand-700',  dot: 'bg-brand-400', label: 'Rescheduled' },
  CANCELLED:   { bg: 'bg-slate-50',  text: 'text-slate-500',  dot: 'bg-slate-400', label: 'Cancelled' },
}

function StatusDot({ status }) {
  const s = STATUS[status] ?? STATUS.PENDING
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold ${s.bg} ${s.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
      {s.label}
    </span>
  )
}

function shortDate(iso) {
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
}

function personName(u) {
  if (u?.name && u.name.trim()) return u.name
  if (u?.email) {
    const local = u.email.split('@')[0]
    return local.charAt(0).toUpperCase() + local.slice(1)
  }
  return 'User'
}

function personInitial(u) {
  return personName(u)[0]?.toUpperCase() ?? 'U'
}

// ── Filters ─────────────────────────────────────────────────────────
const OWNER_FILTERS = [
  { key: 'all',      label: 'All' },
  { key: 'PENDING',  label: 'Pending' },
  { key: 'ACCEPTED', label: 'Accepted' },
  { key: 'REJECTED', label: 'Rejected' },
]

// ── Empty ───────────────────────────────────────────────────────────
function EmptyState({ title = 'No appointments', message }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center text-slate-500 mb-3">
        <Calendar size={20} strokeWidth={1.8} />
      </div>
      <p className="text-sm font-semibold text-slate-700 mb-0.5">{title}</p>
      <p className="text-xs text-slate-500 max-w-[240px]">{message}</p>
    </div>
  )
}

// ── Owner card (incoming requests) ──────────────────────────────────
function OwnerCard({ appt, onAction }) {
  const [rejecting, setRejecting] = useState(false)
  const [note, setNote] = useState('')
  const isPending = appt.status === 'PENDING'
  const thumb = appt.property?.images?.[0]?.url

  return (
    <div className="bg-white rounded-xl border border-slate-100 p-4 hover:border-slate-200 transition-colors">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2.5 min-w-0">
          {appt.tenant?.avatarUrl ? (
            <img src={appt.tenant.avatarUrl} alt="" className="w-8 h-8 rounded-full object-cover shrink-0" />
          ) : (
            <div className="w-8 h-8 rounded-full bg-slate-800 text-white text-xs font-bold flex items-center justify-center shrink-0">
              {personInitial(appt.tenant)}
            </div>
          )}
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-800 truncate">{personName(appt.tenant)}</p>
            <p className="text-[11px] text-slate-500">{appt.contactNumber}</p>
          </div>
        </div>
        <StatusDot status={appt.status} />
      </div>

      <div className="flex items-center gap-3 bg-slate-50 rounded-lg px-3 py-2.5 mb-3">
        {thumb ? (
          <img src={thumb} alt="" className="w-9 h-9 rounded-lg object-cover shrink-0" />
        ) : (
          <div className="w-9 h-9 rounded-lg bg-slate-200 shrink-0" />
        )}
        <div className="min-w-0 flex-1">
          <Link to={`/property/${appt.property?.id}`} className="text-xs font-semibold text-slate-700 hover:text-brand-600 no-underline truncate block">
            {appt.property?.title ?? 'Property'}
          </Link>
          {appt.property?.displayId && (
            <p className="text-[11px] font-mono text-slate-500 tracking-wide">{appt.property.displayId}</p>
          )}
          <p className="text-[11px] text-slate-500">{appt.property?.city}</p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-xs font-semibold text-slate-700">{shortDate(appt.requestedDate)}</p>
          <p className="text-[11px] text-slate-500">{formatTime(appt.requestedTime)}</p>
        </div>
      </div>

      {appt.message && (
        <p className="text-xs text-slate-500 mb-3 leading-relaxed">
          <span className="font-medium text-slate-500">Note: </span>{appt.message}
        </p>
      )}

      {appt.ownerNote && (
        <p className="text-xs text-blue-600 mb-3 leading-relaxed">
          <span className="font-medium text-blue-400">Your reply: </span>{appt.ownerNote}
        </p>
      )}

      {isPending && !rejecting && (
        <div className="flex gap-2">
          <button onClick={() => onAction(appt.id, 'ACCEPTED')} className="flex-1 min-h-[44px] py-3 rounded-lg text-xs font-semibold text-white hover:opacity-90 transition-colors" style={{ background: '#111111' }}>
            Accept
          </button>
          <button onClick={() => setRejecting(true)} className="flex-1 min-h-[44px] py-3 rounded-lg bg-red-50 text-xs font-semibold text-red-600 hover:bg-red-100 transition-colors">
            Reject
          </button>
        </div>
      )}

      {isPending && rejecting && (
        <div className="space-y-2">
          <textarea rows={2} placeholder="Reason (optional)" value={note} onChange={(e) => setNote(e.target.value)} className="min-h-[44px] w-full border border-slate-200 rounded-lg px-3 py-3 text-xs focus:outline-none focus:ring-2 focus:ring-red-300 resize-none" />
          <div className="flex gap-2">
            <button onClick={() => { setRejecting(false); setNote('') }} className="flex-1 min-h-[44px] py-3 rounded-lg bg-slate-100 text-xs font-semibold text-slate-600 hover:bg-slate-200 transition-colors">Cancel</button>
            <button onClick={() => onAction(appt.id, 'REJECTED', note || undefined)} className="flex-1 min-h-[44px] py-3 rounded-lg bg-red-600 text-xs font-semibold text-white hover:bg-red-700 transition-colors">Confirm</button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Tenant card (my requests — read-only) ───────────────────────────
function TenantCard({ appt, onCancel }) {
  const thumb = appt.property?.images?.[0]?.url
  // A request you've made and can't withdraw is a dead end — the renter's only
  // route out used to be messaging the owner and hoping. CANCELLED was already
  // a valid status; nothing could set it.
  const cancellable = ['PENDING', 'ACCEPTED', 'RESCHEDULED'].includes(appt.status)

  return (
    <div className="bg-white rounded-xl border border-slate-100 p-4 hover:border-slate-200 transition-colors">
      <div className="flex items-center gap-3 mb-3">
        {thumb ? (
          <img src={thumb} alt="" className="w-10 h-10 rounded-lg object-cover shrink-0" />
        ) : (
          <div className="w-10 h-10 rounded-lg bg-slate-200 shrink-0" />
        )}
        <div className="min-w-0 flex-1">
          <Link to={`/property/${appt.property?.id}`} className="text-sm font-semibold text-slate-800 hover:text-brand-600 no-underline truncate block">
            {appt.property?.title ?? 'Property'}
          </Link>
          {appt.property?.displayId && (
            <p className="text-[11px] font-mono text-slate-500 tracking-wide">{appt.property.displayId}</p>
          )}
          <p className="text-[11px] text-slate-500">{appt.property?.city}</p>
        </div>
        <StatusDot status={appt.status} />
      </div>

      <div className="flex items-center gap-4 text-xs text-slate-500 mb-2">
        <span>{shortDate(appt.requestedDate)}</span>
        <span>{formatTime(appt.requestedTime)}</span>
      </div>

      {appt.message && (
        <p className="text-xs text-slate-500 mb-2 leading-relaxed">
          <span className="font-medium text-slate-500">Your note: </span>{appt.message}
        </p>
      )}

      {appt.ownerNote && (
        <p className="text-xs text-blue-600 leading-relaxed">
          <span className="font-medium text-blue-400">Owner reply: </span>{appt.ownerNote}
        </p>
      )}

      {cancellable && (
        <button
          onClick={() => onCancel(appt)}
          className="mt-3 w-full min-h-[44px] py-3 rounded-lg bg-slate-50 text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
        >
          Cancel this visit
        </button>
      )}
    </div>
  )
}

// ── Main ────────────────────────────────────────────────────────────
// The view follows the renter/host mode toggle, not the user's role:
//  · host mode   → incoming requests for my properties (owner view)
//  · renter mode → my own visit requests (tenant view)
// A user who is both flips modes to see the other side, matching the rest
// of the app's mode-based navigation. Only the relevant list is fetched.
export default function AppointmentManager() {
  const hostMode = useUiStore((s) => s.hostMode)
  const [filter, setFilter] = useState('all')
  const qc = useQueryClient()

  const { data: ownerAppts = [], isLoading: loadingOwner } = useQuery({
    queryKey: ['owner-appointments'],
    queryFn: () => appointmentService.owner().then(r => r.data),
    enabled: hostMode,
  })

  const { data: myAppts = [], isLoading: loadingMine } = useQuery({
    queryKey: ['my-appointments'],
    queryFn: () => appointmentService.mine().then(r => r.data),
    enabled: !hostMode,
  })

  const mutation = useMutation({
    mutationFn: ({ id, status, ownerNote }) => appointmentService.updateStatus(id, { status, ownerNote }),
    onSuccess: (_, { status }) => {
      // Both lists: the owner acts on incoming requests, the renter cancels
      // their own, and only one of the two is mounted at a time.
      qc.invalidateQueries({ queryKey: ['owner-appointments'] })
      qc.invalidateQueries({ queryKey: ['my-appointments'] })
      toast.success('Updated', `Appointment ${status.toLowerCase()}`)
    },
    onError: (err) => {
      toast.error('Error', err?.message || 'Failed to update')
    },
  })

  const handleAction = (id, status, ownerNote) => mutation.mutate({ id, status, ownerNote })

  async function handleCancel(appt) {
    const ok = await confirm({
      title: 'Cancel this visit?',
      message: `Your visit to ${appt.property?.title ?? 'this property'} on ${shortDate(appt.requestedDate)} at ${formatTime(appt.requestedTime)} will be called off, and the owner will be told. You can request another time afterwards.`,
      confirmLabel: 'Cancel visit',
      cancelLabel: 'Keep it',
    })
    if (ok) mutation.mutate({ id: appt.id, status: 'CANCELLED' })
  }

  const isLoading = hostMode ? loadingOwner : loadingMine
  const filteredOwner = filter === 'all' ? ownerAppts : ownerAppts.filter(a => a.status === filter)

  if (isLoading) {
    return (
      <div className="space-y-4">
        <h1 className="text-xl font-bold text-slate-900">Appointments</h1>
        <div className="flex items-center justify-center py-20">
          <div className="w-5 h-5 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin" />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-slate-900">Appointments</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          {hostMode ? 'Visit requests for your properties' : 'Visits you’ve requested'}
        </p>
      </div>

      {/* ── Host mode: incoming requests (owner view) ──────────────── */}
      {hostMode ? (
        <>
          <div className="flex gap-1">
            {OWNER_FILTERS.map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setFilter(key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  filter === key ? 'bg-[#111111] text-white' : 'text-slate-500 hover:bg-slate-100'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {filteredOwner.length === 0 ? (
            <EmptyState
              title={filter === 'all' ? 'No visit requests yet' : 'No matching requests'}
              message={filter === 'all'
                ? 'When someone books a viewing of your listings, their request will appear here.'
                : `You have no ${filter.toLowerCase()} requests.`}
            />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {filteredOwner.map(appt => (
                <OwnerCard key={appt.id} appt={appt} onAction={handleAction} />
              ))}
            </div>
          )}
        </>
      ) : (
        /* ── Renter mode: my own visit requests (tenant view) ─────── */
        myAppts.length === 0 ? (
          <EmptyState
            title="No visits booked yet"
            message="Book a viewing from any property and you'll be able to track it here."
          />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {myAppts.map(appt => (
              <TenantCard key={appt.id} appt={appt} onCancel={handleCancel} />
            ))}
          </div>
        )
      )}
    </div>
  )
}
