import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Clock, CircleCheck, RefreshCw } from 'lucide-react'
import { appointmentService } from '@services/appointment.service'
import AppointmentForm from '@features/appointments/components/AppointmentForm'
import { formatTime } from '@utils/time'

// ── Appointment section — aware of existing bookings ────────────────────────
// Lucide, not emoji: an emoji renders in the OS font, so this card was the one
// element on the page drawn by Apple or Google rather than by us, and it changes
// shape per platform.
//
// RESCHEDULED used to be labelled "Reschedule requested", which is now the other
// status's meaning entirely. It says who moved it.
const APPT_DISPLAY = {
  PENDING:              { icon: Clock,     label: 'Visit requested',        bg: 'bg-amber-50',   border: 'border-amber-200',   text: 'text-amber-800'   },
  ACCEPTED:             { icon: CircleCheck, label: 'Visit confirmed',      bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-800' },
  RESCHEDULED:          { icon: RefreshCw, label: 'Owner proposed a new time', bg: 'bg-blue-50', border: 'border-blue-200',    text: 'text-blue-800'    },
  RESCHEDULE_REQUESTED: { icon: Clock,     label: 'Waiting on the owner',   bg: 'bg-amber-50',   border: 'border-amber-200',   text: 'text-amber-800'   },
}

export default function AppointmentSection({ propertyId, type, minNights, maxNights, windowStart, windowEnd }) {
  const [forceForm, setForceForm] = useState(false)

  const { data: myAppointments = [], isLoading } = useQuery({
    queryKey: ['my-appointments'],
    queryFn: () => appointmentService.mine().then(r => r.data),
    staleTime: 60 * 1000,
  })

  const existing = myAppointments
    .filter(a => a.propertyId === propertyId)
    .sort((a, b) => new Date(b.createdAt ?? 0) - new Date(a.createdAt ?? 0))[0]

  const needsAction = !existing
    || existing.status === 'REJECTED'
    || existing.status === 'CANCELLED'
    || existing.status === 'RESCHEDULED'

  const showForm = needsAction || forceForm

  if (isLoading) {
    return <div className="h-16 bg-slate-100 rounded-xl animate-pulse" />
  }

  if (!showForm && existing) {
    const cfg = APPT_DISPLAY[existing.status] ?? APPT_DISPLAY.PENDING
    const CfgIcon = cfg.icon
    // A stay request is a date range, not a slot — the words and the date line
    // both say so, and no time is shown because none was picked.
    const isStayReq = Boolean(existing.checkOutDate)
    const label = isStayReq
      ? (existing.status === 'ACCEPTED' ? 'Stay confirmed' : existing.status === 'PENDING' ? 'Stay requested' : cfg.label)
      : cfg.label
    const fmt = (d) => new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
    const date = existing.requestedDate ? fmt(existing.requestedDate) : null

    return (
      <div className={`rounded-xl border p-4 space-y-2 ${cfg.bg} ${cfg.border}`}>
        <div className="flex items-center gap-2">
          <CfgIcon size={17} strokeWidth={2} className={cfg.text} aria-hidden="true" />
          <span className={`text-sm font-bold ${cfg.text}`}>{label}</span>
        </div>
        {date && (
          <p className={`text-xs ${cfg.text} opacity-80`}>
            {isStayReq
              ? `${date} → ${fmt(existing.checkOutDate)}`
              : `${date}${existing.requestedTime ? ` · ${formatTime(existing.requestedTime)}` : ''}`}
          </p>
        )}
        {existing.ownerNote && (
          <p className={`text-xs italic ${cfg.text} opacity-70`}>&ldquo;{existing.ownerNote}&rdquo;</p>
        )}
        {existing.status === 'RESCHEDULE_REQUESTED' && (
          <p className={`text-xs ${cfg.text} opacity-80`}>
            You asked to move this — the owner has to confirm before it is set.
          </p>
        )}
        {/* This card was the end of the road: it told you a visit existed and
            offered nothing to do about it, so changing your mind meant finding
            the Appointments tab yourself. Cancelling lives there. */}
        <Link
          to="/user?tab=appointments"
          className={`inline-block text-xs font-semibold underline underline-offset-2 ${cfg.text} hover:opacity-80`}
        >
          Manage this visit
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {existing?.status === 'REJECTED' && (
        <div className="rounded-xl bg-red-50 border border-red-200 p-3">
          <p className="text-xs font-semibold text-red-700">Your previous request was declined</p>
          {existing.ownerNote && (
            <p className="text-xs text-red-600 mt-0.5 italic">&ldquo;{existing.ownerNote}&rdquo;</p>
          )}
          <p className="text-xs text-red-500 mt-1">You can send a new request below.</p>
        </div>
      )}
      {existing?.status === 'RESCHEDULED' && (
        <div className="rounded-xl bg-blue-50 border border-blue-200 p-3">
          <p className="text-xs font-semibold text-blue-700">The owner requested a reschedule</p>
          {existing.ownerNote && (
            <p className="text-xs text-blue-600 mt-0.5 italic">&ldquo;{existing.ownerNote}&rdquo;</p>
          )}
          <p className="text-xs text-blue-500 mt-1">Pick a new date and time below.</p>
        </div>
      )}
      <AppointmentForm
        propertyId={propertyId}
        type={type}
        minNights={minNights}
        maxNights={maxNights}
        onSuccess={() => setForceForm(false)}
        windowStart={windowStart}
        windowEnd={windowEnd}
      />
    </div>
  )
}
