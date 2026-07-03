import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { leaseService } from '@services/lease.service'
import { useAuth } from '@features/auth/hooks/useAuth'
import { authService } from '@services/auth.service'
import { toast } from '@components/common/Toaster'
import Modal from '@components/common/Modal'
import { formatCurrency } from '@utils/format'

const STATUS_CFG = {
  OFFERED:    { label: 'Awaiting signature', bg: 'bg-yellow-50', text: 'text-yellow-700', dot: 'bg-yellow-400' },
  ACTIVE:     { label: 'Active',             bg: 'bg-green-50',  text: 'text-green-700',  dot: 'bg-green-500' },
  REJECTED:   { label: 'Rejected',           bg: 'bg-red-50',    text: 'text-red-600',    dot: 'bg-red-400' },
  TERMINATED: { label: 'Terminated',         bg: 'bg-slate-100', text: 'text-slate-500',  dot: 'bg-slate-400' },
  EXPIRED:    { label: 'Expired',            bg: 'bg-slate-100', text: 'text-slate-400',  dot: 'bg-slate-300' },
}

function StatusPill({ status }) {
  const cfg = STATUS_CFG[status] ?? STATUS_CFG.OFFERED
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${cfg.bg} ${cfg.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  )
}

function formatDate(d) {
  return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

// ── Create lease form ────────────────────────────────────────────────────────
export function CreateLeaseModal({ propertyId, propertyTitle, isOpen, onClose }) {
  const qc = useQueryClient()
  const today = new Date().toISOString().slice(0, 10)
  const [form, setForm] = useState({
    tenantId: '', startDate: today, endDate: '', rentAmount: '', depositAmount: '', ownerNote: '',
  })
  const [err, setErr] = useState('')

  const { mutate, isPending } = useMutation({
    mutationFn: () => leaseService.createLease(propertyId, {
      ...form,
      startDate:     new Date(form.startDate).toISOString(),
      endDate:       new Date(form.endDate).toISOString(),
      rentAmount:    Number(form.rentAmount),
      depositAmount: Number(form.depositAmount),
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['leases'] })
      toast.success('Lease offered', 'The tenant has been notified.')
      onClose()
    },
    onError: (e) => setErr(e?.message ?? 'Failed to create lease'),
  })

  function handleSubmit(e) {
    e.preventDefault()
    setErr('')
    if (!form.tenantId.trim()) { setErr('Tenant ID is required'); return }
    if (!form.startDate || !form.endDate) { setErr('Start and end dates are required'); return }
    if (new Date(form.endDate) <= new Date(form.startDate)) { setErr('End date must be after start date'); return }
    if (!form.rentAmount || Number(form.rentAmount) <= 0) { setErr('Rent amount must be positive'); return }
    if (!form.depositAmount || Number(form.depositAmount) <= 0) { setErr('Deposit must be positive'); return }
    mutate()
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Offer Lease — ${propertyTitle}`}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {err && <div className="p-3 bg-red-50 border border-red-100 rounded-xl text-sm text-red-600">{err}</div>}

        <div>
          <label className="block text-xs font-semibold text-slate-500 mb-1.5">Tenant User ID</label>
          <input
            type="text"
            value={form.tenantId}
            onChange={e => setForm(f => ({ ...f, tenantId: e.target.value }))}
            placeholder="Paste tenant's user ID"
            className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30"
          />
          <p className="text-[11px] text-slate-400 mt-1">Find the tenant ID in their appointment details</p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1.5">Start date</label>
            <input type="date" value={form.startDate} onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))}
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1.5">End date</label>
            <input type="date" value={form.endDate} onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))}
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1.5">Monthly rent (₹)</label>
            <input type="number" min="1" value={form.rentAmount} onChange={e => setForm(f => ({ ...f, rentAmount: e.target.value }))}
              placeholder="28000"
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1.5">Deposit (₹)</label>
            <input type="number" min="1" value={form.depositAmount} onChange={e => setForm(f => ({ ...f, depositAmount: e.target.value }))}
              placeholder="56000"
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30" />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-500 mb-1.5">Note to tenant <span className="font-normal">(optional)</span></label>
          <textarea value={form.ownerNote} onChange={e => setForm(f => ({ ...f, ownerNote: e.target.value }))}
            rows={2} placeholder="Any specific terms or notes..."
            className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30 resize-none" />
        </div>

        <button type="submit" disabled={isPending}
          className="w-full py-2.5 bg-[#111111] text-white text-sm font-semibold rounded-xl hover:opacity-90 disabled:opacity-50 transition-opacity">
          {isPending ? 'Sending…' : 'Send lease offer'}
        </button>
      </form>
    </Modal>
  )
}

// ── Lease card ───────────────────────────────────────────────────────────────
function LeaseCard({ lease, currentUserId }) {
  const qc = useQueryClient()
  const [note, setNote] = useState('')
  const [showConfirm, setShowConfirm] = useState(null) // 'sign' | 'reject' | 'terminate'

  const iAmOwner  = lease.ownerId === currentUserId
  const iAmTenant = lease.tenantId === currentUserId
  const other     = iAmOwner ? lease.tenant : lease.owner
  const otherRole = iAmOwner ? 'Tenant' : 'Owner'

  const { mutate: doAction, isPending } = useMutation({
    mutationFn: (action) => {
      if (action === 'sign')      return leaseService.sign(lease.id, { tenantNote: note })
      if (action === 'reject')    return leaseService.reject(lease.id, { tenantNote: note })
      if (action === 'terminate') return leaseService.terminate(lease.id, { ownerNote: note })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['leases'] })
      setShowConfirm(null)
      toast.success('Done', 'Lease updated successfully')
    },
    onError: (e) => toast.error('Error', e?.message ?? 'Failed to update lease'),
  })

  const months = Math.round((new Date(lease.endDate) - new Date(lease.startDate)) / (1000 * 60 * 60 * 24 * 30))

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-bold text-slate-900 truncate">{lease.property?.title}</p>
          <p className="text-xs text-slate-400 mt-0.5">{lease.property?.city}</p>
        </div>
        <StatusPill status={lease.status} />
      </div>

      {/* Details */}
      <div className="px-5 pb-4 grid grid-cols-2 sm:grid-cols-4 gap-4 border-b border-slate-50">
        <div>
          <p className="text-[11px] text-slate-400 mb-0.5">Rent</p>
          <p className="text-sm font-bold text-brand-700">{formatCurrency(Number(lease.rentAmount))}/mo</p>
        </div>
        <div>
          <p className="text-[11px] text-slate-400 mb-0.5">Deposit</p>
          <p className="text-sm font-semibold text-slate-700">{formatCurrency(Number(lease.depositAmount))}</p>
        </div>
        <div>
          <p className="text-[11px] text-slate-400 mb-0.5">Duration</p>
          <p className="text-sm font-semibold text-slate-700">{months} month{months !== 1 ? 's' : ''}</p>
        </div>
        <div>
          <p className="text-[11px] text-slate-400 mb-0.5">{otherRole}</p>
          <p className="text-sm font-semibold text-slate-700 truncate">{other?.name ?? '—'}</p>
        </div>
      </div>

      {/* Dates */}
      <div className="px-5 py-3 flex items-center gap-6 text-xs text-slate-500 border-b border-slate-50">
        <span><span className="font-semibold">From:</span> {formatDate(lease.startDate)}</span>
        <span><span className="font-semibold">To:</span> {formatDate(lease.endDate)}</span>
        {lease.signedAt && <span className="text-green-600"><span className="font-semibold">Signed:</span> {formatDate(lease.signedAt)}</span>}
      </div>

      {/* Notes */}
      {(lease.ownerNote || lease.tenantNote) && (
        <div className="px-5 py-3 space-y-1 border-b border-slate-50">
          {lease.ownerNote && <p className="text-xs text-slate-500"><span className="font-semibold">Owner note:</span> {lease.ownerNote}</p>}
          {lease.tenantNote && <p className="text-xs text-slate-500"><span className="font-semibold">Tenant note:</span> {lease.tenantNote}</p>}
        </div>
      )}

      {/* Actions */}
      {showConfirm ? (
        <div className="px-5 py-4 space-y-3 bg-slate-50">
          <textarea
            rows={2}
            value={note}
            onChange={e => setNote(e.target.value)}
            placeholder={showConfirm === 'sign' ? 'Optional note…' : 'Reason (optional)…'}
            className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30 resize-none bg-white"
          />
          <div className="flex gap-2">
            <button onClick={() => doAction(showConfirm)} disabled={isPending}
              className={`flex-1 py-2 text-sm font-semibold rounded-xl text-white transition-opacity disabled:opacity-50 ${showConfirm === 'sign' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-500 hover:bg-red-600'}`}>
              {isPending ? 'Processing…' : showConfirm === 'sign' ? 'Confirm & sign' : showConfirm === 'reject' ? 'Confirm rejection' : 'Confirm termination'}
            </button>
            <button onClick={() => setShowConfirm(null)}
              className="px-4 py-2 text-sm font-semibold rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 transition-colors">
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="px-5 py-3 flex gap-2">
          {iAmTenant && lease.status === 'OFFERED' && (
            <>
              <button onClick={() => setShowConfirm('sign')}
                className="flex-1 py-2 text-sm font-semibold text-white bg-green-600 hover:bg-green-700 rounded-xl transition-colors">
                Sign lease
              </button>
              <button onClick={() => setShowConfirm('reject')}
                className="flex-1 py-2 text-sm font-semibold text-red-600 border border-red-200 hover:bg-red-50 rounded-xl transition-colors">
                Reject
              </button>
            </>
          )}
          {iAmOwner && lease.status === 'ACTIVE' && (
            <button onClick={() => setShowConfirm('terminate')}
              className="py-2 px-4 text-sm font-semibold text-red-600 border border-red-200 hover:bg-red-50 rounded-xl transition-colors">
              Terminate
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// ── Main ─────────────────────────────────────────────────────────────────────
export default function LeaseManager() {
  const { user } = useAuth()

  const { data: profile } = useQuery({
    queryKey: ['me'],
    queryFn: () => authService.getMe().then(r => r.data),
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
  })
  const isOwner = profile?.role === 'OWNER'

  const { data, isLoading } = useQuery({
    queryKey: ['leases'],
    queryFn: () => leaseService.getMyLeases().then(r => r.data),
    enabled: !!user,
  })

  const asOwner  = data?.asOwner  ?? []
  const asTenant = data?.asTenant ?? []

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2].map(i => <div key={i} className="h-40 bg-slate-100 animate-pulse rounded-2xl" />)}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Leases</h1>
          <p className="text-sm text-slate-400 mt-0.5">Manage rental agreements</p>
        </div>
      </div>

      {isOwner && asOwner.length > 0 && (
        <section className="space-y-3">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">Leases you&apos;ve offered</p>
          {asOwner.map(l => (
            <LeaseCard key={l.id} lease={l} currentUserId={user?.id} />
          ))}
        </section>
      )}

      {asTenant.length > 0 && (
        <section className="space-y-3">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">Your lease agreements</p>
          {asTenant.map(l => (
            <LeaseCard key={l.id} lease={l} currentUserId={user?.id} />
          ))}
        </section>
      )}

      {asOwner.length === 0 && asTenant.length === 0 && (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
            <svg className="w-6 h-6 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <p className="text-sm font-semibold text-slate-600 mb-1">No leases yet</p>
          <p className="text-xs text-slate-400 max-w-xs">
            {isOwner
              ? 'Once an appointment is accepted, create a lease offer from your Listings page.'
              : 'Your owner will send a lease offer after your appointment is confirmed.'}
          </p>
        </div>
      )}
    </div>
  )
}
