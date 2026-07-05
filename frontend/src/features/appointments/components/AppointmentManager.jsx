import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Calendar } from 'lucide-react'
import { appointmentService } from '@services/appointment.service'
import { toast } from '@components/common/Toaster'

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
function EmptyState({ message }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center text-slate-400 mb-3">
        <Calendar size={20} strokeWidth={1.8} />
      </div>
      <p className="text-sm font-semibold text-slate-700 mb-0.5">No appointments</p>
      <p className="text-xs text-slate-400 max-w-[240px]">{message}</p>
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
            <p className="text-[11px] text-slate-400">{appt.contactNumber}</p>
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
            <p className="text-[9px] font-mono text-slate-400 tracking-wide">{appt.property.displayId}</p>
          )}
          <p className="text-[11px] text-slate-400">{appt.property?.city}</p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-xs font-semibold text-slate-700">{shortDate(appt.requestedDate)}</p>
          <p className="text-[11px] text-slate-400">{appt.requestedTime}</p>
        </div>
      </div>

      {appt.message && (
        <p className="text-xs text-slate-500 mb-3 leading-relaxed">
          <span className="font-medium text-slate-400">Note: </span>{appt.message}
        </p>
      )}

      {appt.ownerNote && (
        <p className="text-xs text-blue-600 mb-3 leading-relaxed">
          <span className="font-medium text-blue-400">Your reply: </span>{appt.ownerNote}
        </p>
      )}

      {isPending && !rejecting && (
        <div className="flex gap-2">
          <button onClick={() => onAction(appt.id, 'ACCEPTED')} className="flex-1 py-2 rounded-lg text-xs font-semibold text-white hover:opacity-90 transition-colors" style={{ background: '#111111' }}>
            Accept
          </button>
          <button onClick={() => setRejecting(true)} className="flex-1 py-2 rounded-lg bg-red-50 text-xs font-semibold text-red-600 hover:bg-red-100 transition-colors">
            Reject
          </button>
        </div>
      )}

      {isPending && rejecting && (
        <div className="space-y-2">
          <textarea rows={2} placeholder="Reason (optional)" value={note} onChange={(e) => setNote(e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-red-300 resize-none" />
          <div className="flex gap-2">
            <button onClick={() => { setRejecting(false); setNote('') }} className="flex-1 py-2 rounded-lg bg-slate-100 text-xs font-semibold text-slate-600 hover:bg-slate-200 transition-colors">Cancel</button>
            <button onClick={() => onAction(appt.id, 'REJECTED', note || undefined)} className="flex-1 py-2 rounded-lg bg-red-600 text-xs font-semibold text-white hover:bg-red-700 transition-colors">Confirm</button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Tenant card (my requests — read-only) ───────────────────────────
function TenantCard({ appt }) {
  const thumb = appt.property?.images?.[0]?.url

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
            <p className="text-[9px] font-mono text-slate-400 tracking-wide">{appt.property.displayId}</p>
          )}
          <p className="text-[11px] text-slate-400">{appt.property?.city}</p>
        </div>
        <StatusDot status={appt.status} />
      </div>

      <div className="flex items-center gap-4 text-xs text-slate-500 mb-2">
        <span>{shortDate(appt.requestedDate)}</span>
        <span>{appt.requestedTime}</span>
      </div>

      {appt.message && (
        <p className="text-xs text-slate-500 mb-2 leading-relaxed">
          <span className="font-medium text-slate-400">Your note: </span>{appt.message}
        </p>
      )}

      {appt.ownerNote && (
        <p className="text-xs text-blue-600 leading-relaxed">
          <span className="font-medium text-blue-400">Owner reply: </span>{appt.ownerNote}
        </p>
      )}
    </div>
  )
}

// ── Main ────────────────────────────────────────────────────────────
export default function AppointmentManager({ isOwner = false }) {
  const [tab, setTab] = useState(isOwner ? 'incoming' : 'my-requests')
  const [filter, setFilter] = useState('all')
  const qc = useQueryClient()

  const { data: ownerAppts = [], isLoading: loadingOwner } = useQuery({
    queryKey: ['owner-appointments'],
    queryFn: () => appointmentService.owner().then(r => r.data),
  })

  const { data: myAppts = [], isLoading: loadingMine } = useQuery({
    queryKey: ['my-appointments'],
    queryFn: () => appointmentService.mine().then(r => r.data),
  })

  const mutation = useMutation({
    mutationFn: ({ id, status, ownerNote }) => appointmentService.updateStatus(id, { status, ownerNote }),
    onSuccess: (_, { status }) => {
      qc.invalidateQueries({ queryKey: ['owner-appointments'] })
      toast.success('Updated', `Appointment ${status.toLowerCase()}`)
    },
    onError: (err) => {
      toast.error('Error', err?.message || 'Failed to update')
    },
  })

  const handleAction = (id, status, ownerNote) => mutation.mutate({ id, status, ownerNote })

  const isLoading = loadingOwner || loadingMine
  const pendingCount = ownerAppts.filter(a => a.status === 'PENDING').length
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
        <p className="text-sm text-slate-400 mt-0.5">Manage incoming requests and track your visits</p>
      </div>

      {/* Tab toggle: Incoming vs My Requests (Incoming only visible for owners) */}
      {isOwner && (
        <div className="flex gap-1 bg-slate-100 rounded-lg p-1 w-fit">
          <button
            onClick={() => setTab('incoming')}
            className={`px-4 py-1.5 rounded-md text-xs font-semibold transition-colors ${
              tab === 'incoming' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500'
            }`}
          >
            Incoming
            {pendingCount > 0 && (
              <span className="ml-1.5 inline-flex items-center justify-center w-4 h-4 rounded-full bg-amber-100 text-amber-700 text-[9px] font-bold">
                {pendingCount}
              </span>
            )}
          </button>
          <button
            onClick={() => setTab('my-requests')}
            className={`px-4 py-1.5 rounded-md text-xs font-semibold transition-colors ${
              tab === 'my-requests' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500'
            }`}
          >
            My Requests
            {myAppts.length > 0 && (
              <span className="ml-1.5 inline-flex items-center justify-center w-4 h-4 rounded-full bg-slate-200 text-slate-600 text-[9px] font-bold">
                {myAppts.length}
              </span>
            )}
          </button>
        </div>
      )}

      {/* ── Incoming tab (owner view) ──────────────────────────────── */}
      {tab === 'incoming' && (
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
            <EmptyState message={filter === 'all' ? 'Tenant visit requests will appear here.' : `No ${filter.toLowerCase()} appointments.`} />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {filteredOwner.map(appt => (
                <OwnerCard key={appt.id} appt={appt} onAction={handleAction} />
              ))}
            </div>
          )}
        </>
      )}

      {/* ── My Requests tab (tenant view) ──────────────────────────── */}
      {tab === 'my-requests' && (
        myAppts.length === 0 ? (
          <EmptyState message="Appointments you've requested will appear here." />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {myAppts.map(appt => (
              <TenantCard key={appt.id} appt={appt} />
            ))}
          </div>
        )
      )}
    </div>
  )
}
