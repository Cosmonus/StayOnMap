import { useState, useMemo, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Calendar, Check, MessageSquare } from 'lucide-react'
import { appointmentService } from '@services/appointment.service'
import { chatService } from '@services/chat.service'
import { useAuth } from '@features/auth/hooks/useAuth'
import { toast } from '@components/common/Toaster'
import Button from '@components/common/Button'
import Field from '@components/common/Field'
import { DayStrip, TimeGrid, buildDays } from './VisitSlotPicker'
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

export default function AppointmentForm({ propertyId, onSuccess, windowStart, windowEnd }) {
  const navigate = useNavigate()
  const qc = useQueryClient()
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
      // The day list is now stale for anyone who reopens the form — and for
      // this renter, who now has a pending request on it.
      qc.invalidateQueries({ queryKey: ['visit-availability', propertyId] })
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

  const todayISO = localISO(new Date())

  const slotsFor = useCallback((dateISO) => {
    if (dateISO !== todayISO) return withinWindow
    const cutoff = new Date(Date.now() + LEAD_MINUTES * 60_000)
    const hhmm = `${pad(cutoff.getHours())}:${pad(cutoff.getMinutes())}`
    return withinWindow.filter(t => t > hhmm)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [todayISO, windowStart, windowEnd])

  // The days the owner has already committed or blocked out. A failed fetch
  // degrades to "nothing known to be taken" rather than to an unusable form —
  // the server still refuses a taken day, so the worst case is the behaviour
  // this screen had before the endpoint existed.
  const { data: availability } = useQuery({
    queryKey: ['visit-availability', propertyId],
    queryFn: () => appointmentService.availability(propertyId).then(r => r.data),
    enabled: !!user && !!propertyId,
    staleTime: 60_000,
  })

  const days = useMemo(
    () => buildDays({
      unavailable: availability?.unavailableDates ?? [],
      hasSlots: (d) => slotsFor(d).length > 0,
    }),
    [availability, slotsFor],
  )

  const slots = form.requestedDate ? slotsFor(form.requestedDate) : []

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
          <Button fullWidth loading={chatLoading} onClick={handleChat}>
            {!chatLoading && <MessageSquare size={16} strokeWidth={2} aria-hidden="true" />}
            Message the owner
          </Button>
        </div>

        {/* Where the request now lives. Without this the flow ends on a green
            tick and the renter has to discover, unaided, that visits are a
            dashboard tab — which is how they end up messaging the owner to ask
            whether the request went through. */}
        <Button fullWidth variant="outline" to="/user?tab=appointments">
          <Calendar size={16} strokeWidth={2} aria-hidden="true" />
          View all your visits
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <h3 className="font-semibold text-slate-800">Request a visit</h3>

      <Field label="Pick a day" hint="Greyed-out days are already booked by the owner." htmlFor="visit-day">
        {() => <DayStrip days={days} value={form.requestedDate} onChange={pickDate} />}
      </Field>

      <Field
        label="Pick a time"
        hint={windowStart && windowEnd
          ? `The owner shows the place between ${formatTime(windowStart)} and ${formatTime(windowEnd)}.`
          : undefined}
        htmlFor="visit-time"
      >
        {() => form.requestedDate
          ? <TimeGrid slots={slots} value={form.requestedTime} onChange={setValue('requestedTime')} />
          : <p className="text-sm text-slate-500 rounded-xl bg-slate-50 border border-slate-200 px-3 py-3">Choose a day first.</p>}
      </Field>

      <Field
        label="Mobile number"
        required
        hint="Shared with this owner only, so they can confirm the visit."
        error={form.contactNumber !== null && contactNumber && !isValidPhone(contactNumber)
          ? 'Enter a 10-digit Indian mobile number.'
          : undefined}
      >
        {(p) => (
          <input
            {...p}
            type="tel"
            inputMode="numeric"
            autoComplete="tel"
            placeholder="10-digit mobile number"
            value={contactNumber}
            onChange={set('contactNumber')}
            className="w-full min-h-[44px] border border-slate-200 rounded-xl px-3 py-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
          />
        )}
      </Field>

      <Field label="Message" hint="Optional — anything the owner should know.">
        {(p) => (
          <textarea
            {...p}
            rows={3}
            placeholder="Anything the owner should know…"
            value={form.message}
            onChange={set('message')}
            className="w-full border border-slate-200 rounded-xl px-3 py-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 resize-none"
          />
        )}
      </Field>

      {mutation.isError && (
        <p role="alert" className="text-sm font-medium text-red-600">
          {mutation.error?.message || 'Failed to send request.'}
        </p>
      )}

      <Button
        fullWidth
        size="lg"
        disabled={!isValid}
        loading={mutation.isPending}
        onClick={() => mutation.mutate({ ...form, contactNumber })}
      >
        {mutation.isPending ? 'Sending…' : "I'm interested — request a visit"}
      </Button>
    </div>
  )
}
