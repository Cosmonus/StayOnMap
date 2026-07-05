import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { MapPin, ChevronDown, Search, Check } from 'lucide-react'
import { CITIES } from '@/config/cities'
import { usePlatformStats } from '@hooks/usePlatformStats'

export default function CityDropdown({ value, onChange }) {
  const { byCity, isLoading } = usePlatformStats()
  const [open, setOpen]     = useState(false)
  const [search, setSearch] = useState('')
  const [pos, setPos]       = useState({ top: 0, left: 0, width: 0 })
  const triggerRef          = useRef(null)
  const panelRef            = useRef(null)

  useEffect(() => {
    if (open && triggerRef.current) {
      const r = triggerRef.current.getBoundingClientRect()
      setPos({ top: r.bottom + 6, left: r.left, width: r.width })
    }
    if (!open) setSearch('')
  }, [open])

  useEffect(() => {
    function onKey(e)     { if (e.key === 'Escape') setOpen(false) }
    function onOutside(e) {
      if (
        triggerRef.current && !triggerRef.current.contains(e.target) &&
        panelRef.current   && !panelRef.current.contains(e.target)
      ) setOpen(false)
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('mousedown', onOutside)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('mousedown', onOutside)
    }
  }, [])

  const filtered = search.trim()
    ? CITIES.filter((c) =>
        c.name.toLowerCase().includes(search.toLowerCase()) ||
        c.state.toLowerCase().includes(search.toLowerCase())
      )
    : CITIES

  const groupedFiltered = filtered.reduce((acc, city) => {
    if (!acc[city.state]) acc[city.state] = []
    acc[city.state].push(city)
    return acc
  }, {})

  const selectedCity = CITIES.find((c) => c.name === value)

  return (
    <div ref={triggerRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={[
          'w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg border text-sm transition-all duration-150',
          open
            ? 'border-[#111111] bg-white ring-2 ring-black/8'
            : 'border-slate-200 bg-slate-50 hover:border-slate-400',
        ].join(' ')}
      >
        <div className="flex items-center gap-2 min-w-0">
          <MapPin size={13} fill={value ? '#f4511e' : '#94a3b8'} stroke="none" className="shrink-0" />
          <div className="text-left min-w-0">
            {selectedCity ? (
              <>
                <span className="block text-sm font-semibold text-slate-900 truncate">{selectedCity.name}</span>
                <span className="block text-xs text-slate-400 truncate">{selectedCity.state}</span>
              </>
            ) : (
              <span className="text-sm text-slate-400">All Cities</span>
            )}
          </div>
        </div>
        <ChevronDown
          size={14}
          strokeWidth={2.5}
          className={`shrink-0 text-slate-400 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && createPortal(
        <div
          ref={panelRef}
          data-dropdown-portal
          style={{ position: 'fixed', top: pos.top, left: pos.left, width: pos.width, zIndex: 9999 }}
          className="bg-white rounded-xl shadow-float border border-slate-200 overflow-hidden"
        >
          <div className="p-2 border-b border-slate-100">
            <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-slate-50 border border-slate-200 focus-within:border-[#111111] transition">
              <Search size={12} stroke="#94a3b8" strokeWidth={2} className="shrink-0" />
              <input
                autoFocus
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search city or state…"
                className="flex-1 text-xs text-slate-700 placeholder-slate-400 bg-transparent outline-none"
              />
            </div>
          </div>

          <div className="max-h-52 overflow-y-auto">
            <button
              type="button"
              onClick={() => { onChange(''); setOpen(false) }}
              className={[
                'w-full flex items-center justify-between px-3 py-2.5 text-sm transition-colors',
                !value ? 'bg-brand-50 text-brand-700 font-semibold' : 'text-slate-600 hover:bg-slate-50',
              ].join(' ')}
            >
              <span>All Cities</span>
              {!value && <Check size={13} strokeWidth={2.5} />}
            </button>

            {Object.entries(groupedFiltered).map(([state, cities]) => (
              <div key={state}>
                <p className="px-3 pt-2 pb-1 text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-slate-50 border-y border-slate-100">
                  {state}
                </p>
                {cities.map((city) => {
                  const isSelected = value === city.name
                  return (
                    <button
                      key={city.name}
                      type="button"
                      onClick={() => { onChange(city.name); setOpen(false) }}
                      className={[
                        'w-full flex items-center justify-between gap-3 px-3 py-2.5 transition-colors',
                        isSelected ? 'bg-brand-50 text-brand-700' : 'text-slate-700 hover:bg-slate-50',
                      ].join(' ')}
                    >
                      <div className="flex items-center gap-2">
                        <MapPin size={11} fill={isSelected ? '#f4511e' : '#cbd5e1'} stroke="none" className="shrink-0" />
                        <span className={`text-sm ${isSelected ? 'font-semibold' : 'font-medium'}`}>{city.name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-400">{isLoading ? '…' : `${byCity[city.name] ?? 0} listings`}</span>
                        {isSelected && <Check size={13} stroke="#f4511e" strokeWidth={2.5} />}
                      </div>
                    </button>
                  )
                })}
              </div>
            ))}

            {filtered.length === 0 && (
              <p className="px-3 py-4 text-xs text-slate-400 text-center">No cities match &ldquo;{search}&rdquo;</p>
            )}
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}
