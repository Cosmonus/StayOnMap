import { useState, useMemo, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import { appointmentService } from '@services/appointment.service'
import Modal from '@components/common/Modal'
import Button from '@components/common/Button'
import Field from '@components/common/Field'
import { DayStrip, TimeGrid, buildDays } from './VisitSlotPicker'
import { VISIT_SLOTS, formatTime } from '@utils/time'

// A renter proposing a different time. Until 2026-08-07 the only way out of a
// slot they could not make was to CANCEL and start over from an empty form —
// losing the thread's context and their place in the owner's queue — so most
// people messaged the owner and hoped instead.
//
// It reuses the booking picker, deliberately: proposing a time and asking for
// one in the first place are the same question, and a second date control with
// its own rules about which days are free is how the two come apart.
const LEAD_MINUTES = 30
const pad = (n) => String(n).padStart(2, '0')
const localISO = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

export default function ProposeTimeModal({ appt, open, onClose, onSubmit, pending }) {
  const [date, setDate] = useState('')
  const [time, setTime] = useState('')
  const [note, setNote] = useState('')

  const propertyId = appt?.property?.id
  const windowStart = appt?.property?.appointmentWindowStart
  const windowEnd = appt?.property?.appointmentWindowEnd

  const withinWindow = VISIT_SLOTS.filter(
    (t) => (!windowStart || t >= windowStart) && (!windowEnd || t <= windowEnd),
  )
  const todayISO = localISO(new Date())

  const slotsFor = useCallback((dateISO) => {
    if (dateISO !== todayISO) return withinWindow
    const cutoff = new Date(Date.now() + LEAD_MINUTES * 60_000)
    // Past 23:30 the cutoff lands on tomorrow and its clock time wraps to
    // '00:00', against which every slot still compares as available.
    if (localISO(cutoff) !== todayISO) return []
    const hhmm = `${pad(cutoff.getHours())}:${pad(cutoff.getMinutes())}`
    return withinWindow.filter((t) => t > hhmm)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [todayISO, windowStart, windowEnd])

  const { data: availability } = useQuery({
    queryKey: ['visit-availability', propertyId],
    queryFn: () => appointmentService.availability(propertyId).then((r) => r.data),
    enabled: open && !!propertyId,
    staleTime: 60_000,
  })

  const days = useMemo(
    () => buildDays({
      unavailable: availability?.unavailableDates ?? [],
      hasSlots: (d) => slotsFor(d).length > 0,
    }),
    [availability, slotsFor],
  )

  function pickDate(value) {
    setDate(value)
    setTime((t) => (slotsFor(value).includes(t) ? t : ''))
  }

  function close() {
    setDate(''); setTime(''); setNote('')
    onClose()
  }

  const current = appt
    ? `${new Date(appt.scheduledAt ?? appt.requestedDate).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}${appt.requestedTime ? `, ${formatTime(appt.requestedTime)}` : ''}`
    : null

  return (
    <Modal
      isOpen={open}
      onClose={close}
      title="Propose a different time"
      sheet
      footer={
        <div className="flex gap-2">
          <Button variant="outline" fullWidth onClick={close}>Keep the current time</Button>
          <Button
            fullWidth
            disabled={!date || !time}
            loading={pending}
            onClick={() => onSubmit({ requestedDate: new Date(date).toISOString(), requestedTime: time, tenantNote: note.trim() || undefined })}
          >
            Send to owner
          </Button>
        </div>
      }
    >
      <div className="space-y-5">
        {current && (
          <p className="text-sm text-slate-600">
            Currently <strong className="font-semibold text-slate-800">{current}</strong>. The owner
            will be asked to confirm whatever you pick here — the visit stays open until they do.
          </p>
        )}

        <Field label="New day" hint="Greyed-out days are already booked by the owner.">
          {() => <DayStrip days={days} value={date} onChange={pickDate} label="Pick a new day" />}
        </Field>

        <Field
          label="New time"
          hint={windowStart && windowEnd
            ? `The owner shows the place between ${formatTime(windowStart)} and ${formatTime(windowEnd)}.`
            : undefined}
        >
          {() => date
            ? <TimeGrid slots={slotsFor(date)} value={time} onChange={setTime} label="Pick a new time" />
            : <p className="text-sm text-slate-500 rounded-xl bg-slate-50 border border-slate-200 px-3 py-3">Choose a day first.</p>}
        </Field>

        <Field label="Why" hint="Optional — a line of context makes a yes much likelier.">
          {(p) => (
            <textarea
              {...p}
              rows={2}
              maxLength={300}
              placeholder="I have something on that morning…"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="w-full border border-slate-200 rounded-xl px-3 py-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 resize-none"
            />
          )}
        </Field>
      </div>
    </Modal>
  )
}
