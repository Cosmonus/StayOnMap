import { useState, useEffect } from 'react'
import { useMapStore } from '@store/mapStore'
import { useFilterStore } from '@store/filterStore'
import PropertyPopup from './PropertyPopup'
import CityDropdown from '@features/search/components/CityDropdown'
import AreaInput from '@features/search/components/AreaInput'

const BHK_OPTIONS = [
  { label: '1 BHK', value: 1 },
  { label: '2 BHK', value: 2 },
  { label: '3 BHK', value: 3 },
  { label: '4+',    value: 4 },
]

const LAYERS = [
  { key: 'metro',       label: 'Metro lines',  sub: 'Stations & routes',   color: '#7c3aed' },
  { key: 'itCorridors', label: 'IT corridors', sub: 'Tech parks & hubs',   color: '#2563eb' },
  { key: 'traffic',     label: 'Live traffic', sub: 'Real-time congestion', color: '#16a34a' },
]

function LayerIcon({ layerKey, color }) {
  const p = { width: 17, height: 17, viewBox: '0 0 24 24', fill: 'none', stroke: color, strokeWidth: '1.9', strokeLinecap: 'round', strokeLinejoin: 'round' }
  if (layerKey === 'metro') return (
    <svg {...p}>
      <rect x="5" y="5" width="14" height="13" rx="2"/>
      <path d="M5 10h14"/>
      <circle cx="8.5" cy="14.5" r="1" fill={color} stroke="none"/>
      <circle cx="15.5" cy="14.5" r="1" fill={color} stroke="none"/>
      <path d="M8 18l-1.5 2M16 18l1.5 2"/>
    </svg>
  )
  if (layerKey === 'itCorridors') return (
    <svg {...p}>
      <path d="M3 21h18M3 8l9-5 9 5M4 8v13M20 8v13M9 21v-6h6v6"/>
    </svg>
  )
  if (layerKey === 'floodZones') return (
    <svg {...p}>
      <path d="M12 2v8M8 6l4-4 4 4"/>
      <path d="M3 14c1.5-2 3-2 4.5 0s3 2 4.5 0 3-2 4.5 0 3 2 4.5 0"/>
      <path d="M3 18c1.5-2 3-2 4.5 0s3 2 4.5 0 3-2 4.5 0 3 2 4.5 0"/>
    </svg>
  )
  if (layerKey === 'traffic') return (
    <svg {...p}>
      <rect x="8" y="2" width="8" height="20" rx="2"/>
      <circle cx="12" cy="7"  r="1.8" fill={color} stroke="none"/>
      <circle cx="12" cy="12" r="1.8" fill={color} stroke="none"/>
      <circle cx="12" cy="17" r="1.8" fill={color} stroke="none"/>
    </svg>
  )
  return null
}

function Chevron({ open }) {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"
      className="text-slate-400 transition-transform duration-300"
      style={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }}
    >
      <path d="M6 9l6 6 6-6"/>
    </svg>
  )
}

function SectionHeader({ icon, label, sub, open, badge, badgeColor, onClick }) {
  return (
    <button
      onClick={onClick}
      className={[
        'w-full flex items-center gap-3 px-4 py-3.5 text-left transition-all duration-200',
        open ? 'bg-slate-50/80' : 'hover:bg-slate-50/60',
      ].join(' ')}
    >
      <div
        className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-all duration-200"
        style={{ background: open ? `${badgeColor}18` : '#f1f5f9' }}
      >
        {icon(open ? badgeColor : '#94a3b8')}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className={`text-sm font-semibold transition-colors duration-200 ${open ? 'text-slate-900' : 'text-slate-700'}`}>
            {label}
          </span>
          {badge > 0 && (
            <span
              className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1.5 rounded-full text-white font-bold leading-none transition-all duration-200"
              style={{ fontSize: 10, background: badgeColor }}
            >
              {badge}
            </span>
          )}
        </div>
        <p className="text-[11px] text-slate-400 mt-0.5 leading-tight">{sub}</p>
      </div>

      <Chevron open={open} />
    </button>
  )
}

export default function MapRightPanel({ topClass = 'top-20' }) {
  const selectedPinId  = useMapStore((s) => s.selectedPinId)
  const activeLayers   = useMapStore((s) => s.activeLayers)
  const toggleLayer    = useMapStore((s) => s.toggleLayer)
  const { filters, setFilters, resetFilters } = useFilterStore()

  const [open, setOpen]   = useState(null)
  const [draft, setDraft] = useState({ city: '', area: '', bhk: [] })

  useEffect(() => {
    setDraft({ city: filters.city ?? '', area: filters.area ?? '', bhk: filters.bhk ?? [] })
  }, [filters.city, filters.area, filters.bhk]) // eslint-disable-line react-hooks/exhaustive-deps

  function toggleSection(s) { setOpen((o) => (o === s ? null : s)) }

  function toggleBhk(val) {
    setDraft((d) => ({
      ...d,
      bhk: d.bhk.includes(val) ? d.bhk.filter((v) => v !== val) : [...d.bhk, val],
    }))
  }

  function handleApply() {
    setFilters({ city: draft.city, area: draft.area, bhk: draft.bhk })
    setOpen(null)
  }

  function handleReset() {
    resetFilters()
    setDraft({ city: '', area: '', bhk: [] })
    useMapStore.getState().setSearchedPlace?.(null)
  }

  const activeFilterCount = [draft.city, draft.area, ...draft.bhk].filter(Boolean).length
  const activeLayerCount  = Object.values(activeLayers).filter(Boolean).length

  return (
    <div
      className={`hidden md:flex flex-col fixed right-6 ${topClass} z-20 w-80 gap-3 overflow-y-auto`}
      style={{ maxHeight: 'calc(100vh - 6rem)', scrollbarWidth: 'none' }}
    >
      {/* ── Accordion card ── */}
      <div className="bg-white rounded-2xl overflow-hidden"
        style={{ boxShadow: '0 4px 24px rgba(0,0,0,0.10), 0 1px 4px rgba(0,0,0,0.06)' }}>

        {/* Filter Rentals */}
        <SectionHeader
          open={open === 'filters'}
          label="Filter rentals"
          sub="City · Area · Bedrooms"
          badge={activeFilterCount}
          badgeColor="#0284c7"
          onClick={() => toggleSection('filters')}
          icon={(color) => (
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
            </svg>
          )}
        />

        <div
          className="overflow-hidden transition-all duration-300 ease-in-out"
          style={{ maxHeight: open === 'filters' ? '420px' : '0' }}
        >
          <div className="border-t border-slate-100 px-4 pt-4 pb-4 flex flex-col gap-4">
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">City</label>
              <CityDropdown
                value={draft.city}
                onChange={(val) => setDraft((d) => ({ ...d, city: val, area: '' }))}
              />
            </div>

            <AreaInput
              value={draft.area}
              city={draft.city}
              onChange={(val) => setDraft((d) => ({ ...d, area: val }))}
            />

            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Bedrooms</label>
              <div className="flex gap-1.5">
                {BHK_OPTIONS.map(({ label, value }) => {
                  const sel = draft.bhk.includes(value)
                  return (
                    <button
                      key={value}
                      onClick={() => toggleBhk(value)}
                      className="flex-1 py-2 text-xs font-semibold rounded-xl border transition-all duration-150"
                      style={sel
                        ? { background: 'linear-gradient(135deg,#1e293b,#334155)', color: '#fff', borderColor: 'transparent', boxShadow: '0 2px 8px rgba(0,0,0,0.18)' }
                        : { background: '#f8fafc', color: '#64748b', borderColor: '#e2e8f0' }
                      }
                    >
                      {label}
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="flex gap-2 pt-1">
              {activeFilterCount > 0 && (
                <button
                  onClick={handleReset}
                  className="px-3 py-2.5 text-xs font-semibold text-slate-500 border border-slate-200 rounded-xl hover:bg-slate-50 hover:border-slate-300 transition-all"
                >
                  Reset
                </button>
              )}
              <button
                onClick={handleApply}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold transition-colors duration-150 active:scale-[0.98]"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
                </svg>
                {draft.city ? `Show in ${draft.city}` : 'Show matches'}
              </button>
            </div>
          </div>
        </div>

        {/* Divider */}
        <div className="mx-4 border-t border-slate-100" />

        {/* Map Layers */}
        <SectionHeader
          open={open === 'layers'}
          label="Map layers"
          sub="Metro · IT · Traffic"
          badge={activeLayerCount}
          badgeColor="#7c3aed"
          onClick={() => toggleSection('layers')}
          icon={(color) => (
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="12 2 2 7 12 12 22 7 12 2"/>
              <polyline points="2 17 12 22 22 17"/>
              <polyline points="2 12 12 17 22 12"/>
            </svg>
          )}
        />

        <div
          className="overflow-hidden transition-all duration-300 ease-in-out"
          style={{ maxHeight: open === 'layers' ? '280px' : '0' }}
        >
          <div className="border-t border-slate-100">
            {LAYERS.map((layer) => {
              const on = activeLayers[layer.key]
              return (
                <button
                  key={layer.key}
                  onClick={() => toggleLayer(layer.key)}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left transition-all duration-150"
                  style={on
                    ? { background: `${layer.color}08`, borderLeft: `3px solid ${layer.color}` }
                    : { background: 'transparent', borderLeft: '3px solid transparent', paddingLeft: '13px' }
                  }
                >
                  <div
                    className="flex items-center justify-center w-9 h-9 rounded-xl shrink-0 transition-all duration-200"
                    style={{ background: on ? `${layer.color}18` : '#f1f5f9' }}
                  >
                    <LayerIcon layerKey={layer.key} color={on ? layer.color : '#94a3b8'} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-semibold leading-tight transition-colors duration-150 ${on ? 'text-slate-900' : 'text-slate-500'}`}>
                      {layer.label}
                    </p>
                    <p className="text-[11px] text-slate-400 leading-tight mt-0.5">{layer.sub}</p>
                  </div>
                  <div
                    className="shrink-0 w-9 h-5 rounded-full relative transition-all duration-200"
                    style={{ background: on ? layer.color : '#e2e8f0', boxShadow: on ? `0 0 0 3px ${layer.color}30` : 'none' }}
                  >
                    <span
                      className="absolute top-1 w-3 h-3 bg-white rounded-full shadow transition-transform duration-200"
                      style={{ transform: on ? 'translateX(19px)' : 'translateX(2px)' }}
                    />
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* Property card */}
      {selectedPinId && <PropertyPopup />}
    </div>
  )
}
