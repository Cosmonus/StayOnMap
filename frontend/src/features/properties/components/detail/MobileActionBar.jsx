import { Navigation } from 'lucide-react'
import { formatPrice } from '@utils/format'
import { useAuth } from '@features/auth/hooks/useAuth'
import { useUiStore } from '@store/uiStore'

// ── Mobile fixed bottom bar (public page only) ───────────────────────────────
export default function MobileActionBar({ property, directionsUrl }) {
  const { user } = useAuth()
  const openLoginModal = useUiStore((s) => s.openLoginModal)

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 flex items-center gap-3 border-t border-slate-200 bg-white px-4 py-3 shadow-lg lg:hidden">
      <div className="min-w-0 flex-none">
        <p className="text-lg font-bold text-slate-900">{formatPrice(property)}</p>
        {!property.brokerage && <p className="text-[11px] font-semibold text-brand-700">Zero brokerage</p>}
      </div>
      {directionsUrl && (
        <a
          href={directionsUrl}
          target="_blank"
          rel="noreferrer"
          aria-label="Directions to this property"
          className="flex h-11 w-11 flex-none items-center justify-center rounded-xl border border-slate-200 bg-white transition-colors hover:bg-slate-50"
        >
          <Navigation className="h-4 w-4 text-brand-600" strokeWidth={2} />
        </a>
      )}
      {user ? (
        <button
          onClick={() => document.getElementById('appointment-form-mobile')?.scrollIntoView({ behavior: 'smooth', block: 'center' })}
          className="flex-1 rounded-xl bg-brand-600 px-6 py-3 text-sm font-bold text-white transition-colors hover:bg-brand-700"
        >
          Request a visit
        </button>
      ) : (
        <button
          onClick={openLoginModal}
          className="flex-1 rounded-xl bg-[#111111] px-6 py-3 text-sm font-bold text-white transition-colors hover:bg-[#2a2a2a]"
        >
          Sign in to contact
        </button>
      )}
    </div>
  )
}
