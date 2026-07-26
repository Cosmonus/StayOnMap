import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { X } from 'lucide-react'
import { CITY_LIST_LABEL, CITIES } from '@/config/cities'
import { usePlatformStats } from '@hooks/usePlatformStats'

const SEEN_KEY = 'som_intro_seen'

export default function IntroPopup() {
  const alreadySeen = typeof window !== 'undefined' && localStorage.getItem(SEEN_KEY)
  const [visible, setVisible] = useState(!alreadySeen)
  const navigate = useNavigate()
  const { totalActive, isLoading } = usePlatformStats()

  const stats = [
    { icon: '🏠', text: `${totalActive}`, sub: `verified rentals across ${CITIES.length} cities`, loading: isLoading },
    { icon: '₹0', text: 'Zero',   sub: 'brokerage — free for tenants, always' },
    { icon: '✓',  text: '100%',   sub: 'direct owner listings, no middlemen' },
  ]

  function dismiss() {
    localStorage.setItem(SEEN_KEY, '1')
    setVisible(false)
  }

  function start() {
    dismiss()
    navigate('/properties')
  }

  if (!visible) return null

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center px-4 pb-4 sm:pb-0"
      style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)' }}
      onClick={dismiss}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm rounded-3xl p-6 relative overflow-hidden animate-slide-up"
        style={{ background: '#0F1117', boxShadow: '0 32px 80px rgba(0,0,0,0.7)' }}
      >
        {/* Close */}
        <button
          onClick={dismiss}
          className="absolute top-4 right-4 w-7 h-7 rounded-full flex items-center justify-center transition-colors hover:bg-white/10"
        >
          <X size={12} color="white" strokeWidth={2.5} />
        </button>

        {/* Badge */}
        <div
          className="inline-flex items-center gap-2 px-3 py-1 rounded-full mb-5"
          style={{ background: 'rgba(59,111,232,0.18)', border: '1px solid rgba(59,111,232,0.35)' }}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-brand-400 animate-pulse" />
          <span className="text-[11px] font-bold text-brand-400 uppercase tracking-widest">Broker-free rentals</span>
        </div>

        {/* Headline */}
        <h2 className="font-display font-bold text-2xl text-white leading-tight mb-2">
          Find your place.<br />
          <span className="text-brand-400">No broker. No fee.</span>
        </h2>
        <p className="text-sm leading-relaxed mb-5" style={{ color: 'rgba(255,255,255,0.5)' }}>
          Direct from owners in {CITY_LIST_LABEL}. Real listings, real prices.
        </p>

        {/* Stats */}
        <div
          className="rounded-2xl p-4 mb-5 flex flex-col gap-3"
          style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}
        >
          {stats.map(({ icon, text, sub, loading }) => (
            <div key={sub} className="flex items-center gap-3">
              <span className="text-base leading-none w-5 text-center">{icon}</span>
              <span className="text-sm" style={{ color: 'rgba(255,255,255,0.8)' }}>
                {loading
                  ? <span className="inline-block h-3 w-6 rounded bg-white/10 animate-pulse align-middle" />
                  : <strong className="text-white font-bold">{text}</strong>}{' '}
                <span style={{ color: 'rgba(255,255,255,0.4)' }}>{sub}</span>
              </span>
            </div>
          ))}
        </div>

        {/* Legal */}
        <p className="text-[11px] text-center mb-4" style={{ color: 'rgba(255,255,255,0.25)' }}>
          By continuing you agree to our{' '}
          <Link to="/rules" onClick={dismiss} className="underline" style={{ color: 'rgba(255,255,255,0.4)' }}>Community Rules</Link>
          {' '}and{' '}
          <span className="underline" style={{ color: 'rgba(255,255,255,0.4)', cursor: 'default' }}>Terms of Use</span>.
        </p>

        {/* CTAs */}
        <div className="flex gap-2">
          <button
            onClick={() => {
              const text = `🏠 Found this! StayOnMap — rent directly from owners in ${CITY_LIST_LABEL}. No broker. No commission. Check it out 👉 ${window.location.origin}`
              window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank')
            }}
            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl text-sm font-bold text-white bg-[#25D366] hover:bg-[#1ebe5d] transition-colors"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="white">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
            </svg>
            Share
          </button>
          <button
            onClick={start}
            className="flex-1 py-3 rounded-2xl text-sm font-bold text-white transition-all hover:opacity-90"
            style={{ background: 'linear-gradient(135deg, #3b6fe8 0%, #2249b8 100%)', boxShadow: '0 4px 20px rgba(59,111,232,0.4)' }}
          >
            Find a home →
          </button>
        </div>
      </div>
    </div>
  )
}
