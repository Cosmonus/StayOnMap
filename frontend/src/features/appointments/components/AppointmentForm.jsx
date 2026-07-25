import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import { Check, LoaderCircle, MessageSquare } from 'lucide-react'
import { appointmentService } from '@services/appointment.service'
import { chatService } from '@services/chat.service'
import { toast } from '@components/common/Toaster'
import Select from '@components/common/Select'

const ALL_SLOTS = ['09:00','09:30','10:00','10:30','11:00','11:30','12:00','12:30',
  '13:00','13:30','14:00','14:30','15:00','15:30','16:00','16:30',
  '17:00','17:30','18:00','18:30','19:00','19:30','20:00']

const UPCOMING_DATES = Array.from({ length: 30 }, (_, i) => {
  const d = new Date()
  d.setDate(d.getDate() + i)
  const iso = d.toISOString().split('T')[0]
  const label = i === 0 ? 'Today' : i === 1 ? 'Tomorrow'
    : d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })
  return { value: iso, label }
})

export default function AppointmentForm({ propertyId, onSuccess, windowStart, windowEnd }) {
  const navigate = useNavigate()
  const [form, setForm] = useState({ requestedDate: '', requestedTime: '', message: '', contactNumber: '' })
  const [submitted, setSubmitted] = useState(false)
  const [chatLoading, setChatLoading] = useState(false)

  const mutation = useMutation({
    mutationFn: (data) => {
      const payload = {
        requestedDate: new Date(data.requestedDate).toISOString(),
        requestedTime: data.requestedTime,
        contactNumber: data.contactNumber,
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

  const slots = ALL_SLOTS.filter(t =>
    (!windowStart || t >= windowStart) && (!windowEnd || t <= windowEnd)
  )

  const set = (key) => (e) => setForm(f => ({ ...f, [key]: e.target.value }))
  const setValue = (key) => (value) => setForm(f => ({ ...f, [key]: value }))
  const isValid = form.requestedDate && form.requestedTime && /^[6-9]\d{9}$/.test(form.contactNumber)

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
            className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl bg-brand-600 text-white text-xs font-bold hover:bg-brand-700 transition-colors disabled:opacity-60"
          >
            {chatLoading ? (
              <LoaderCircle className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <MessageSquare size={14} strokeWidth={2} />
            )}
            Message the owner
          </button>
        </div>
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
            onChange={setValue('requestedDate')}
            placeholder="Select date"
            options={UPCOMING_DATES}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Preferred Time</label>
          <Select
            value={form.requestedTime}
            onChange={setValue('requestedTime')}
            placeholder="Select time"
            options={slots.map(t => {
              const [h, m] = t.split(':').map(Number)
              const display = `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`
              return { value: t, label: display }
            })}
          />
          {windowStart && windowEnd && (
            <p className="text-[11px] text-slate-500 mt-1">
              Owner available {windowStart.replace(/^0/, '')} – {windowEnd.replace(/^0/, '')}
            </p>
          )}
        </div>
      </div>
      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">Mobile Number</label>
        <input
          type="tel"
          placeholder="10-digit mobile number"
          value={form.contactNumber}
          onChange={set('contactNumber')}
          className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">Message <span className="text-slate-500">(optional)</span></label>
        <textarea
          rows={3}
          placeholder="Anything the owner should know..."
          value={form.message}
          onChange={set('message')}
          className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none"
        />
      </div>
      {mutation.isError && (
        <p className="text-sm text-red-600">{mutation.error?.message || 'Failed to send request.'}</p>
      )}
      <button
        disabled={!isValid || mutation.isPending}
        onClick={() => mutation.mutate(form)}
        className="w-full py-3 rounded-xl bg-brand-600 text-white font-semibold text-sm hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {mutation.isPending ? 'Sending…' : "I'm Interested — Request Visit"}
      </button>
    </div>
  )
}
