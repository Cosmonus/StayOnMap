import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import Modal from '@components/common/Modal'
import { authService } from '@services/auth.service'
import { toast } from '@components/common/Toaster'
import { isValidPhone, normalizePhone } from '@utils/validation'

// Two steps in one dialog: which number, then the code that proves it.
//
// The number is editable here rather than read from the Settings form, because
// the two are different acts. Saving a phone stores a string; verifying one
// proves you hold the SIM — and the second is what puts the number on the
// account (the server writes `phone` on success, so there is no way to verify
// A and end up with B saved).
//
// Server messages are shown verbatim. Every failure this flow can produce is
// one the person can act on — a cooldown with seconds left, a daily cap, a
// number already verified elsewhere — and replacing those with a house string
// would turn "wait 40s" into "something went wrong".
const INPUT = 'w-full min-h-[44px] px-3 py-3 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#111111] focus:border-transparent bg-slate-50'

const message = (err, fallback) => err?.response?.data?.message || fallback

export default function VerifyPhoneModal({ isOpen, onClose, currentPhone }) {
  const qc = useQueryClient()
  const [phone, setPhone] = useState(currentPhone ?? '')
  const [code, setCode] = useState('')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  function close() {
    setCode('')
    setSent(false)
    setError('')
    onClose()
  }

  const { mutate: sendCode, isPending: sending } = useMutation({
    mutationFn: () => authService.requestPhoneCode({ phone: normalizePhone(phone) }),
    onSuccess: () => { setError(''); setSent(true) },
    onError: (err) => setError(message(err, 'Could not send the code. Please try again.')),
  })

  const { mutate: verify, isPending: verifying } = useMutation({
    mutationFn: () => authService.verifyPhoneCode({ code: code.trim() }),
    onSuccess: () => {
      // Both caches carry the number: settings renders it, ['me'] is what the
      // rest of the app reads.
      qc.invalidateQueries({ queryKey: ['user-settings'] })
      qc.invalidateQueries({ queryKey: ['me'] })
      qc.invalidateQueries({ queryKey: ['points'] })
      toast.success('Verified', 'Your phone number is confirmed')
      close()
    },
    onError: (err) => setError(message(err, 'That code did not work. Please try again.')),
  })

  const phoneOk = isValidPhone(phone)

  return (
    <Modal isOpen={isOpen} onClose={close} title="Verify your phone" size="sm">
      {!sent ? (
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            We&apos;ll text you a 6-digit code. Renters and owners see a verified
            badge, and it&apos;s how we keep one number to one account.
          </p>
          <div>
            <label htmlFor="verify-phone" className="block text-xs font-medium text-slate-500 mb-1">
              Mobile number
            </label>
            <input
              id="verify-phone"
              type="tel"
              inputMode="numeric"
              autoComplete="tel"
              value={phone}
              onChange={(e) => { setPhone(e.target.value); setError('') }}
              placeholder="9876543210"
              className={INPUT}
            />
            <p className="text-[11px] text-slate-500 mt-1">Indian mobile numbers only, no country code needed.</p>
          </div>

          {error && <p className="text-xs text-red-600">{error}</p>}

          <button
            onClick={() => sendCode()}
            disabled={!phoneOk || sending}
            className="w-full min-h-[44px] px-4 py-3 bg-[#111111] text-white text-sm font-semibold rounded-xl hover:bg-[#2a2a2a] disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {sending ? 'Sending…' : 'Send code'}
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            Enter the code we sent to <span className="font-semibold text-slate-800">{normalizePhone(phone)}</span>.
            It expires in 10 minutes.
          </p>
          <div>
            <label htmlFor="verify-code" className="block text-xs font-medium text-slate-500 mb-1">
              6-digit code
            </label>
            <input
              id="verify-code"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={code}
              onChange={(e) => { setCode(e.target.value.replace(/\D/g, '')); setError('') }}
              placeholder="123456"
              className={`${INPUT} font-mono tracking-[0.3em] text-center`}
            />
          </div>

          {error && <p className="text-xs text-red-600">{error}</p>}

          <button
            onClick={() => verify()}
            disabled={code.length !== 6 || verifying}
            className="w-full min-h-[44px] px-4 py-3 bg-[#111111] text-white text-sm font-semibold rounded-xl hover:bg-[#2a2a2a] disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {verifying ? 'Verifying…' : 'Verify'}
          </button>

          <div className="flex items-center justify-between">
            <button
              onClick={() => { setSent(false); setCode(''); setError('') }}
              className="text-xs font-medium text-slate-600 hover:text-slate-900"
            >
              Change number
            </button>
            <button
              onClick={() => sendCode()}
              disabled={sending}
              className="text-xs font-medium text-brand-600 disabled:opacity-60"
            >
              {sending ? 'Sending…' : 'Send again'}
            </button>
          </div>
        </div>
      )}
    </Modal>
  )
}
