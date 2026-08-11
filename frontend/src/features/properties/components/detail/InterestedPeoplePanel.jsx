import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Calendar, Users, Loader2, MessageCircle, Phone, ChevronDown, KeyRound } from 'lucide-react'
import { appointmentService } from '@services/appointment.service'
import { propertyService } from '@services/property.service'
import { chatService } from '@services/chat.service'
import { toast } from '@components/common/Toaster'
import { confirm } from '@components/common/ConfirmDialog'
import { formatTime } from '@utils/time'

// ── Interested People (owner view, property page sidebar) ───────────────────
//
// Same row grammar as the mark-tenant picker (2026-08-12, operator request):
// collapsed = person + status + a CHEVRON that says there is more; expanded =
// when they asked, their note, then the actions — phone icon, chat icon,
// Mark as renter. No email anywhere: an address in a list is a thing worth
// not showing, and nothing here needs to send one.
const STATUS_STYLE = {
  PENDING:     { label: 'Pending',     bg: 'bg-amber-50',   text: 'text-amber-700',   dot: 'bg-amber-400' },
  ACCEPTED:    { label: 'Accepted',    bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500' },
  REJECTED:    { label: 'Rejected',    bg: 'bg-red-50',     text: 'text-red-600',     dot: 'bg-red-400' },
  RESCHEDULED: { label: 'Rescheduled', bg: 'bg-blue-50',    text: 'text-blue-700',    dot: 'bg-blue-400' },
  RESCHEDULE_REQUESTED: { label: 'New time proposed', bg: 'bg-amber-50', text: 'text-amber-700', dot: 'bg-amber-400' },
  CANCELLED:   { label: 'Cancelled',   bg: 'bg-slate-100',  text: 'text-slate-500',   dot: 'bg-slate-400' },
}

export default function InterestedPeoplePanel({ propertyId, property }) {
  const [expandedId, setExpandedId] = useState(null)
  const [chattingId, setChattingId] = useState(null)
  const navigate = useNavigate()
  const qc = useQueryClient()

  const { data: appointments = [], isLoading } = useQuery({
    queryKey: ['property-appointments', propertyId],
    queryFn: () => appointmentService.forProperty(propertyId).then(r => r.data),
  })

  // Marking is only possible while the listing is ACTIVE — the server 400s
  // otherwise, and a button that can only be refused should not render
  // (the SMS sign-in rule).
  const canMark = property?.status === 'ACTIVE'

  const markTenant = useMutation({
    mutationFn: (tenantId) => propertyService.markTenant(propertyId, tenantId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['property', propertyId] })
      qc.invalidateQueries({ queryKey: ['my-listings'] })
      toast.success('Marked as renter', 'The listing is now Occupied and off the public map. They’ll be asked to confirm the tenancy.')
    },
    onError: (err) => toast.error('Couldn’t mark as renter', err?.message),
  })

  async function handleMark(tenant) {
    const ok = await confirm({
      title: `Mark ${tenant.name ?? 'this person'} as the renter?`,
      message: 'The listing is set to Occupied and comes off the public map. You can mark it vacant later to relist it.',
      confirmLabel: 'Mark as renter',
      variant: 'warning',
    })
    if (ok) markTenant.mutate(tenant.id)
  }

  if (isLoading) {
    return (
      <div className="space-y-3 animate-pulse">
        {[1, 2, 3].map(i => (
          <div key={i} className="flex items-center gap-3 p-3">
            <div className="w-10 h-10 rounded-full bg-slate-200" />
            <div className="flex-1 space-y-1.5">
              <div className="h-3.5 w-28 bg-slate-200 rounded" />
              <div className="h-3 w-20 bg-slate-100 rounded" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (!appointments.length) {
    return (
      <div className="text-center py-8">
        <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-3">
          <Users className="w-5 h-5 text-slate-500" />
        </div>
        <p className="text-sm font-medium text-slate-600">No interest yet</p>
        <p className="text-xs text-slate-500 mt-1">People who request visits will appear here.</p>
      </div>
    )
  }

  return (
    <div className="space-y-1">
      {appointments.map(apt => {
        const tenant = apt.tenant ?? {}
        const initial = tenant.name?.[0]?.toUpperCase() ?? '?'
        const displayName = tenant.name ?? 'Member'
        const isOpen = expandedId === apt.id
        const st = STATUS_STYLE[apt.status] ?? STATUS_STYLE.PENDING
        const date = new Date(apt.requestedDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })

        return (
          <div key={apt.id} className="rounded-xl border border-slate-100 overflow-hidden">
            {/* The whole collapsed row is the toggle. */}
            <button
              onClick={() => setExpandedId(isOpen ? null : apt.id)}
              aria-expanded={isOpen}
              className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-slate-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
            >
              {tenant.avatarUrl ? (
                <img src={tenant.avatarUrl} alt="" className="w-10 h-10 rounded-full object-cover shrink-0" />
              ) : (
                <div className="w-10 h-10 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center text-sm font-bold shrink-0">
                  {initial}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-800 truncate">{displayName}</p>
                <div className={`inline-flex items-center gap-1 mt-0.5 px-1.5 py-0.5 rounded-full ${st.bg}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${st.dot}`} aria-hidden="true" />
                  <span className={`text-[11px] font-semibold ${st.text}`}>{st.label}</span>
                </div>
              </div>
              <ChevronDown
                size={16}
                aria-hidden="true"
                className={`shrink-0 text-slate-500 transition-transform ${isOpen ? 'rotate-180' : ''}`}
              />
            </button>

            {isOpen && (
              <div className="px-4 pb-4 pt-1 border-t border-slate-50 space-y-3">
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <Calendar className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Requested for {date} at {formatTime(apt.requestedTime)}</span>
                </div>

                {apt.message && (
                  <div className="bg-slate-50 rounded-xl px-3 py-2.5">
                    <p className="text-sm text-slate-600 leading-relaxed">{apt.message}</p>
                  </div>
                )}

                <div className="flex items-center gap-2">
                  {/* The visit's own number — given by the renter for this
                      visit. Absent → no button, never a disabled one. */}
                  {apt.contactNumber && (
                    <a
                      href={`tel:${apt.contactNumber}`}
                      aria-label={`Call ${displayName}`}
                      className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 text-slate-600 hover:border-brand-500 hover:text-brand-700 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
                    >
                      <Phone size={16} aria-hidden="true" />
                    </a>
                  )}
                  <button
                    onClick={async () => {
                      if (!tenant.id) return
                      setChattingId(apt.id)
                      try {
                        await chatService.startWithTenant(propertyId, tenant.id)
                        navigate('/user?tab=messages')
                      } catch {
                        toast.error('Couldn’t open the chat', 'Please try again in a moment.')
                      } finally {
                        setChattingId(null)
                      }
                    }}
                    disabled={chattingId === apt.id}
                    aria-label={`Chat with ${displayName}`}
                    className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 text-slate-600 hover:border-brand-500 hover:text-brand-700 transition-colors disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
                  >
                    {chattingId === apt.id
                      ? <Loader2 size={16} className="animate-spin" aria-hidden="true" />
                      : <MessageCircle size={16} aria-hidden="true" />}
                  </button>
                  {canMark && tenant.id && (
                    <button
                      onClick={() => handleMark(tenant)}
                      disabled={markTenant.isPending}
                      className="ml-auto inline-flex items-center gap-1.5 min-h-[40px] px-4 rounded-xl bg-[#111111] text-white text-sm font-semibold hover:bg-[#2a2a2a] transition-colors disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <KeyRound size={14} aria-hidden="true" />
                      {markTenant.isPending ? 'Marking…' : 'Mark as renter'}
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
