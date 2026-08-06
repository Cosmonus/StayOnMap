import { useState, useMemo, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import { Calendar, Check, LoaderCircle, MessageSquare } from 'lucide-react'
import { appointmentService } from '@services/appointment.service'
import { chatService } from '@services/chat.service'
import { useAuth } from '@features/auth/hooks/useAuth'
import { toast } from '@components/common/Toaster'
import Select from '@components/common/Select'
import TimeSelect from '@components/common/TimeSelect'
import { VISIT_SLOTS, formatTime } from '@utils/time'
import { normalizePhone, isValidPhone } from '@utils/validation'

// Nobody can act on a request made for 20 minutes' time, and offering it
// invites a slot that's stale before the owner opens the notification.
const LEAD_MINUTES = 30

const pad = (n) => String(n).padStart(2, '0')

// Local date parts, not toISOString(): the ISO string is UTC, so between
// midnight and 05:30 IST it names YESTERDAY — and the option labelled "Today"
// then carried yesterday's date.
function localISO(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function upcomingDates() {
  return Array.from({ length: 30 }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() + i)
    const label = i === 0 ? 'Today' : i === 1 ? 'Tomorrow'
      : d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })
    return { value: localISO(d), label }
  })
}

export default function AppointmentForm({ propertyId, onSuccess, windowStart, windowEnd }) {
  const navigate = useNavigate()
  const { user } = useAuth()
  // `contactNumber: null` means "the person hasn't touched this field", which
  // is what lets the profile number below fill it. Once they type — including
  // typing nothing, i.e. clearing it — it becomes a string and stops falling
  // back, so we never re-impose a number they deliberately deleted.
  const [form, setForm] = useState({ requestedDate: '', requestedTime: '', message: '', contactNumber: null })
  const [submitted, setSubmitted] = useState(false)
  const [chatLoading, setChatLoading] = useState(false)

  // The number is already on the account — `/auth/me` returns the whole User
  // row, so `user.phone` is right here — and the form asked for it again every
  // single time. Derived rather than seeded into state by an effect: AuthContext
  // rehydrates the profile asynchronously, so on the first render of a
  // deep-linked property page `user` is still null, and a derivation picks it up
  // when it lands without a second render pass. Normalised, because a stored
  // "+91 98450 12345" is exactly what the server's /^[6-9]\d{9}$/ rejects — the
  // prefill has to arrive already valid.
  const profilePhone = isValidPhone(user?.phone) ? normalizePhone(user.phone) : ''
  const contactNumber = form.contactNumber ?? profilePhone

  const mutation = useMutation({
    mutationFn: (data) => {
      const payload = {
        requestedDate: new Date(data.requestedDate).toISOString(),
        requestedTime: data.requestedTime,
        // Normalised on the way out too: the field accepts what a person
        // actually types, the wire only ever carries ten digits.
        contactNumber: normalizePhone(data.contactNumber),
      }
      if (data.message?.trim()) payload.message = data.message.trim()
      return appointmentService.request(propertyId, payload)
    },
    onSuccess: () => {
      setSubmitted(true)
      toast.success('Request sent', 'The owner will respond within 24 hours')
      onSuccess?.()
    },
    onError: (err) => {
      const msg = err?.message || err?.error || 'Failed to send request. Please try again.'
      toast.error('Request failed', msg)
    },
  })

  async function handleChat() {
    setChatLoading(true)
    try {
      await chatService.startConversation(propertyId)
      navigate('/user?tab=messages')
    } catch {
      toast.error('Error', 'Could not open chat')
    } finally {
      setChatLoading(false)
    }
  }

  // Slots the owner actually accepts, minus anything already gone today. The
  // list used to start at 09:00 regardless of the clock, so at 3pm "Today ·
  // 9:00 AM" was selectable and the server took it (it doesn't any more —
  // requestAppointment rejects a past slot — so offering it could now only
  // produce an error).
  const withinWindow = VISIT_SLOTS.filter(t =>
    (!windowStart || t >= windowStart) && (!windowEnd || t <= windowEnd)
  )

  const dates = useMemo(upcomingDates, [])
  const todayISO = dates[0]?.value

  const slotsFor = useCallback((dateISO) => {
    if (dateISO !== todayISO) return withinWindow
    const cutoff = new Date(Date.now() + LEAD_MINUTES * 60_000)
    const hhmm = `${pad(cutoff.getHours())}:${pad(cutoff.getMinutes())}`
    return withinWindow.filter(t => t > hhmm)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [todayISO, windowStart, windowEnd])

  const slots = slotsFor(form.requestedDate)

  // Today drops off the list once its last slot has passed, rather than sitting
  // there as a date that can only lead to an empty time dropdown.
  const dateOptions = slotsFor(todayISO).length ? dates : dates.slice(1)

  // A date change can invalidate the chosen time (picking Today late in the
  // day). Clearing it here beats submitting a combination the server refuses.
  function pickDate(value) {
    setForm(f => ({
      ...f,
      requestedDate: value,
      requestedTime: slotsFor(value).includes(f.requestedTime) ? f.requestedTime : '',
    }))
  }

  const set = (key) => (e) => setForm(f => ({ ...f, [key]: e.target.value }))
  const setValue = (key) => (value) => setForm(f => ({ ...f, [key]: value }))
  const isValid = form.requestedDate && form.requestedTime && isValidPhone(contactNumber)

  if (submitted) {
    return (
      <div className="space-y-3">
        <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-4 flex items-start gap-3">
          <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center shrink-0 mt-0.5">
            <Check size={16} color="#059669" strokeWidth={2.5} />
          </div>
          <div>
            <p className="text-sm font-bold text-emerald-800">Visit requested!</p>
            <p className="text-xs text-emerald-600 mt-0.5">The owner will respond within 24 hours.</p>
          </div>
        </div>

        {/* Chat nudge */}
        <div className="rounded-xl bg-brand-50 border border-brand-100 p-4">
          <p className="text-xs font-semibold text-brand-700 mb-1">Want to ask the owner something?</p>
          <p className="text-xs text-brand-600/70 mb-3">Chat directly — get faster answers about the property.</p>
          <button
            onClick={handleChat}
            disabled={chatLoading}
            className="min-h-[44px] flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-brand-600 text-white text-xs font-bold hover:bg-brand-700 transition-colors disabled:opacity-60"
          >
            {chatLoading ? (
              <LoaderCircle className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <MessageSquare size={14} strokeWidth={2} />
            )}
            Message the owner
          </button>
        </div>

        {/* Where the request now lives. Without this the flow ends on a green
            tick and the renter has to discover, unaided, that visits are a
            dashboard tab — which is how they end up messaging the owner to ask
            whether the request went through. */}
        <Link
          to="/user?tab=appointments"
          className="min-h-[44px] flex items-center justify-center gap-2 w-full py-3 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 no-underline hover:bg-slate-50 transition-colors"
        >
          <Calendar size={14} strokeWidth={2} />
          View all your visits
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <h3 className="font-semibold text-slate-800">Request a visit</h3>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Preferred Date</label>
          <Select
            value={form.requestedDate}
            onChange={pickDate}
            placeholder="Select date"
            options={dateOptions}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Preferred Time</label>
          <TimeSelect
            value={form.requestedTime}
            onChange={setValue('requestedTime')}
            slots={slots}
          />
          {windowStart && windowEnd && (
            <p className="text-[11px] text-slate-500 mt-1">
              Owner available {formatTime(windowStart)} – {formatTime(windowEnd)}
            </p>
          )}
        </div>
      </div>
      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">Mobile Number</label>
        <input
          type="tel"
          placeholder="10-digit mobile number"
          value={contactNumber}
          onChange={set('contactNumber')}
          className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">Message <span className="text-slate-500">(optional)</span></label>
        <textarea
          rows={3}
          placeholder="Anything the owner should know..."
          value={form.message}
          onChange={set('message')}
          className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 resize-none"
        />
      </div>
      {mutation.isError && (
        <p className="text-sm text-red-600">{mutation.error?.message || 'Failed to send request.'}</p>
      )}
      <button
        disabled={!isValid || mutation.isPending}
        onClick={() => mutation.mutate({ ...form, contactNumber })}
        className="w-full py-3 rounded-xl bg-brand-600 text-white font-semibold text-sm hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {mutation.isPending ? 'Sending…' : "I'm Interested — Request Visit"}
      </button>
    </div>
  )
}
