import { Link } from 'react-router-dom'
import { Check, UserRound, ArrowRight } from 'lucide-react'

// Mirror of backend requireCompleteProfile.middleware.js's REQUIRED list.
// WHICH rows are missing comes from the server (`missingProfileFields` on
// GET /auth/me — computed by that same middleware, so the two can't
// disagree); this list only supplies the display order and the fix hints.
const REQUIRED = [
  { field: 'name',  label: 'Your name',      hint: 'Add it under Settings → Profile' },
  { field: 'phone', label: 'Phone number',   hint: 'Add it under Settings → Profile' },
  { field: 'city',  label: 'City',           hint: 'Choose it under Settings → Profile' },
  { field: 'email', label: 'Verified email', hint: 'Tap Verify in Settings — check your inbox for the verification link, or sign in once with an emailed code' },
]

function ChecklistRow({ label, hint, done }) {
  return (
    <li className="flex items-start gap-3 px-4 py-3">
      <span
        className={`mt-0.5 w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${
          done ? 'bg-brand-600' : 'border-2 border-slate-300'
        }`}
      >
        {done && <Check size={12} color="#fff" strokeWidth={3} />}
      </span>
      <div className="min-w-0">
        <p className={`text-sm font-semibold ${done ? 'text-slate-500 line-through' : 'text-slate-800'}`}>
          {label}
        </p>
        {!done && <p className="text-xs text-slate-500 mt-0.5">{hint}</p>}
      </div>
    </li>
  )
}

// Front door for the same rule POST /properties enforces server-side
// (requireCompleteProfile): say what's left BEFORE the wizard, never let
// someone build a whole listing that can only 403 at publish.
export default function ProfileGate({ missing }) {
  const missingFields = new Set(missing.map((m) => m.field))

  return (
    <div className="max-w-md mx-auto text-center py-12">
      <div className="w-14 h-14 rounded-2xl bg-brand-50 mx-auto mb-4 flex items-center justify-center text-brand-600">
        <UserRound size={24} strokeWidth={2} />
      </div>
      <h1 className="font-display font-bold text-2xl text-slate-900 tracking-tight">
        Finish your profile to start hosting
      </h1>
      <p className="text-sm text-slate-500 leading-relaxed mt-3">
        Renters need to know who they&apos;re talking to. Complete these once and
        you can list as many properties as you like.
      </p>

      <ul className="mt-7 bg-white rounded-2xl border border-slate-200 divide-y divide-slate-100 text-left">
        {REQUIRED.map((item) => (
          <ChecklistRow
            key={item.field}
            label={item.label}
            hint={item.hint}
            done={!missingFields.has(item.field)}
          />
        ))}
      </ul>

      <Link
        to="/user?tab=settings"
        className="mt-7 inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-[#111111] hover:bg-[#2a2a2a] text-white text-sm font-bold no-underline transition-colors"
      >
        Complete my profile
        <ArrowRight size={14} strokeWidth={2.5} />
      </Link>
    </div>
  )
}
