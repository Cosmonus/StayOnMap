import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import Select from '@components/common/Select'
import { toast } from '@components/common/Toaster'
import { userService } from '@services/user.service'
import { authService } from '@services/auth.service'
import { CITY_OPTIONS } from '@/config/cities'
import { normalizePhone, isValidPhone } from '@utils/validation'
import { FieldLabel, Txt } from './FieldControl'

// The four things POST /properties requires of the person listing
// (backend requireCompleteProfile) — asked HERE, inline, as the last thing
// before publishing.
//
// This used to be a wall in front of the wizard that sent people to Settings
// and lost the listing they had come to make. The rule is the same; only the
// moment changed. Nobody fills a profile form for a listing they haven't
// made yet.
export default function PublishGate({ missing, profile }) {
  const qc = useQueryClient()
  const need = new Set(missing.map((m) => m.field))
  const [form, setForm] = useState({
    name: profile?.name ?? '',
    phone: profile?.phone ?? '',
    city: profile?.city ?? '',
  })

  const save = useMutation({
    mutationFn: (data) => userService.updateProfile(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['me'] }),
    onError: (err) => toast.error('Couldn’t save', err.message ?? 'Please try again'),
  })

  const verify = useMutation({
    mutationFn: () => authService.sendEmailVerification(),
    onSuccess: () => toast.success('Check your inbox', 'We sent you a verification link'),
    onError: (err) => toast.error('Couldn’t send', err.message ?? 'Please try again'),
  })

  const [phoneError, setPhoneError] = useState('')

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }))
  const blur = (k) => { if (form[k]?.trim() && form[k] !== profile?.[k]) save.mutate({ [k]: form[k] }) }

  // Phone is committed as you type, not on blur, and always normalised — see
  // the note in mobile's PublishGate.js. The server takes 10 bare digits only,
  // and this placeholder used to demonstrate "+91 98450 12345", which it
  // rejects. Publish stays disabled until missingProfile clears, so a save
  // that never fired left the gate up with nothing explaining why.
  const commitPhone = (raw) => {
    const clean = normalizePhone(raw)
    if (!clean) { setPhoneError(''); return }
    if (!isValidPhone(clean)) {
      setPhoneError(clean.length >= 10 ? 'Enter a valid 10-digit Indian mobile number' : '')
      return
    }
    setPhoneError('')
    if (clean !== profile?.phone) save.mutate({ phone: clean })
  }

  return (
    <div className="p-5 rounded-2xl bg-amber-50 border border-amber-100">
      <p className="text-sm font-bold text-amber-900">
        {need.size === 1 ? 'One thing' : `${need.size} things`} before you publish
      </p>
      <p className="text-sm text-amber-800 mt-1 leading-relaxed">
        We ask here rather than at the start, so you never fill a form for a listing you had not made yet.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
        {need.has('name') && (
          <div>
            <FieldLabel>Your full name</FieldLabel>
            <Txt value={form.name} onChange={(v) => set('name', v)} onBlur={() => blur('name')} ph="Priya Raghavan" label="Your full name" />
          </div>
        )}
        {need.has('phone') && (
          <div>
            <FieldLabel>Contact number</FieldLabel>
            <Txt
              value={form.phone}
              onChange={(v) => { set('phone', v); commitPhone(v) }}
              onBlur={() => commitPhone(form.phone)}
              ph="9845012345"
              label="Contact number"
            />
            <p className={`text-xs mt-1 leading-relaxed ${phoneError ? 'text-red-600' : 'text-slate-500'}`}>
              {phoneError || '10 digits. +91, spaces and dashes are fine.'}
            </p>
          </div>
        )}
        {need.has('city') && (
          <div>
            <FieldLabel>Your city</FieldLabel>
            <Select
              value={form.city}
              onChange={(v) => { set('city', v); save.mutate({ city: v }) }}
              placeholder="Select city"
              options={CITY_OPTIONS}
            />
          </div>
        )}
      </div>

      {/* Email verification is the one requirement satisfied OUTSIDE this tab —
          you leave for an inbox, possibly on another device, and come back.
          Without a way to re-check, a fully-satisfied gate sits there still
          closed, which is how this box read as "the phone field doesn't work":
          the owner fixes what they can see, nothing changes, and the real
          blocker never announces itself. */}
      {need.has('email') && (
        <div className="mt-4 flex flex-col gap-2">
          <p className="text-sm text-amber-900">Verify your email — renters need a real way to reach you.</p>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => verify.mutate()}
              disabled={verify.isPending}
              className="min-h-[44px] px-4 py-3 rounded-xl bg-amber-900 text-white text-sm font-semibold hover:opacity-90 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
            >
              {verify.isPending ? 'Sending…' : 'Send verification link'}
            </button>
            <button
              type="button"
              onClick={() => qc.invalidateQueries({ queryKey: ['me'] })}
              className="min-h-[44px] px-4 py-3 rounded-xl border border-amber-300 text-amber-900 text-sm font-semibold hover:bg-amber-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
            >
              I&rsquo;ve verified &mdash; check again
            </button>
          </div>
          <p className="text-xs text-amber-800">
            Open the link in your inbox, then come back here.
          </p>
        </div>
      )}

      <p className="text-xs text-amber-800 mt-4">
        Your number is shared with a renter only after you accept their visit request.
      </p>
    </div>
  )
}
