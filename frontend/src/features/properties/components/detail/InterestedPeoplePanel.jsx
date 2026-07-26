import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Calendar, Users, Loader2, MessageSquare, Phone, Mail } from 'lucide-react'
import { appointmentService } from '@services/appointment.service'
import { chatService } from '@services/chat.service'
import { toast } from '@components/common/Toaster'
import { formatTime } from '@utils/time'

// ── Interested People (owner view) ───────────────────────────────────────────
const STATUS_STYLE = {
  PENDING:     { label: 'Pending',     bg: 'bg-amber-50',   text: 'text-amber-700',   dot: 'bg-amber-400' },
  ACCEPTED:    { label: 'Accepted',    bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500' },
  REJECTED:    { label: 'Rejected',    bg: 'bg-red-50',     text: 'text-red-600',     dot: 'bg-red-400' },
  RESCHEDULED: { label: 'Rescheduled', bg: 'bg-blue-50',    text: 'text-blue-700',    dot: 'bg-blue-400' },
  CANCELLED:   { label: 'Cancelled',   bg: 'bg-slate-100',  text: 'text-slate-500',   dot: 'bg-slate-400' },
}

export default function InterestedPeoplePanel({ propertyId }) {
  const [expandedId, setExpandedId] = useState(null)
  const [chattingId, setChattingId] = useState(null)
  const navigate = useNavigate()

  const { data: appointments = [], isLoading } = useQuery({
    queryKey: ['property-appointments', propertyId],
    queryFn: () => appointmentService.forProperty(propertyId).then(r => r.data),
  })

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
        const initial = tenant.name?.[0]?.toUpperCase() ?? tenant.email?.[0]?.toUpperCase() ?? '?'
        const displayName = tenant.name ?? tenant.email ?? 'Unknown'
        const isOpen = expandedId === apt.id
        const st = STATUS_STYLE[apt.status] ?? STATUS_STYLE.PENDING
        const date = new Date(apt.requestedDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })

        return (
          <div key={apt.id} className="rounded-xl border border-slate-100 overflow-hidden">
            {/* Row: avatar + name + chat icon */}
            <div className="flex items-center gap-3 px-4 py-3">
              {/* Avatar — click to expand */}
              <button onClick={() => setExpandedId(isOpen ? null : apt.id)} className="shrink-0">
                {tenant.avatarUrl ? (
                  <img src={tenant.avatarUrl} alt="" className="w-10 h-10 rounded-full object-cover" />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center text-sm font-bold">
                    {initial}
                  </div>
                )}
              </button>

              {/* Name + status — click to expand */}
              <button onClick={() => setExpandedId(isOpen ? null : apt.id)} className="flex-1 min-w-0 text-left">
                <p className="text-sm font-semibold text-slate-800 truncate">{displayName}</p>
                <div className={`inline-flex items-center gap-1 mt-0.5 px-1.5 py-0.5 rounded-full ${st.bg}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${st.dot}`} />
                  <span className={`text-[11px] font-semibold ${st.text}`}>{st.label}</span>
                </div>
              </button>

              {/* Chat icon — navigates to messages */}
              <button
                onClick={async () => {
                  if (!tenant.id) return
                  setChattingId(apt.id)
                  try {
                    await chatService.startWithTenant(propertyId, tenant.id)
                    navigate('/user?tab=messages')
                  } catch {
                    toast.error('Error', 'Could not open chat')
                  } finally {
                    setChattingId(null)
                  }
                }}
                className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 bg-brand-50 text-brand-600 hover:bg-brand-100 transition-colors disabled:opacity-50"
                disabled={chattingId === apt.id}
                title="Message this person"
              >
                {chattingId === apt.id ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <MessageSquare className="w-4 h-4" strokeWidth={1.8} />
                )}
              </button>
            </div>

            {/* Expanded detail */}
            {isOpen && (
              <div className="px-4 pb-4 pt-1 border-t border-slate-50 space-y-3">
                {/* Interest info */}
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <Calendar className="w-3.5 h-3.5" />
                  <span>Requested for {date} at {formatTime(apt.requestedTime)}</span>
                </div>

                {/* Mobile number */}
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-emerald-50 flex items-center justify-center shrink-0">
                    <Phone className="w-3.5 h-3.5 text-emerald-600" strokeWidth={2} />
                  </div>
                  <a href={`tel:${apt.contactNumber}`} className="text-sm font-medium text-slate-800 hover:text-brand-600 transition-colors no-underline">
                    +91 {apt.contactNumber}
                  </a>
                </div>

                {/* Message */}
                {apt.message && (
                  <div className="bg-slate-50 rounded-xl px-3 py-2.5">
                    <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Message</p>
                    <p className="text-sm text-slate-600 leading-relaxed">{apt.message}</p>
                  </div>
                )}

                {/* Email */}
                {tenant.email && (
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <Mail className="w-3.5 h-3.5" strokeWidth={1.8} />
                    <span>{tenant.email}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
