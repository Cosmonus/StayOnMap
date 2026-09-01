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
import { track } from '@lib/analytics'

// Nobody can act on a request made for 20 minutes' time, and offering it
// invites a slot that's stale before the owner opens the notification.
const LEAD_MINUTES = 30

// The same form, worded for what is actually being asked for — a plot gets a
// site visit, a shop an inspection, and a short stay is booked as DATES, not
// a viewing slot. Per-type behaviour is declared here, not scattered.
const TYPE_COPY = {
  default:    { heading: 'Request a visit',            cta: "I'm interested — request a visit", success: 'Visit requested!' },
  LAND:       { heading: 'Request a site visit',       cta: 'Request a site visit',             success: 'Site visit requested!' },
  COMMERCIAL: { heading: 'Request an inspection visit', cta: 'Request an inspection visit',     success: 'Inspection requested!' },
  SHORT_STAY: { heading: 'Book your stay',             cta: 'Request to book',                  success: 'Stay requested!' },
}

const DAY_MS = 86_400_000

const pad = (n) => String(n).padStart(2, '0')

// Local date parts, not toISOString(): the ISO string is UTC, so between
// midnight and 05:30 IST it names YESTERDAY — and the option labelled "Today"
// then carried yesterday's date.
function localISO(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export default function AppointmentForm({ propertyId, type, minNights, maxNights, onSuccess, windowStart, windowEnd }) {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { user } = useAuth()
  const isStay = type === 'SHORT_STAY'
  const copy = TYPE_COPY[type] ?? TYPE_COPY.default
  // `contactNumber: null` means "the person hasn't touched this field", which
  // is what lets the profile number below fill it. Once they type — including
  // typing nothing, i.e. clearing it — it becomes a string and stops falling
  // back, so we never re-impose a number they deliberately deleted.
  const [form, setForm] = useState({ requestedDate: '', requestedTime: '', checkOutDate: '', message: '', contactNumber: null })
  // false | 'requested' | 'confirmed' — instant book comes back ACCEPTED and
  // the success card must not claim the owner still has to answer.
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
        // A stay has no viewing slot; the server never reads the time for one,
        // but the schema requires the field. Noon is the conventional filler.
        requestedTime: isStay ? '12:00' : data.requestedTime,
        // Normalised on the way out too: the field accepts what a person
        // actually types, the wire only ever carries ten digits.
        contactNumber: normalizePhone(data.contactNumber),
      }
      if (isStay) payload.checkOutDate = new Date(data.checkOutDate).toISOString()
      if (data.message?.trim()) payload.message = data.message.trim()
      return appointmentService.request(propertyId, payload)
    },
    onSuccess: (res) => {
      const confirmed = res?.data?.status === 'ACCEPTED'
      setSubmitted(confirmed ? 'confirmed' : 'requested')
      // Funnel step 5, the one that matters. Fired on the SERVER's confirmed
      // success, never on submit — a request that 400s is not a booking.
      track('appointment_created', { propertyId })
      toast.success(
        confirmed ? 'Booking confirmed' : 'Request sent',
        confirmed ? 'Instant book — your dates are locked in.' : 'The owner will respond within 24 hours',
      )
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
    // Past 23:30 the cutoff lands on TOMORROW, and its clock time wraps to
    // "00:00" — against which every slot compares as still available, so late
    // at night today re-opened completely. If the cutoff has left today, today
    // has nothing left, full stop.
    if (localISO(cutoff) !== todayISO) return []
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
      // A stay has no viewing slots, so the clock never disables a check-in
      // day — only the owner's calendar does.
      hasSlots: (d) => isStay || slotsFor(d).length > 0,
    }),
    [availability, slotsFor, isStay],
  )

  // Check-out choices for the chosen check-in: minNights to maxNights ahead,
  // stopping at the first taken night. Nights are [check-in, check-out), so
  // check-out may land ON a taken day — the guest leaves that morning — but a
  // range may never CROSS one.
  const checkOutDays = useMemo(() => {
    if (!isStay || !form.requestedDate) return []
    const [y, m, d] = form.requestedDate.split('-').map(Number)
    const start = new Date(y, m - 1, d)
    const taken = new Set(availability?.unavailableDates ?? [])
    const minN = Math.max(1, minNights || 1)
    const maxN = Math.max(minN, maxNights || 28)
    let maxValid = Infinity
    for (let k = 1; k <= maxN; k++) {
      if (taken.has(localISO(new Date(start.getTime() + k * DAY_MS)))) { maxValid = k; break }
    }
    return Array.from({ length: maxN - minN + 1 }, (_, i) => {
      const n = minN + i
      const dt = new Date(start.getTime() + n * DAY_MS)
      const disabled = n > maxValid
      return {
        value: localISO(dt),
        full: `${dt.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })} — ${n} night${n === 1 ? '' : 's'}`,
        weekday: dt.toLocaleDateString('en-IN', { weekday: 'short' }),
        dayNum: dt.getDate(),
        month: dt.toLocaleDateString('en-IN', { month: 'short' }),
        disabled,
        reason: disabled ? 'the owner already has those dates booked' : null,
      }
    })
  }, [isStay, form.requestedDate, availability, minNights, maxNights])

  const nights = isStay && form.requestedDate && form.checkOutDate
    ? Math.round((new Date(form.checkOutDate) - new Date(form.requestedDate)) / DAY_MS)
    : 0

  const slots = form.requestedDate ? slotsFor(form.requestedDate) : []

  // A date change can invalidate the chosen time (picking Today late in the
  // day) — or, on a stay, the chosen check-out. Clearing beats submitting a
  // combination the server refuses.
  function pickDate(value) {
    if (isStay) {
      setForm(f => ({ ...f, requestedDate: value, checkOutDate: '' }))
      return
    }
    setForm(f => ({
      ...f,
      requestedDate: value,
      requestedTime: slotsFor(value).includes(f.requestedTime) ? f.requestedTime : '',
    }))
  }

  const set = (key) => (e) => setForm(f => ({ ...f, [key]: e.target.value }))
  const setValue = (key) => (value) => setForm(f => ({ ...f, [key]: value }))
  const isValid = form.requestedDate && isValidPhone(contactNumber)
    && (isStay ? form.checkOutDate : form.requestedTime)

  if (submitted) {
    return (
      <div className="space-y-3">
        <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-4 flex items-start gap-3">
          <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center shrink-0 mt-0.5">
            <Check size={16} color="#059669" strokeWidth={2.5} />
          </div>
          <div>
            <p className="text-sm font-bold text-emerald-800">
              {submitted === 'confirmed' ? 'Booking confirmed!' : copy.success}
            </p>
            <p className="text-xs text-emerald-600 mt-0.5">
              {submitted === 'confirmed'
                ? 'Instant book — your dates are locked in, and the owner has your details.'
                : 'The owner will respond within 24 hours.'}
            </p>
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
      <h3 className="font-semibold text-slate-800">{copy.heading}</h3>

      {isStay ? (
        <>
          <Field label="Check-in" hint="Greyed-out days are already booked." htmlFor="stay-checkin">
            {() => <DayStrip days={days} value={form.requestedDate} onChange={pickDate} label="Check-in" />}
          </Field>
          <Field
            label="Check-out"
            hint={minNights > 1 ? `Minimum stay is ${minNights} nights.` : undefined}
            htmlFor="stay-checkout"
          >
            {() => form.requestedDate
              ? <DayStrip days={checkOutDays} value={form.checkOutDate} onChange={setValue('checkOutDate')} label="Check-out" />
              : <p className="text-sm text-slate-500 rounded-xl bg-slate-50 border border-slate-200 px-3 py-3">Choose your check-in first.</p>}
          </Field>
          {nights > 0 && (
            <p className="text-sm font-medium text-slate-700">
              {nights} night{nights === 1 ? '' : 's'}
            </p>
          )}
        </>
      ) : (
        <>
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
        </>
      )}

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
        {mutation.isPending ? 'Sending…' : copy.cta}
      </Button>
    </div>
  )
}
