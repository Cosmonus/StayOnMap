import { useQuery } from '@tanstack/react-query'
import { appointmentService } from '@services/appointment.service'

const STATUS_COLOR = { PENDING: 'bg-yellow-50 text-yellow-800', ACCEPTED: 'bg-green-50 text-green-800', REJECTED: 'bg-red-50 text-red-800', RESCHEDULED: 'bg-blue-50 text-blue-800', CANCELLED: 'bg-slate-50 text-slate-600' }

export default function AppointmentsPage() {
  const { data: appointments = [], isLoading } = useQuery({
    queryKey: ['my-appointments'],
    queryFn: () => appointmentService.mine().then(r => r.data),
  })

  if (isLoading) return <div className="p-8 text-slate-400 text-sm">Loading...</div>

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-slate-800">My Appointments</h1>
      {appointments.length === 0 ? (
        <div className="text-center py-16 text-slate-400">
          <p className="text-base font-medium">No appointment requests yet</p>
          <p className="text-sm mt-1">When you request a visit, it will appear here.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {appointments.map(a => (
            <div key={a.id} className="border border-slate-100 rounded-xl p-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-semibold text-slate-800">{a.property?.title ?? 'Property'}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{a.property?.city}</p>
                  <p className="text-sm text-slate-600 mt-2">
                    {new Date(a.requestedDate).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })} at {a.requestedTime}
                  </p>
                  {a.ownerNote && <p className="text-sm text-slate-500 mt-1 italic">&ldquo;{a.ownerNote}&rdquo;</p>}
                </div>
                <span className={`px-2.5 py-1 rounded-full text-xs font-medium flex-shrink-0 ${STATUS_COLOR[a.status] ?? ''}`}>{a.status}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
