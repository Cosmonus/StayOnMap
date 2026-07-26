import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import Select from '@components/common/Select'
import { toast } from '@components/common/Toaster'
import { userService } from '@services/user.service'
import { authService } from '@services/auth.service'
import { CITY_NAMES } from '@/config/cities'
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

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }))
  const blur = (k) => { if (form[k]?.trim() && form[k] !== profile?.[k]) save.mutate({ [k]: form[k] }) }

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
            <Txt value={form.phone} onChange={(v) => set('phone', v)} onBlur={() => blur('phone')} ph="+91 98450 12345" label="Contact number" />
          </div>
        )}
        {need.has('city') && (
          <div>
            <FieldLabel>Your city</FieldLabel>
            <Select
              value={form.city}
              onChange={(v) => { set('city', v); save.mutate({ city: v }) }}
              placeholder="Select city"
              options={CITY_NAMES.map((n) => ({ value: n, label: n }))}
            />
          </div>
        )}
      </div>

      {need.has('email') && (
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <p className="text-sm text-amber-900">Verify your email — renters need a real way to reach you.</p>
          <button
            type="button"
            onClick={() => verify.mutate()}
            disabled={verify.isPending}
            className="min-h-[44px] px-4 py-3 rounded-xl bg-amber-900 text-white text-sm font-semibold hover:opacity-90 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
          >
            {verify.isPending ? 'Sending…' : 'Send verification link'}
          </button>
        </div>
      )}

      <p className="text-xs text-amber-800 mt-4">
        Your number is shared with a renter only after you accept their visit request.
      </p>
    </div>
  )
}
