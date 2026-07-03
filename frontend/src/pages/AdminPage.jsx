import { useState, useEffect, useCallback, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Doughnut, Line } from 'react-chartjs-2'
import {
  Chart as ChartJS,
  ArcElement, Tooltip, Legend,
  CategoryScale, LinearScale, BarElement,
  LineElement, PointElement, Filler,
} from 'chart.js'
import { adminService } from '@services/admin.service'
import { AmenityIcon } from '@components/common/AmenityIcon'
import { googleMapsReady, createHtmlMarker } from '@lib/googleMaps'
import { CITIES } from '@/config/cities'
import CityDropdown from '@features/search/components/CityDropdown'
import AreaInput from '@features/search/components/AreaInput'

ChartJS.register(
  ArcElement, Tooltip, Legend,
  CategoryScale, LinearScale, BarElement,
  LineElement, PointElement, Filler,
)
import TrustBadge       from '@components/common/TrustBadge'
import TrustScoreWidget from '@features/trust/components/TrustScoreWidget'
import ReviewsSection   from '@features/reviews/components/ReviewsSection'
import PropertyStatusPill from '@components/common/PropertyStatusPill'
import UnifiedSidebar from '@components/layout/UnifiedSidebar'
import AdminMonitorSection from '@features/admin/components/AdminMonitorSection'

// ── Shared chart card shell ────────────────────────────────────────────────
function ChartCard({ title, value, footer, children }) {
  return (
    <div className="bg-white border border-slate-100 rounded-2xl flex flex-col overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 shrink-0">
        <p className="text-sm font-semibold text-slate-700">{title}</p>
        {value !== undefined && (
          <span className="text-xl font-bold text-slate-900">{value.toLocaleString('en-IN')}</span>
        )}
      </div>
      <div className="flex-1 px-4 py-3">{children}</div>
      {footer && (
        <div className="px-5 py-3 border-t border-slate-100 shrink-0">
          <p className="text-xs text-slate-400">{footer}</p>
        </div>
      )}
    </div>
  )
}

// ── Overview charts ────────────────────────────────────────────────────────
const CHART_TOOLTIP = {
  backgroundColor: '#fff',
  borderColor: '#e2e8f0',
  borderWidth: 1,
  titleColor: '#1e293b',
  bodyColor: '#64748b',
  padding: 10,
  cornerRadius: 10,
  boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
}

function PropertyDonut({ data }) {
  const active    = data?.properties?.active    ?? 0
  const pending   = data?.properties?.pending   ?? 0
  const suspended = data?.properties?.suspended ?? 0
  const total     = data?.properties?.total     ?? 0
  const other     = Math.max(0, total - active - pending - suspended)

  if (total === 0) {
    return <div className="flex items-center justify-center h-48 text-sm text-slate-300">No properties yet</div>
  }

  const chartData = {
    labels: ['Active', 'Pending', 'Suspended', 'Other'],
    datasets: [{
      data: [active, pending, suspended, other],
      backgroundColor: ['#22c55e', '#eab308', '#ef4444', '#cbd5e1'],
      borderWidth: 0,
      hoverOffset: 4,
    }],
  }

  const options = {
    cutout: '68%',
    plugins: {
      legend: { display: false },
      tooltip: { ...CHART_TOOLTIP, callbacks: { label: ctx => ` ${ctx.label}: ${ctx.parsed}` } },
    },
    animation: { duration: 600 },
  }

  const legend = [
    { label: 'Active',    value: active,    color: '#22c55e' },
    { label: 'Pending',   value: pending,   color: '#eab308' },
    { label: 'Suspended', value: suspended, color: '#ef4444' },
    { label: 'Other',     value: other,     color: '#cbd5e1' },
  ].filter(s => s.value > 0)

  return (
    <div className="flex flex-col gap-3">
      <div className="relative mx-auto w-36 h-36">
        <Doughnut data={chartData} options={options} />
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="text-3xl font-bold text-slate-900">{total}</span>
          <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-widest">Total</span>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-2">
        {legend.map(s => (
          <div key={s.label} className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: s.color }} />
            <span className="text-xs text-slate-500 flex-1 truncate">{s.label}</span>
            <span className="text-xs font-bold text-slate-800">{s.value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// Fills in all 12 months even if some have 0 signups
function buildMonthlyLabels() {
  const now = new Date()
  return Array.from({ length: 12 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - 11 + i, 1)
    return {
      key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
      label: d.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' }),
    }
  })
}

function TotalUsersChart({ monthly = [] }) {
  const months = buildMonthlyLabels()
  const countByMonth = Object.fromEntries(monthly.map(m => [m.month, m.count]))
  const values = months.map(m => countByMonth[m.key] ?? 0)

  const chartData = {
    labels: months.map(m => m.label),
    datasets: [{
      data: values,
      borderColor: '#0ea5e9',
      backgroundColor: 'rgba(14,165,233,0.10)',
      borderWidth: 2,
      pointRadius: 3,
      pointBackgroundColor: '#0ea5e9',
      pointBorderColor: '#fff',
      pointBorderWidth: 2,
      tension: 0.4,
      fill: true,
    }],
  }

  const options = {
    responsive: true,
    plugins: {
      legend: { display: false },
      tooltip: {
        ...CHART_TOOLTIP,
        callbacks: { label: ctx => ` ${ctx.parsed.y} new users` },
      },
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { color: '#94a3b8', font: { size: 11 } },
        border: { display: false },
      },
      y: {
        grid: { color: '#f8fafc' },
        ticks: { color: '#94a3b8', font: { size: 11 }, precision: 0 },
        border: { display: false },
        beginAtZero: true,
      },
    },
    animation: { duration: 600 },
  }

  return (
    <div className="h-40">
      <Line data={chartData} options={{ ...options, maintainAspectRatio: false }} />
    </div>
  )
}

function MetricBar({ label, value, max, color = 'bg-brand-500' }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0
  return (
    <div>
      <div className="flex justify-between items-center mb-1.5">
        <span className="text-xs text-slate-500">{label}</span>
        <span className="text-xs font-bold text-slate-800">{value}</span>
      </div>
      <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

// ── Section: Overview ──────────────────────────────────────────────────────
function OverviewSection() {
  const { data, isLoading } = useQuery({
    queryKey: ['admin-analytics'],
    queryFn: () => adminService.analytics().then(r => r.data),
  })

  if (isLoading) {
    return (
      <div className="space-y-5">
        <div className="h-7 bg-slate-100 rounded-xl w-28 animate-pulse" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {[1, 2, 3].map(i => <div key={i} className="h-52 bg-slate-100 rounded-2xl animate-pulse" />)}
        </div>
      </div>
    )
  }

  const propTotal = data?.properties?.total ?? 0
  const apptTotal = Math.max(1, data?.appointments?.total ?? 0)
  const rptTotal  = Math.max(1, data?.reports?.total ?? 0)

  const now = new Date()
  const monthRange = `${new Date(now.getFullYear(), now.getMonth() - 11, 1).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })} – ${now.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}`

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Overview</h1>
        <p className="text-sm text-slate-400 mt-0.5">Platform health at a glance.</p>
      </div>

      {/* Row 1: Total Users full width */}
      <ChartCard
        title="Total Users"
        value={data?.users?.total ?? 0}
        footer={`Monthly signups · ${monthRange}`}
      >
        <TotalUsersChart monthly={data?.users?.monthly ?? []} />
      </ChartCard>

      {/* Row 2: Property distribution + Platform health */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

        <ChartCard
          title="Property Distribution"
          value={propTotal}
          footer="Breakdown by current status"
        >
          <PropertyDonut data={data} />
        </ChartCard>

        <ChartCard
          title="Platform Health"
          footer="Each bar shows count relative to total"
        >
          <div className="space-y-3 pt-1">
            <MetricBar label="Open Reports"          value={data?.reports?.open         ?? 0} max={rptTotal}             color="bg-orange-400" />
            <MetricBar label="Critical Reports"      value={data?.reports?.critical     ?? 0} max={rptTotal}             color="bg-red-500" />
            <MetricBar label="Pending Appointments"  value={data?.appointments?.pending  ?? 0} max={apptTotal}           color="bg-brand-500" />
            <MetricBar label="Pending Verifications" value={data?.verificationsPending   ?? 0} max={Math.max(1, propTotal)} color="bg-indigo-400" />
            <MetricBar label="High Risk Properties"  value={data?.risk?.highRisk         ?? 0} max={Math.max(1, propTotal)} color="bg-orange-500" />
            <MetricBar label="Suspicious"            value={data?.risk?.suspicious       ?? 0} max={Math.max(1, propTotal)} color="bg-red-400" />
          </div>
        </ChartCard>

      </div>
    </div>
  )
}

// ── Pin helpers (same style as user map) ──────────────────────────────────
const TYPE_SHORT = {
  APARTMENT: 'Apt', HOUSE: 'House', VILLA: 'Villa',
  PG: 'PG', INDEPENDENT_HOUSE: 'Indep.', COMMERCIAL: 'Comm.',
}

function makeMapPin(pin, selected) {
  const rent  = `₹${(Number(pin.rent) / 1000).toFixed(0)}K`
  const type  = TYPE_SHORT[pin.type] ?? ''
  const label = type ? `${rent} · ${type}` : rent
  const el    = document.createElement('div')
  el.setAttribute('aria-label', `Property at ${rent}/mo`)
  el.style.cssText = `
    display:inline-flex;align-items:center;padding:4px 10px;
    border-radius:999px;font-size:12px;font-weight:600;
    font-family:Inter,sans-serif;white-space:nowrap;cursor:pointer;
    box-shadow:0 2px 8px rgba(0,0,0,0.18);
    transition:transform 150ms ease,background 150ms ease,color 150ms ease;
    transform-origin:center bottom;will-change:transform;user-select:none;
    ${selected
      ? 'background:#111111;color:#fff;border:2px solid #111111;'
      : 'background:#fff;color:#0f172a;border:2px solid #e2e8f0;'}
  `
  el.textContent = label
  el.addEventListener('mouseenter', () => { el.style.transform = 'translateZ(0) scale(1.08)' })
  el.addEventListener('mouseleave', () => { el.style.transform = 'translateZ(0) scale(1)' })
  return el
}

function applyPinSelected(el, selected) {
  if (!el) return
  el.style.background  = selected ? '#111111' : '#fff'
  el.style.color       = selected ? '#fff'     : '#0f172a'
  el.style.borderColor = selected ? '#111111'  : '#e2e8f0'
}

// ── Admin property popup (right panel, mirrors user PropertyPopup) ──────────
const BHK_OPTIONS_MAP = [
  { label: '1 BHK', value: 1 }, { label: '2 BHK', value: 2 },
  { label: '3 BHK', value: 3 }, { label: '4+ BHK', value: 4 },
]

const STATUS_FILTERS = [
  { value: '', label: 'All' },       { value: 'ACTIVE', label: 'Active' },
  { value: 'PENDING', label: 'Pending' }, { value: 'DRAFT', label: 'Draft' },
  { value: 'INACTIVE', label: 'Inactive' },
  { value: 'SUSPENDED', label: 'Suspended' }, { value: 'REJECTED', label: 'Rejected' },
]

function AdminPropertyPopup({ property, isLoading, onClose, onViewFull, onApprove, onSuspend, onReject }) {
  const [imgIdx, setImgIdx] = useState(0)
  const images    = property?.images ?? []
  const amenities = property?.amenities ?? []
  const bhkLabel  = property?.type === 'PG'
    ? `${property.sharing}-Sharing PG`
    : property?.bhk ? `${property.bhk} BHK` : null

  return (
    <div className="w-full bg-white rounded-2xl shadow-xl border border-slate-100 flex flex-col overflow-hidden" style={{ maxHeight: 'calc(100vh - 2rem)' }}>
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-100 shrink-0">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-slate-800 truncate">
            {isLoading
              ? <span className="inline-block w-32 h-4 bg-slate-100 rounded animate-pulse" />
              : property?.title}
          </p>
          {!isLoading && property?.status && (
            <div className="mt-0.5"><PropertyStatusPill status={property.status} size="sm" /></div>
          )}
        </div>
        <button
          onClick={onClose}
          className="shrink-0 p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>

      {/* Scrollable body */}
      <div className="overflow-y-auto thin-scrollbar flex-1">
        {/* Image carousel */}
        <div className="relative aspect-video bg-slate-100 shrink-0">
          {isLoading ? (
            <div className="w-full h-full bg-slate-100 animate-pulse" />
          ) : images.length > 0 ? (
            <>
              <img src={images[imgIdx]?.url} alt="" className="w-full h-full object-cover" />
              {images.length > 1 && (
                <>
                  <button
                    onClick={() => setImgIdx(i => (i - 1 + images.length) % images.length)}
                    className="absolute left-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-black/50 hover:bg-black/70 flex items-center justify-center"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
                  </button>
                  <button
                    onClick={() => setImgIdx(i => (i + 1) % images.length)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-black/50 hover:bg-black/70 flex items-center justify-center"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6"/></svg>
                  </button>
                  <div className="absolute bottom-2 right-3 bg-black/50 text-white text-xs px-2 py-0.5 rounded-full">
                    {imgIdx + 1}/{images.length}
                  </div>
                </>
              )}
            </>
          ) : (
            <div className="w-full h-full flex items-center justify-center text-slate-300">
              <svg className="w-10 h-10" fill="currentColor" viewBox="0 0 24 24"><path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/></svg>
            </div>
          )}
        </div>

        {/* Details */}
        <div className="px-4 pt-4 pb-3 space-y-3">
          {isLoading ? (
            <div className="w-28 h-7 bg-slate-100 rounded animate-pulse" />
          ) : (
            <div className="flex items-end justify-between gap-2">
              <div>
                <p className="text-2xl font-bold text-slate-900 leading-none">
                  ₹{Number(property?.rent).toLocaleString('en-IN')}/mo
                </p>
                {property?.deposit > 0 && (
                  <p className="text-xs text-slate-400 mt-1">Deposit: ₹{Number(property.deposit).toLocaleString('en-IN')}</p>
                )}
              </div>
              {property?.maintenance > 0 && (
                <p className="text-xs text-slate-500 text-right">
                  +₹{Number(property.maintenance).toLocaleString('en-IN')}<br />
                  <span className="text-slate-400">maintenance</span>
                </p>
              )}
            </div>
          )}

          {!isLoading && (
            <div className="flex flex-wrap gap-1.5">
              {bhkLabel && <span className="px-2 py-0.5 bg-brand-50 text-brand-600 rounded-full text-xs font-semibold">{bhkLabel}</span>}
              {property?.furnished && (
                <span className="px-2 py-0.5 bg-slate-100 rounded-full text-xs font-medium text-slate-600">
                  {property.furnished.charAt(0) + property.furnished.slice(1).toLowerCase()}
                </span>
              )}
              {property?.type && (
                <span className="px-2 py-0.5 bg-slate-100 rounded-full text-xs font-medium text-slate-600">
                  {property.type.replace('_', ' ')}
                </span>
              )}
            </div>
          )}

          {!isLoading && property?.address && (
            <div className="flex items-start gap-1.5">
              <svg className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/>
              </svg>
              <p className="text-xs text-slate-500 leading-snug">
                {property.address}{property.city ? `, ${property.city}` : ''}{property.state ? `, ${property.state}` : ''}
              </p>
            </div>
          )}

          {!isLoading && property?.owner && (
            <div className="flex items-center gap-2 p-2 bg-slate-50 rounded-xl border border-slate-100">
              <div className="w-7 h-7 rounded-full bg-slate-200 flex items-center justify-center shrink-0">
                {property.owner.avatarUrl
                  ? <img src={property.owner.avatarUrl} alt="" className="w-full h-full rounded-full object-cover" />
                  : <span className="text-[10px] font-bold text-slate-500">{(property.owner.name || property.owner.email || '?')[0].toUpperCase()}</span>
                }
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-slate-700 truncate">{property.owner.name || property.owner.email?.split('@')[0]}</p>
                <p className="text-[10px] text-slate-400">Owner</p>
              </div>
            </div>
          )}

          {amenities.length > 0 && !isLoading && (
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1.5">Amenities</p>
              <div className="flex flex-wrap gap-1.5">
                {amenities.slice(0, 8).map(a => (
                  <span key={a.amenity?.name} className="px-2 py-1 bg-slate-50 border border-slate-100 rounded-lg text-xs text-slate-600 whitespace-nowrap">
                    {a.amenity?.name}
                  </span>
                ))}
                {amenities.length > 8 && (
                  <span className="px-2 py-1 text-xs text-slate-400 bg-slate-50 border border-slate-100 rounded-lg">+{amenities.length - 8} more</span>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        {!isLoading && property && (
          <div className="px-4 pb-4 space-y-2">
            <button
              onClick={onViewFull}
              className="w-full py-2.5 text-center text-sm font-semibold text-white bg-[#111111] hover:bg-[#2a2a2a] rounded-xl transition-colors"
            >
              View Full Details
            </button>
            <div className="flex gap-2">
              {property.status !== 'ACTIVE' && (
                <button onClick={onApprove} className="flex-1 py-2 text-xs font-semibold text-green-700 bg-green-50 hover:bg-green-100 rounded-xl border border-green-200 transition-colors">
                  ✓ Approve
                </button>
              )}
              {property.status !== 'SUSPENDED' && (
                <button onClick={onSuspend} className="flex-1 py-2 text-xs font-semibold text-orange-700 bg-orange-50 hover:bg-orange-100 rounded-xl border border-orange-200 transition-colors">
                  ⏸ Suspend
                </button>
              )}
              {property.status !== 'REJECTED' && (
                <button onClick={onReject} className="flex-1 py-2 text-xs font-semibold text-red-700 bg-red-50 hover:bg-red-100 rounded-xl border border-red-200 transition-colors">
                  ✕ Reject
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Section: All Properties — full-screen map ──────────────────────────────
function AdminPropertiesMap() {
  const qc              = useQueryClient()
  const containerRef    = useRef(null)
  const mapRef          = useRef(null)
  const markersRef      = useRef(new Map())
  const flyToRef        = useRef(null)
  const searchMarkerRef = useRef(null)

  const [mapReady, setMapReady]         = useState(false)
  const [pins, setPins]                 = useState([])
  const [city, setCity]                 = useState('')
  const [area, setArea]                 = useState('')
  const [bhkFilter, setBhkFilter]       = useState([])
  const [statusFilter, setStatusFilter] = useState('')
  const [selectedId, setSelectedId]     = useState(null)
  const [popupProperty, setPopupProperty] = useState(null)
  const [loadingPopup, setLoadingPopup] = useState(false)
  const [fullDetail, setFullDetail]     = useState(null)

  function toggleBhk(v) {
    setBhkFilter(prev => prev.includes(v) ? prev.filter(x => x !== v) : [...prev, v])
  }

  // Init map once
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    let cancelled = false
    const markers = markersRef.current
    googleMapsReady.then(() => {
      if (cancelled || mapRef.current) return
      const map = new window.google.maps.Map(el, {
        center: { lat: 14.5, lng: 78.9629 },
        zoom: 6,
        mapTypeId: 'terrain',
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false,
        gestureHandling: 'greedy',
        zoomControlOptions: { position: window.google.maps.ControlPosition.RIGHT_BOTTOM },
      })
      mapRef.current = map
      const bounds = new window.google.maps.LatLngBounds()
      CITIES.forEach(c => bounds.extend({ lat: c.lat, lng: c.lng }))
      map.fitBounds(bounds, 80)
      flyToRef.current = ({ center: [lng, lat], zoom }) => {
        map.setZoom(zoom ?? map.getZoom())
        map.panTo({ lat, lng })
      }
      setMapReady(true)
    })
    return () => {
      cancelled = true
      for (const m of markers.values()) m.remove()
      markers.clear()
      searchMarkerRef.current?.remove()
      searchMarkerRef.current = null
      mapRef.current = null
    }
  }, [])

  // Fly to city
  useEffect(() => {
    if (!mapReady || !city) return
    const cityData = CITIES.find(c => c.name === city)
    if (!cityData || !flyToRef.current) return
    flyToRef.current({ center: [cityData.lng, cityData.lat], zoom: 12 })
  }, [city, mapReady])

  // Handle area place picked → fly + orange search marker
  function handlePlacePicked({ name: _name, lat, lng }) {
    flyToRef.current?.({ center: [lng, lat], zoom: 16 })
    searchMarkerRef.current?.remove()
    searchMarkerRef.current = null
    const el = document.createElement('div')
    el.style.filter = 'drop-shadow(0 3px 6px rgba(244,81,30,0.55))'
    el.innerHTML = `<svg width="32" height="42" viewBox="0 0 32 42" fill="none"><path d="M16 0C7.163 0 0 7.163 0 16c0 10.5 16 26 16 26S32 26.5 32 16C32 7.163 24.837 0 16 0z" fill="#f4511e"/><circle cx="16" cy="16" r="6" fill="white"/></svg>`
    if (mapRef.current) {
      searchMarkerRef.current = createHtmlMarker({ element: el, lat, lng, map: mapRef.current })
    }
  }

  function handleAreaClear() {
    searchMarkerRef.current?.remove()
    searchMarkerRef.current = null
  }

  // Fetch pins on idle + filter changes
  useEffect(() => {
    if (!mapReady) return
    const map = mapRef.current
    if (!map) return
    let debounce = null
    let cancelled = false

    function fetchPins() {
      const b = map.getBounds()
      if (!b) return
      const sw = b.getSouthWest()
      const ne = b.getNorthEast()
      const params = { south: sw.lat(), west: sw.lng(), north: ne.lat(), east: ne.lng() }
      if (statusFilter) params.status = statusFilter
      if (city.trim()) params.city = city.trim()
      if (bhkFilter.length) params.bhk = bhkFilter.join(',')
      adminService.pins(params)
        .then(r => { if (!cancelled) setPins(Array.isArray(r.data) ? r.data : []) })
        .catch(() => {})
    }

    fetchPins()
    const idle = window.google.maps.event.addListener(map, 'idle', () => {
      clearTimeout(debounce)
      debounce = setTimeout(fetchPins, 400)
    })
    return () => { cancelled = true; clearTimeout(debounce); window.google.maps.event.removeListener(idle) }
  }, [mapReady, statusFilter, city, bhkFilter])

  // Sync markers (diff — no full clear)
  useEffect(() => {
    if (!mapReady) return
    const map = mapRef.current
    if (!map) return
    const incoming = new Set(pins.map(p => p.id))
    for (const [id, m] of markersRef.current) {
      if (!incoming.has(id)) { m.remove(); markersRef.current.delete(id) }
    }
    for (const pin of pins) {
      if (markersRef.current.has(pin.id)) continue
      const el = makeMapPin(pin, pin.id === selectedId)
      el.addEventListener('click', () => {
        setSelectedId(prev => {
          const next = prev === pin.id ? null : pin.id
          if (!next) setPopupProperty(null)
          return next
        })
      })
      markersRef.current.set(pin.id, createHtmlMarker({ element: el, lat: parseFloat(pin.lat), lng: parseFloat(pin.lng), map }))
    }
  }, [pins, mapReady, selectedId])

  // Update pin visual state when selection changes
  useEffect(() => {
    for (const [id, marker] of markersRef.current) {
      applyPinSelected(marker.getElement(), id === selectedId)
    }
  }, [selectedId])

  // Fetch full property when pin selected
  useEffect(() => {
    if (!selectedId) { setPopupProperty(null); return }
    setLoadingPopup(true)
    adminService.propertyById(selectedId)
      .then(r => { setPopupProperty(r.data); setLoadingPopup(false) })
      .catch(() => setLoadingPopup(false))
  }, [selectedId])

  function handleStatusAction(status) {
    if (!popupProperty) return
    adminService.setPropertyStatus(popupProperty.id, { status })
      .then(() => {
        qc.invalidateQueries({ queryKey: ['admin-analytics'] })
        setPopupProperty(prev => prev ? { ...prev, status } : null)
      })
  }

  // Full detail view
  if (fullDetail) {
    return (
      <PropertyDetailView
        property={fullDetail}
        onBack={() => setFullDetail(null)}
        onApprove={(id) => adminService.setPropertyStatus(id, { status: 'ACTIVE' })
          .then(() => { qc.invalidateQueries({ queryKey: ['admin-analytics'] }); setFullDetail(null) })}
        onReject={(id) => adminService.setPropertyStatus(id, { status: 'REJECTED' })
          .then(() => { qc.invalidateQueries({ queryKey: ['admin-analytics'] }); setFullDetail(null) })}
      />
    )
  }

  const hasFilters = statusFilter || city || bhkFilter.length > 0

  return (
    <div className="flex h-[100vh] -mx-8 -my-8 overflow-hidden">

      {/* ── Left filter panel (same layout as FindRentalPanel) ── */}
      <div className="hidden md:flex flex-col w-72 bg-white border-r border-slate-100 shrink-0 overflow-hidden">
        {/* Header */}
        <div className="px-5 pt-5 pb-4 border-b border-slate-100 flex items-center justify-between shrink-0">
          <div>
            <p className="text-xs font-bold text-brand-600 uppercase tracking-widest mb-0.5">Admin filters</p>
            <h2 className="text-sm font-bold text-slate-900 leading-tight">Browse all properties</h2>
          </div>
          {hasFilters && (
            <button
              onClick={() => { setCity(''); setArea(''); setBhkFilter([]); setStatusFilter('') }}
              className="text-xs text-slate-400 hover:text-slate-700 transition-colors"
            >
              Reset
            </button>
          )}
        </div>

        <div className="px-5 py-4 flex flex-col gap-4 overflow-y-auto thin-scrollbar flex-1">

          {/* City */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">City</label>
            <CityDropdown value={city} onChange={val => { setCity(val); setArea('') }} />
          </div>

          {/* Area */}
          <AreaInput
            value={area}
            city={city}
            onChange={setArea}
            onPlacePicked={handlePlacePicked}
            onClear={handleAreaClear}
          />

          {/* Bedrooms */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Bedrooms</label>
            <div className="flex gap-1.5 flex-wrap">
              {BHK_OPTIONS_MAP.map(({ label, value }) => (
                <button
                  key={value}
                  onClick={() => toggleBhk(value)}
                  className={[
                    'px-3 py-1.5 text-xs font-semibold rounded-lg border transition-all duration-150',
                    bhkFilter.includes(value)
                      ? 'bg-[#111111] text-white border-[#111111] shadow-sm'
                      : 'border-slate-200 text-slate-600 bg-slate-50 hover:border-slate-400',
                  ].join(' ')}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Status (admin-only) */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Status</label>
            <div className="flex gap-1.5 flex-wrap">
              {STATUS_FILTERS.map(s => (
                <button
                  key={s.value}
                  onClick={() => setStatusFilter(s.value)}
                  className={[
                    'px-3 py-1.5 text-xs font-semibold rounded-lg border transition-all duration-150',
                    statusFilter === s.value
                      ? 'bg-[#111111] text-white border-[#111111] shadow-sm'
                      : 'border-slate-200 text-slate-600 bg-slate-50 hover:border-slate-400',
                  ].join(' ')}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

        </div>
      </div>

      {/* ── Map + right popup ── */}
      <div className="relative flex-1 overflow-hidden">
        <div ref={containerRef} className="absolute inset-0" />

        {/* Right panel popup — mirrors MapRightPanel / PropertyPopup */}
        {(selectedId || loadingPopup) && (
          <div
            className="absolute right-4 top-4 z-10 w-80"
            style={{ maxHeight: 'calc(100vh - 2rem)' }}
          >
            <AdminPropertyPopup
              property={popupProperty}
              isLoading={loadingPopup}
              onClose={() => { setSelectedId(null); setPopupProperty(null) }}
              onViewFull={() => popupProperty && setFullDetail(popupProperty)}
              onApprove={() => handleStatusAction('ACTIVE')}
              onSuspend={() => handleStatusAction('SUSPENDED')}
              onReject={() => handleStatusAction('REJECTED')}
            />
          </div>
        )}

        {/* Pin count */}
        <div className="absolute bottom-6 left-4 z-10">
          <span className="bg-white/90 backdrop-blur-sm text-xs font-semibold text-slate-600 px-3 py-1.5 rounded-full shadow-md">
            {pins.length} propert{pins.length === 1 ? 'y' : 'ies'} in view
          </span>
        </div>
      </div>
    </div>
  )
}

// ── Section: Review Listings ───────────────────────────────────────────────



const APPT_BADGE = { PENDING: 'bg-yellow-50 text-yellow-700', ACCEPTED: 'bg-green-50 text-green-700', REJECTED: 'bg-red-50 text-red-700' }
const SEV_COLOR_PILL = { LOW: 'bg-slate-100 text-slate-600', MEDIUM: 'bg-yellow-50 text-yellow-700', HIGH: 'bg-orange-50 text-orange-700', CRITICAL: 'bg-red-50 text-red-700' }

const AVATAR_SIZE = { 6: 'w-6 h-6', 7: 'w-7 h-7', 8: 'w-8 h-8', 9: 'w-9 h-9', 10: 'w-10 h-10' }

function Avatar({ name, email, avatarUrl, size = 6 }) {
  const display = name || email?.split('@')[0] || '?'
  const cls = AVATAR_SIZE[size] ?? 'w-6 h-6'
  if (avatarUrl) return <img src={avatarUrl} alt="" className={`${cls} rounded-full object-cover shrink-0`} />
  return (
    <div className={`${cls} rounded-full bg-slate-200 flex items-center justify-center shrink-0`}>
      <span className="text-[10px] font-bold text-slate-500">{display[0]?.toUpperCase()}</span>
    </div>
  )
}

/* ── Helper: aggregate unique users from appointments + conversations ── */
function aggregatePropertyUsers(property) {
  const userMap = new Map()

  // From appointments
  for (const a of property.appointments ?? []) {
    const t = a.tenant
    if (!t) continue
    if (!userMap.has(t.id)) {
      userMap.set(t.id, { id: t.id, name: t.name, email: t.email, avatarUrl: t.avatarUrl, phone: t.phone })
    }
  }

  // From conversations (users who chatted but may not have an appointment)
  for (const c of property.conversations ?? []) {
    const t = c.tenant
    if (!t) continue
    if (!userMap.has(t.id)) {
      userMap.set(t.id, { id: t.id, name: t.name, email: t.email, avatarUrl: t.avatarUrl })
    }
  }

  return Array.from(userMap.values())
}

/* ── Simple card for the grid ── */
function ReviewCard({ property, onSelect }) {
  const img = property.images?.[0]?.url
  const rent = Number(property.rent)
  const ownerName = property.owner?.name || property.owner?.email?.split('@')[0] || '—'

  // Contacted = unique tenants who made an appointment
  const contactedSet = new Set()
  let visitedCount = 0
  for (const a of property.appointments ?? []) {
    if (a.tenant?.id || a.tenantId) contactedSet.add(a.tenant?.id || a.tenantId)
    if (a.status === 'ACCEPTED') visitedCount++
  }

  return (
    <div
      onClick={() => onSelect(property)}
      className="bg-white rounded-2xl border border-slate-100 overflow-hidden shadow-sm cursor-pointer hover:shadow-md hover:border-slate-200 transition-all group"
    >
      {/* Thumbnail */}
      <div className="relative aspect-[16/10] bg-slate-100">
        {img ? (
          <img src={img} alt="" className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-300" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-slate-300">
            <svg className="w-10 h-10" fill="currentColor" viewBox="0 0 24 24"><path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/></svg>
          </div>
        )}
        <span className="absolute top-2 left-2"><PropertyStatusPill status={property.status} size="sm" /></span>
      </div>

      <div className="p-3.5 space-y-2">
        <div>
          <p className="text-sm font-bold text-slate-800 truncate">{property.title}</p>
          {property.displayId && (
            <p className="text-[10px] font-mono text-slate-400">{property.displayId}</p>
          )}
          <p className="text-xs text-slate-500 mt-0.5">
            ₹{rent >= 1000 ? `${(rent / 1000).toFixed(rent % 1000 === 0 ? 0 : 1)}K` : rent}/mo
            {property.city ? ` · ${property.city}` : ''}
            {property.bhk ? ` · ${property.bhk} BHK` : ''}
          </p>
        </div>

        {/* Owner line */}
        <div className="flex items-center gap-2">
          <Avatar name={property.owner?.name} email={property.owner?.email} avatarUrl={property.owner?.avatarUrl} />
          <span className="text-xs text-slate-600 font-medium truncate">{ownerName}</span>
        </div>

        {/* Contacted & Visited stats */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-blue-50">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
            <span className="text-[11px] font-semibold text-blue-700">{contactedSet.size} contacted</span>
          </div>
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-green-50">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
            <span className="text-[11px] font-semibold text-green-700">{visitedCount} visited</span>
          </div>
        </div>

        {/* View More */}
        <button className="w-full py-2 text-xs font-semibold text-brand-600 bg-brand-50 hover:bg-brand-100 rounded-xl transition-colors">
          View details →
        </button>
      </div>
    </div>
  )
}

/* ── Card wrapper (matches PropertyPage SectionCard) ── */
function AdminCard({ title, children }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 p-5">
      {title && <h3 className="text-base font-bold text-slate-900 mb-4">{title}</h3>}
      {children}
    </div>
  )
}

function AdminPriceRow({ label, value, accent }) {
  if (!value) return null
  return (
    <div className="flex justify-between items-center py-2.5 border-b border-slate-50 last:border-0">
      <span className="text-sm text-slate-500">{label}</span>
      <span className={`text-sm font-semibold ${accent ? 'text-brand-600' : 'text-slate-800'}`}>{value}</span>
    </div>
  )
}

function AdminLocationMap({ lat, lng }) {
  const ref = useRef(null)
  useEffect(() => {
    if (!lat || !lng || !ref.current) return
    let marker = null; let cancelled = false
    googleMapsReady.then(() => {
      if (cancelled || !ref.current) return
      const center = { lat: Number(lat), lng: Number(lng) }
      const map = new window.google.maps.Map(ref.current, { center, zoom: 15, mapTypeId: 'roadmap', disableDefaultUI: true, gestureHandling: 'none', clickableIcons: false })
      const el = document.createElement('div')
      el.style.cssText = 'width:14px;height:14px;border-radius:50%;background:#0284c7;border:3px solid white;box-shadow:0 2px 8px rgba(2,132,199,0.55)'
      marker = createHtmlMarker({ element: el, lat: center.lat, lng: center.lng, map })
    })
    return () => { cancelled = true; marker?.remove() }
  }, [lat, lng])
  return (
    <AdminCard title="Map">
      <div ref={ref} className="w-full h-40 rounded-xl overflow-hidden" />
      <a href={`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`} target="_blank" rel="noreferrer"
        className="mt-3 flex items-center justify-center gap-1.5 px-3 py-2 bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold rounded-lg transition-colors">
        Directions
      </a>
    </AdminCard>
  )
}

/* ── Section label helper ── */
function SectionLabel({ children }) {
  return <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2.5">{children}</p>
}

/* ── Inline property detail view (3 columns: Property | Users | User Detail) ── */
function PropertyDetailView({ property, onBack, onApprove, onReject }) {
  const [imgIdx, setImgIdx] = useState(0)
  const [selectedUserId, setSelectedUserId] = useState(null)

  useEffect(() => { setImgIdx(0); setSelectedUserId(null) }, [property?.id])

  if (!property) return null

  const images = property.images?.map(i => i.url) ?? []
  const rent = Number(property.rent)
  const deposit = Number(property.deposit || 0)
  const maintenance = Number(property.maintenance || 0)
  const owner = property.owner

  const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : null

  const allUsers = aggregatePropertyUsers(property)
  const userStats = allUsers.map(u => {
    const appts = (property.appointments ?? []).filter(a => (a.tenant?.id || a.tenantId) === u.id)
    const visited = appts.filter(a => a.status === 'ACCEPTED').length
    const hasConvo = (property.conversations ?? []).some(c => c.tenant?.id === u.id || c.tenantId === u.id)
    return { ...u, appointmentCount: appts.length, visitedCount: visited, hasConversation: hasConvo }
  })

  const selectedUser = selectedUserId ? allUsers.find(u => u.id === selectedUserId) : null
  const userAppointments = selectedUserId ? (property.appointments ?? []).filter(a => (a.tenant?.id || a.tenantId) === selectedUserId) : []
  const userReports = selectedUserId ? (property.reports ?? []).filter(r => r.reporterId === selectedUserId) : []
  const userConversation = selectedUserId ? (property.conversations ?? []).find(c => c.tenant?.id === selectedUserId || c.tenantId === selectedUserId) : null
  const userMessages = userConversation ? [...(userConversation.messages ?? [])].reverse() : []

  return (
    <div className="flex flex-col h-[100vh] -mx-8 -my-8">
      {/* Header bar */}
      <div className="shrink-0 bg-white border-b border-slate-200 px-6 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={onBack}
            className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5" /><path d="M12 19l-7-7 7-7" />
            </svg>
            Back
          </button>
          <div className="w-px h-6 bg-slate-200 shrink-0" />
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-slate-900 truncate">{property.title}</h2>
              {property.displayId && (
                <button
                  onClick={() => navigator.clipboard.writeText(property.displayId)}
                  title="Click to copy"
                  className="shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 text-[11px] font-mono font-semibold text-slate-500 hover:bg-slate-200 transition-colors"
                >
                  {property.displayId}
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
                </button>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-0.5">{property.address}, {property.city}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <PropertyStatusPill status={property.status} />
          {property.status === 'PENDING' && (
            <>
              <button onClick={() => onApprove(property.id)} className="px-4 py-2 text-xs font-semibold text-white bg-green-600 hover:bg-green-700 rounded-xl transition-colors">Approve</button>
              <button onClick={() => onReject(property.id)} className="px-4 py-2 text-xs font-semibold text-white bg-red-500 hover:bg-red-600 rounded-xl transition-colors">Reject</button>
            </>
          )}
        </div>
      </div>

      {/* 3-column body */}
      <div className="flex-1 grid divide-x divide-slate-200 min-h-0 bg-white" style={{ gridTemplateColumns: '5fr 3fr 4fr' }}>

        {/* ── Column 1: Property Details ── */}
        <div className="p-5 space-y-4 overflow-y-auto thin-scrollbar bg-slate-50">
          {/* Image carousel */}
          <div className="relative rounded-2xl overflow-hidden bg-slate-200 aspect-[16/10]">
            {images.length > 0 ? (
              <>
                <img src={images[imgIdx]} alt="" className="w-full h-full object-cover" />
                {images.length > 1 && (
                  <>
                    <button onClick={() => setImgIdx(i => (i - 1 + images.length) % images.length)}
                      className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/90 hover:bg-white shadow flex items-center justify-center">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#334155" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
                    </button>
                    <button onClick={() => setImgIdx(i => (i + 1) % images.length)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/90 hover:bg-white shadow flex items-center justify-center">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#334155" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6"/></svg>
                    </button>
                    <div className="absolute bottom-2 right-2 px-2.5 py-1 rounded-lg bg-black/60 text-white text-[11px] font-semibold">
                      {imgIdx + 1} / {images.length}
                    </div>
                  </>
                )}
              </>
            ) : (
              <div className="w-full h-full flex items-center justify-center text-slate-300">
                <svg className="w-12 h-12" fill="currentColor" viewBox="0 0 24 24"><path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/></svg>
              </div>
            )}
          </div>

          {/* Title + Price + Tags */}
          <div>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-lg font-bold text-slate-900 leading-snug">{property.title}</p>
                <p className="text-sm text-slate-500 mt-1">{property.address}, {property.city}</p>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-xl font-bold text-brand-600">₹{rent.toLocaleString('en-IN')}<span className="text-xs font-medium text-slate-400">/mo</span></p>
                <p className="text-xs text-slate-500 mt-0.5">Deposit: ₹{deposit.toLocaleString('en-IN')}</p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-1.5 mt-3">
              {property.bhk && <span className="px-2.5 py-1 bg-brand-50 text-brand-700 text-xs font-semibold rounded-lg border border-brand-100">🏠 {property.bhk} BHK</span>}
              {property.sharing && <span className="px-2.5 py-1 bg-brand-50 text-brand-700 text-xs font-semibold rounded-lg border border-brand-100">👥 {property.sharing}-Sharing</span>}
              <span className="px-2.5 py-1 bg-slate-100 text-slate-600 text-xs font-medium rounded-lg">🛋️ {property.furnished === 'FULLY' ? 'Furnished' : property.furnished === 'SEMI' ? 'Semi Furnished' : 'Unfurnished'}</span>
              <span className="px-2.5 py-1 bg-slate-100 text-slate-600 text-xs font-medium rounded-lg">🏷️ {property.type?.replace(/_/g, ' ')}</span>
            </div>
          </div>

          {/* About */}
          {property.description && (
            <AdminCard title="About this property">
              <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-line">{property.description}</p>
            </AdminCard>
          )}

          {/* Property Details */}
          {(property.area || property.floor != null || property.facingDirection || property.leaseDuration || fmtDate(property.availableFrom)) && (
            <AdminCard title="Property details">
              {[
                ['📐', 'Built-up Area',   property.area ? `${Number(property.area).toLocaleString('en-IN')} sq.ft` : null],
                ['🏢', 'Floor',           property.floor != null ? `${property.floor}${property.totalFloors ? ` of ${property.totalFloors}` : ''}` : null],
                ['🧭', 'Facing',          property.facingDirection ? property.facingDirection.charAt(0) + property.facingDirection.slice(1).toLowerCase() : null],
                ['📅', 'Available From',  fmtDate(property.availableFrom)],
                ['📋', 'Minimum Lease',   property.leaseDuration ? `${property.leaseDuration} months` : null],
                ['👥', 'Max Occupancy',   property.occupancyLimit ? `${property.occupancyLimit} persons` : null],
              ].filter(([,, v]) => v).map(([icon, label, value]) => (
                <div key={label} className="flex items-center gap-3 py-2.5 border-b border-slate-50 last:border-0">
                  <span className="text-sm shrink-0">{icon}</span>
                  <span className="text-sm text-slate-500 flex-1">{label}</span>
                  <span className="text-sm font-semibold text-slate-800">{value}</span>
                </div>
              ))}
            </AdminCard>
          )}

          {/* Pricing + Amenities side by side */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Pricing */}
            <AdminCard title="Pricing">
              <AdminPriceRow label="Monthly Rent"       value={`₹${rent.toLocaleString('en-IN')}`} accent />
              <AdminPriceRow label="Deposit"            value={`₹${deposit.toLocaleString('en-IN')}`} />
              <AdminPriceRow label="Maintenance"        value={maintenance > 0 ? `₹${maintenance.toLocaleString('en-IN')}/mo` : 'Not included'} />
              <AdminPriceRow label="Brokerage"          value={property.brokerage ? `₹${Number(property.brokerage).toLocaleString('en-IN')}` : 'None'} />
              {property.electricityCharges > 0 && <AdminPriceRow label="Electricity (est.)" value={`₹${Number(property.electricityCharges).toLocaleString('en-IN')}/mo`} />}
              {property.waterCharges > 0      && <AdminPriceRow label="Water (est.)"        value={`₹${Number(property.waterCharges).toLocaleString('en-IN')}/mo`} />}
            </AdminCard>

            {/* Amenities */}
            {(property.amenities?.length ?? 0) > 0 && (
              <AdminCard title="Amenities">
                <div className="grid grid-cols-1 gap-2">
                  {property.amenities.map(a => {
                    const name = a.amenity?.name ?? a.name
                    return (
                      <div key={a.amenity?.id ?? a.amenityId} className="flex items-center gap-2.5 px-3 py-2.5 bg-slate-50 rounded-xl border border-slate-100">
                        <span className="text-slate-400 shrink-0"><AmenityIcon name={name} size={16} /></span>
                        <span className="text-sm font-medium text-slate-700 truncate min-w-0">{name}</span>
                      </div>
                    )
                  })}
                </div>
              </AdminCard>
            )}
          </div>

          {/* Zero Brokerage banner */}
          {!property.brokerage && (
            <div className="px-4 py-3 bg-emerald-50 border border-emerald-100 rounded-2xl flex items-center gap-2.5">
              <span className="text-lg">🎉</span>
              <div>
                <p className="text-sm font-semibold text-emerald-700">Zero Brokerage</p>
                <p className="text-xs text-emerald-600/70">Direct owner listing — no middlemen fees</p>
              </div>
            </div>
          )}

          {/* House Rules */}
          {property.rules && (
            <AdminCard title="House rules">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {[
                  { icon: 'M18 8h1a4 4 0 010 8h-1M2 8h16v9a4 4 0 01-4 4H6a4 4 0 01-4-4V8zM6 1v3M10 1v3M14 1v3', label: 'Non-veg Cooking', allowed: property.rules.nonVegAllowed },
                  { icon: 'M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2M12 11a4 4 0 100-8 4 4 0 000 8z',               label: 'Bachelors',       allowed: property.rules.bachelorAllowed },
                  { icon: 'M13 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V9zM13 2v7h7',                       label: 'Visitors',        allowed: property.rules.visitorsAllowed },
                  { icon: 'M10 5.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zm7 0a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zM4 9.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zm15 0a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zM12 10c-4 0-7 3-7 6.5 0 2 1.5 3.5 7 3.5s7-1.5 7-3.5C19 13 16 10 12 10z', label: 'Pets', allowed: property.rules.petsAllowed },
                  { icon: 'M18 8h1a4 4 0 010 8h-1M2 8h16v4M6 1v3M10 1v3M14 1v3M6 20v-8',                         label: 'Smoking',         allowed: property.rules.smokingAllowed },
                  { icon: 'M17 8h1a4 4 0 010 8h-1M3 8h14v9a4 4 0 01-4 4H7a4 4 0 01-4-4V8zM9 2v3M12 2v3M15 2v3',  label: 'Alcohol',         allowed: property.rules.alcoholAllowed },
                ].map(r => (
                  <div key={r.label} className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl border ${r.allowed ? 'bg-emerald-50 border-emerald-100' : 'bg-slate-50 border-slate-100'}`}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={r.allowed ? '#059669' : '#94a3b8'} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
                      <path d={r.icon} />
                    </svg>
                    <span className={`text-sm font-medium flex-1 ${r.allowed ? 'text-slate-800' : 'text-slate-400'}`}>{r.label}</span>
                    <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${r.allowed ? 'bg-emerald-500' : 'bg-slate-300'}`}>
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        {r.allowed ? <path d="M20 6L9 17l-5-5" /> : <path d="M18 6L6 18M6 6l12 12" />}
                      </svg>
                    </div>
                  </div>
                ))}
              </div>
              {(property.rules.genderPreference !== 'ANY' || property.rules.curfewTime) && (
                <div className="mt-3 space-y-2">
                  {property.rules.genderPreference && property.rules.genderPreference !== 'ANY' && (
                    <div className="flex items-center gap-2.5 px-3 py-2.5 bg-brand-50 rounded-xl border border-brand-100">
                      <span className="w-5 h-5 rounded-full bg-brand-600 text-white flex items-center justify-center text-xs font-bold shrink-0">!</span>
                      <span className="text-sm font-medium text-brand-700">{property.rules.genderPreference === 'MALE' ? 'Male tenants only' : 'Female tenants only'}</span>
                    </div>
                  )}
                  {property.rules.curfewTime && (
                    <div className="flex items-center gap-2.5 px-3 py-2.5 bg-amber-50 rounded-xl border border-amber-100">
                      <span className="text-base shrink-0">⏰</span>
                      <span className="text-sm font-medium text-amber-800">Curfew at {property.rules.curfewTime}</span>
                    </div>
                  )}
                </div>
              )}
            </AdminCard>
          )}

          {/* Owner card */}
          {owner && (
            <AdminCard title="Listed by">
              <div className="flex items-center gap-3">
                <Avatar name={owner.name} email={owner.email} avatarUrl={owner.avatarUrl} size={10} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-slate-800">{owner.name || owner.email?.split('@')[0]}</p>
                  <p className="text-xs text-slate-500 truncate mt-0.5">{owner.email}</p>
                  {owner.phone && <p className="text-xs text-slate-500 mt-0.5">{owner.phone}</p>}
                </div>
                {owner.isVerified && (
                  <span className="shrink-0 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-green-50 border border-green-200 text-green-600 uppercase">Verified</span>
                )}
              </div>
            </AdminCard>
          )}

          {/* Trust & Risk */}
          {(property.trustScore?.badge || property.riskScore?.level) && (
            <div className="flex items-center gap-2 flex-wrap">
              {property.trustScore?.badge && <TrustBadge badge={property.trustScore.badge} />}
              {property.riskScore?.level && (
                <span className={`px-2.5 py-1 rounded-lg text-[11px] font-bold uppercase border ${
                  property.riskScore.level === 'HIGH' || property.riskScore.level === 'SUSPICIOUS'
                    ? 'bg-red-50 border-red-200 text-red-600' : 'bg-green-50 border-green-200 text-green-600'
                }`}>
                  Risk: {property.riskScore.level}
                </span>
              )}
            </div>
          )}

          {/* Wishlisted by */}
          {(property.savedBy?.length ?? 0) > 0 && (
            <AdminCard title={`Wishlisted by (${property._count?.savedBy ?? property.savedBy.length})`}>
              <div className="flex flex-wrap gap-2">
                {property.savedBy.map(s => (
                  <div key={s.userId} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-slate-50 border border-slate-100">
                    <Avatar name={s.user?.name} email={s.user?.email} avatarUrl={s.user?.avatarUrl} />
                    <span className="text-xs text-slate-600 font-medium">{s.user?.name || s.user?.email?.split('@')[0] || '—'}</span>
                  </div>
                ))}
              </div>
            </AdminCard>
          )}

          {/* Location map */}
          {property.lat && property.lng && (
            <AdminLocationMap lat={property.lat} lng={property.lng} />
          )}

          {/* Trust & Safety */}
          {property.trustScore && (
            <AdminCard title="Trust &amp; safety">
              <TrustScoreWidget trustScore={property.trustScore} riskScore={property.riskScore} />
            </AdminCard>
          )}

          {/* Community reviews */}
          <AdminCard title="Community reviews">
            <ReviewsSection propertyId={property.id} isOwner={false} />
          </AdminCard>
        </div>

        {/* ── Column 2: Users who contacted ── */}
        <div className="p-5 overflow-y-auto thin-scrollbar">
          <SectionLabel>People who contacted ({userStats.length})</SectionLabel>

          {userStats.length > 0 ? (
            <div className="space-y-2">
              {userStats.map(u => {
                const isActive = selectedUserId === u.id
                const displayName = u.name || u.email?.split('@')[0] || '—'
                return (
                  <button
                    key={u.id}
                    onClick={() => setSelectedUserId(isActive ? null : u.id)}
                    className={`w-full text-left p-3.5 rounded-xl border transition-all ${
                      isActive
                        ? 'border-brand-300 bg-brand-50 shadow-sm ring-1 ring-brand-200'
                        : 'border-slate-100 bg-white hover:bg-slate-50 hover:border-slate-200'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Avatar name={u.name} email={u.email} avatarUrl={u.avatarUrl} size={9} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-slate-800 truncate">{displayName}</p>
                        <p className="text-xs text-slate-500 truncate mt-0.5">{u.email}</p>
                      </div>
                      <svg
                        width="14" height="14" viewBox="0 0 24 24" fill="none"
                        stroke={isActive ? '#6366f1' : '#94a3b8'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                        className={`shrink-0 transition-transform ${isActive ? 'rotate-90' : ''}`}
                      >
                        <path d="M9 18l6-6-6-6" />
                      </svg>
                    </div>
                    <div className="flex items-center gap-2 mt-2.5">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-50 border border-blue-100 text-[11px] font-semibold text-blue-700">
                        📅 {u.appointmentCount} appt{u.appointmentCount !== 1 ? 's' : ''}
                      </span>
                      {u.visitedCount > 0 && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-green-50 border border-green-100 text-[11px] font-semibold text-green-700">
                          ✓ visited
                        </span>
                      )}
                      {u.hasConversation && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-purple-50 border border-purple-100 text-[11px] font-semibold text-purple-700">
                          💬 chatted
                        </span>
                      )}
                    </div>
                  </button>
                )
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center mb-3 text-2xl">
                👥
              </div>
              <p className="text-sm font-semibold text-slate-700">No contacts yet</p>
              <p className="text-xs text-slate-500 mt-1 max-w-[200px]">Nobody has reached out about this property</p>
            </div>
          )}
        </div>

        {/* ── Column 3: Selected user's history ── */}
        <div className="p-5 overflow-y-auto thin-scrollbar">
          {selectedUser ? (
            <div className="space-y-6">
              {/* User header */}
              <div className="flex items-center gap-3 p-4 rounded-xl bg-slate-50 border border-slate-100">
                <Avatar name={selectedUser.name} email={selectedUser.email} avatarUrl={selectedUser.avatarUrl} size={10} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-slate-800">{selectedUser.name || selectedUser.email?.split('@')[0]}</p>
                  <p className="text-xs text-slate-500 truncate mt-0.5">{selectedUser.email}</p>
                  {selectedUser.phone && <p className="text-xs text-slate-500 mt-0.5">📞 {selectedUser.phone}</p>}
                </div>
              </div>

              {/* Reports */}
              <div>
                <SectionLabel>Reports ({userReports.length})</SectionLabel>
                {userReports.length > 0 ? (
                  <div className="space-y-2.5">
                    {userReports.map(r => (
                      <div key={r.id} className="p-3.5 rounded-xl border border-slate-100 space-y-2">
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-0.5 rounded-md text-[11px] font-bold uppercase ${SEV_COLOR_PILL[r.severity] ?? 'bg-slate-100 text-slate-600'}`}>{r.severity}</span>
                          <span className="text-xs font-medium text-slate-600">{r.category?.replace(/_/g, ' ')}</span>
                          <span className={`ml-auto px-2 py-0.5 rounded-md text-[11px] font-semibold ${r.status === 'PENDING' ? 'bg-yellow-50 text-yellow-700' : r.status === 'RESOLVED' ? 'bg-green-50 text-green-700' : 'bg-slate-100 text-slate-500'}`}>{r.status}</span>
                        </div>
                        <p className="text-sm text-slate-600 leading-relaxed">{r.description}</p>
                        <p className="text-xs text-slate-400">{fmtDate(r.createdAt)}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-slate-500 py-3">No reports from this user</p>
                )}
              </div>

              {/* Appointments */}
              <div>
                <SectionLabel>Appointments ({userAppointments.length})</SectionLabel>
                {userAppointments.length > 0 ? (
                  <div className="space-y-2.5">
                    {userAppointments.map(a => (
                      <div key={a.id} className="p-3.5 rounded-xl border border-slate-100 space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-medium text-slate-700">📅 {fmtDate(a.requestedDate)}{a.requestedTime ? ` at ${a.requestedTime}` : ''}</span>
                          <span className={`shrink-0 px-2 py-0.5 rounded-md text-[11px] font-semibold ${APPT_BADGE[a.status] ?? 'bg-slate-100 text-slate-600'}`}>{a.status}</span>
                        </div>
                        {a.contactNumber && <p className="text-xs text-slate-500">📞 {a.contactNumber}</p>}
                        {a.message && (
                          <div className="bg-slate-50 rounded-lg px-3 py-2 border border-slate-100">
                            <p className="text-xs text-slate-500 font-medium mb-0.5">Message</p>
                            <p className="text-sm text-slate-700">{a.message}</p>
                          </div>
                        )}
                        {a.ownerNote && (
                          <div className="bg-brand-50 rounded-lg px-3 py-2 border border-brand-100">
                            <p className="text-xs text-brand-500 font-medium mb-0.5">Owner note</p>
                            <p className="text-sm text-brand-700">{a.ownerNote}</p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-slate-500 py-3">No appointments from this user</p>
                )}
              </div>

              {/* Chat */}
              <div>
                <SectionLabel>Conversation ({userMessages.length} messages)</SectionLabel>
                {userMessages.length > 0 ? (
                  <div className="rounded-xl border border-slate-100 overflow-hidden bg-slate-50">
                    <div className="px-4 py-4 space-y-3 max-h-96 overflow-y-auto thin-scrollbar">
                      {userMessages.map(m => {
                        const isOwner = m.senderId === property.ownerId
                        const senderLabel = m.sender?.name || (isOwner ? 'Owner' : (selectedUser.name || selectedUser.email?.split('@')[0] || 'Tenant'))
                        return (
                          <div key={m.id} className={`flex ${isOwner ? 'justify-end' : 'justify-start'}`}>
                            <div className={`max-w-[80%] rounded-2xl px-3.5 py-2.5 shadow-sm ${isOwner ? 'bg-brand-600 text-white' : 'bg-white border border-slate-200 text-slate-800'}`}>
                              <div className="flex items-center gap-2 mb-1">
                                <span className={`text-xs font-semibold ${isOwner ? 'text-white/80' : 'text-slate-500'}`}>{senderLabel}</span>
                                <span className={`text-[10px] ${isOwner ? 'text-white/50' : 'text-slate-400'}`}>{new Date(m.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</span>
                              </div>
                              <p className={`text-sm leading-relaxed ${isOwner ? 'text-white' : 'text-slate-700'}`}>{m.body}</p>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-slate-500 py-3">No chat history</p>
                )}
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mb-4 text-3xl">
                👤
              </div>
              <p className="text-sm font-semibold text-slate-700">Select a user</p>
              <p className="text-sm text-slate-500 mt-1 max-w-[220px]">Click on someone from the list to view their activity</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function ReviewListingsSection() {
  const qc = useQueryClient()
  const [searchParams, setSearchParams] = useSearchParams()
  const [statusFilter, setStatusFilter] = useState('')
  const [selected, setSelected] = useState(null)

  const deepLinkId = searchParams.get('propertyId')

  const { data, isLoading } = useQuery({
    queryKey: ['admin-review-listings', statusFilter],
    queryFn: () => adminService.properties({ status: statusFilter || undefined, limit: 50 }).then(r => r.data),
    staleTime: 0,
  })

  // Fetch the deep-linked property when arriving from another tab
  const { data: deepLinkedProperty } = useQuery({
    queryKey: ['admin-property', deepLinkId],
    queryFn: () => adminService.propertyById(deepLinkId).then(r => r.data),
    enabled: !!deepLinkId && !selected,
  })

  useEffect(() => {
    if (deepLinkedProperty && !selected) {
      setSelected(deepLinkedProperty)
      setSearchParams({ tab: 'review-listings' }, { replace: true })
    }
  }, [deepLinkedProperty, selected, setSearchParams])

  const mutation = useMutation({
    mutationFn: ({ id, status }) => adminService.setPropertyStatus(id, { status }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-review-listings'] })
      setSelected(null)
    },
  })

  const properties = data?.properties ?? []

  // Show detail view inline when a property is selected
  if (selected) {
    return (
      <PropertyDetailView
        property={selected}
        onBack={() => setSelected(null)}
        onApprove={(id) => mutation.mutate({ id, status: 'ACTIVE' })}
        onReject={(id) => mutation.mutate({ id, status: 'REJECTED' })}
      />
    )
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Review Listings</h1>
        <p className="text-sm text-slate-400 mt-0.5">Review and approve submitted listings. Click any card for full details.</p>
      </div>

      <div className="flex gap-2 flex-wrap">
        {['', 'PENDING', 'ACTIVE', 'REJECTED', 'SUSPENDED', 'DRAFT'].map(s => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${statusFilter === s ? 'bg-[#111111] text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
          >
            {s || 'All'}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => <div key={i} className="rounded-2xl bg-slate-100 animate-pulse aspect-[4/3]" />)}
        </div>
      ) : properties.length === 0 ? (
        <div className="text-center py-16 border-2 border-dashed border-slate-200 rounded-2xl">
          <p className="text-sm font-medium text-slate-500">No {statusFilter ? statusFilter.toLowerCase() : ''} listings found</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {properties.map(p => (
            <ReviewCard key={p.id} property={p} onSelect={setSelected} />
          ))}
        </div>
      )}
    </div>
  )
}

// ── Section: Users ─────────────────────────────────────────────────────────
function UsersSection() {
  const qc = useQueryClient()
  const [search, setSearch] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['admin-users', search],
    queryFn: () => adminService.users({ search, limit: 50 }).then(r => r.data),
  })

  const blockMutation = useMutation({
    mutationFn: ({ id, blocked }) => adminService.blockUser(id, { blocked, reason: blocked ? 'Admin action' : 'Unblocked' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-users'] }),
  })

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Users</h1>
        <p className="text-sm text-slate-400 mt-0.5">Search and manage platform users.</p>
      </div>

      <input
        value={search}
        onChange={e => setSearch(e.target.value)}
        placeholder="Search by name or email..."
        className="w-full max-w-sm border border-slate-200 rounded-xl px-4 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
      />

      {isLoading ? (
        <div className="h-48 bg-slate-100 rounded-2xl animate-pulse" />
      ) : (
        <div className="bg-white border border-slate-100 rounded-2xl overflow-x-auto">
          <table className="w-full text-sm min-w-[640px]">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                {['User ID', 'Name', 'Email', 'Role', 'Properties', 'Status', 'Action'].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {(data?.users ?? []).map(u => (
                <tr key={u.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3 text-[11px] font-mono text-slate-400">{u.displayId ?? '—'}</td>
                  <td className="px-4 py-3 font-medium text-slate-800">{u.name ?? '—'}</td>
                  <td className="px-4 py-3 text-slate-500 max-w-48 truncate">{u.email}</td>
                  <td className="px-4 py-3 text-slate-400">{u.role}</td>
                  <td className="px-4 py-3 text-slate-400">{u._count?.properties ?? 0}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${u.isBlocked ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
                      {u.isBlocked ? 'Blocked' : 'Active'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => blockMutation.mutate({ id: u.id, blocked: !u.isBlocked })}
                      className={`text-xs px-3 py-1 rounded-lg font-medium transition-colors ${u.isBlocked ? 'bg-green-50 text-green-700 hover:bg-green-100' : 'bg-red-50 text-red-700 hover:bg-red-100'}`}
                    >
                      {u.isBlocked ? 'Unblock' : 'Block'}
                    </button>
                  </td>
                </tr>
              ))}
              {(data?.users ?? []).length === 0 && (
                <tr><td colSpan={7} className="px-4 py-12 text-center text-sm text-slate-400">No users found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ── Section: Waitlist — signups from cities outside SUPPORTED_CITIES ────────
function WaitlistSection() {
  const { data, isLoading } = useQuery({
    queryKey: ['admin-waitlist'],
    queryFn: () => adminService.waitlist({ limit: 100 }).then(r => r.data),
  })

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Waitlist</h1>
        <p className="text-sm text-slate-400 mt-0.5">
          Signups from cities we haven&apos;t launched in yet — {data?.total ?? 0} total.
        </p>
      </div>

      {isLoading ? (
        <div className="h-48 bg-slate-100 rounded-2xl animate-pulse" />
      ) : (
        <div className="bg-white border border-slate-100 rounded-2xl overflow-x-auto">
          <table className="w-full text-sm min-w-[520px]">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                {['Name', 'Email', 'City', 'Signed up'].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {(data?.entries ?? []).map(entry => (
                <tr key={entry.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3 font-medium text-slate-800">{entry.name}</td>
                  <td className="px-4 py-3 text-slate-500 max-w-48 truncate">{entry.email}</td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700">{entry.city}</span>
                  </td>
                  <td className="px-4 py-3 text-slate-400">
                    {new Date(entry.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </td>
                </tr>
              ))}
              {(data?.entries ?? []).length === 0 && (
                <tr><td colSpan={4} className="px-4 py-12 text-center text-sm text-slate-400">No waitlist signups yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ── Section: Reports ───────────────────────────────────────────────────────
const SEV_COLOR = {
  LOW: 'bg-slate-100 text-slate-600',
  MEDIUM: 'bg-yellow-100 text-yellow-800',
  HIGH: 'bg-orange-100 text-orange-800',
  CRITICAL: 'bg-red-100 text-red-800',
}
const REPORT_ACTIONS = ['APPROVE', 'REJECT', 'SUSPEND', 'INVESTIGATE', 'DISMISS', 'WARN_OWNER']

function ReportsSection() {
  const qc = useQueryClient()
  const [status, setStatus] = useState('PENDING')

  const { data, isLoading } = useQuery({
    queryKey: ['admin-reports', status],
    queryFn: () => adminService.reports({ status, limit: 30 }).then(r => r.data),
  })

  const mutation = useMutation({
    mutationFn: ({ id, action }) => adminService.moderateReport(id, { action }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-reports'] }),
  })

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Reports</h1>
        <p className="text-sm text-slate-400 mt-0.5">Moderate user-submitted reports.</p>
      </div>

      <div className="flex gap-2 flex-wrap">
        {['PENDING', 'UNDER_REVIEW', 'RESOLVED', 'DISMISSED'].map(s => (
          <button
            key={s}
            onClick={() => setStatus(s)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${status === s ? 'bg-[#111111] text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
          >
            {s.replace('_', ' ')}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="h-48 bg-slate-100 rounded-2xl animate-pulse" />
      ) : (
        <div className="space-y-3">
          {(data?.reports ?? []).map(r => (
            <div key={r.id} className="bg-white border border-slate-100 rounded-2xl p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${SEV_COLOR[r.severity]}`}>{r.severity}</span>
                    <span className="text-xs text-slate-500">{r.category?.replace(/_/g, ' ')}</span>
                    <span className="text-xs text-slate-400">{new Date(r.createdAt).toLocaleDateString('en-IN')}</span>
                  </div>
                  <p className="text-sm text-slate-700 mt-2 line-clamp-2">{r.description}</p>
                  {r.property && <p className="text-xs text-slate-400 mt-1">{r.property.title} · {r.property.city}</p>}
                </div>
                <select
                  defaultValue=""
                  onChange={e => { if (e.target.value) mutation.mutate({ id: r.id, action: e.target.value }); e.target.value = '' }}
                  className="border border-slate-200 rounded-lg px-2 py-1 text-xs bg-white flex-shrink-0 focus:outline-none focus:ring-1 focus:ring-brand-500"
                >
                  <option value="">Action</option>
                  {REPORT_ACTIONS.map(a => <option key={a} value={a}>{a.replace('_', ' ')}</option>)}
                </select>
              </div>
            </div>
          ))}
          {(data?.reports ?? []).length === 0 && (
            <div className="text-center py-12 bg-white border border-slate-100 rounded-2xl text-sm text-slate-400">No reports found.</div>
          )}
        </div>
      )}
    </div>
  )
}


// ── Section: Reviews ───────────────────────────────────────────────────────
const REVIEW_STATUS_PILL = {
  PENDING:  'bg-amber-50 text-amber-700',
  APPROVED: 'bg-emerald-50 text-emerald-700',
  REJECTED: 'bg-red-50 text-red-600',
  FLAGGED:  'bg-orange-50 text-orange-700',
}
const REVIEWER_TYPE_LABEL = {
  TENANT: 'Tenant', PREVIOUS_TENANT: 'Ex-tenant',
  NEIGHBOR: 'Neighbor', COMMUNITY: 'Community',
}

const RATING_KEYS_ADMIN = [
  ['ratingsSafety','Safety'], ['ratingsClean','Clean'], ['ratingsWater','Water'],
  ['ratingsNoise','Noise'], ['ratingsInternet','Internet'], ['ratingsParking','Parking'],
  ['ratingsNeighborhood','Neighborhood'], ['ratingsTransport','Transport'],
  ['ratingsMaintenance','Maintenance'], ['ratingsOwnerBehavior','Owner'], ['ratingsSecurity','Security'], ['ratingsPowerBackup','Power'],
]

function AdminReviewCard({ r, onAction, busy }) {
  const [, setSearchParams] = useSearchParams()
  const [expanded, setExpanded] = useState(false)
  const name    = r.isAnonymous ? 'Anonymous' : (r.author?.name || 'Member')
  const initial = r.isAnonymous ? '?' : name[0].toUpperCase()
  const date    = new Date(r.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
  const score   = r.overallScore ?? 0
  const isPending = r.status === 'PENDING' || r.status === 'FLAGGED'

  return (
    <div className={`bg-white border rounded-2xl overflow-hidden transition-shadow hover:shadow-md ${
      isPending ? 'border-amber-200' : 'border-slate-100'
    }`}>
      {/* Top bar: status accent */}
      <div className={`h-1 w-full ${
        r.status === 'PENDING'  ? 'bg-amber-400' :
        r.status === 'APPROVED' ? 'bg-emerald-400' :
        r.status === 'REJECTED' ? 'bg-red-400' :
        'bg-orange-400'
      }`} />

      <div className="p-5 space-y-4">

        {/* Row 1: Reviewer + score + status */}
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-full bg-brand-50 text-brand-700 text-sm font-bold flex items-center justify-center shrink-0 overflow-hidden">
            {r.author?.avatarUrl && !r.isAnonymous
              ? <img src={r.author.avatarUrl} alt="" className="w-full h-full object-cover" />
              : initial}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-semibold text-slate-800">{name}</span>
              <span className="text-xs text-slate-400">{REVIEWER_TYPE_LABEL[r.reviewerType] ?? ''}</span>
              {r.recommend != null && (
                <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                  r.recommend ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'
                }`}>
                  {r.recommend ? '👍 Recommends' : '👎 Not recommended'}
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400 mt-0.5">{date}</p>
          </div>
          <div className="flex flex-col items-end gap-1.5 shrink-0">
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${REVIEW_STATUS_PILL[r.status] ?? 'bg-slate-100 text-slate-500'}`}>
              {r.status.charAt(0) + r.status.slice(1).toLowerCase()}
            </span>
            <div className="flex items-center gap-1">
              <span className="text-base font-bold text-slate-800">{score.toFixed(1)}</span>
              <svg className="w-4 h-4 text-amber-400" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
              </svg>
            </div>
          </div>
        </div>

        {/* Property pill */}
        {r.property && (
          <button
            type="button"
            onClick={() => setSearchParams({ tab: 'review-listings', propertyId: r.property.id })}
            className="w-full flex items-center gap-2 bg-slate-50 hover:bg-brand-50 border border-slate-100 hover:border-brand-200 rounded-xl px-3 py-2 transition-colors group text-left"
          >
            <svg className="w-3.5 h-3.5 text-slate-400 group-hover:text-brand-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" /><polyline points="9 22 9 12 15 12 15 22" />
            </svg>
            <span className="text-xs font-semibold text-slate-700 group-hover:text-brand-700 truncate flex-1">{r.property.title}</span>
            <span className="text-xs text-slate-400 shrink-0">{r.property.city}</span>
            <svg className="w-3 h-3 text-slate-300 group-hover:text-brand-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 5l7 7-7 7" />
            </svg>
          </button>
        )}

        {/* Review body */}
        <div>
          <p className={`text-sm text-slate-700 leading-relaxed ${expanded ? '' : 'line-clamp-3'}`}>
            {r.content || <span className="text-slate-300 italic">No written comment</span>}
          </p>
          {r.content && r.content.length > 160 && (
            <button onClick={() => setExpanded(e => !e)} className="mt-1 text-xs text-brand-600 hover:underline font-medium">
              {expanded ? 'Show less' : 'Read more'}
            </button>
          )}
        </div>

        {/* Rating breakdown — visible when expanded */}
        {expanded && (
          <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 py-2 border-t border-slate-50">
            {RATING_KEYS_ADMIN.map(([key, label]) => {
              const val = r[key] ?? 0
              return (
                <div key={key} className="flex items-center gap-2">
                  <span className="text-[10px] text-slate-400 w-20 shrink-0">{label}</span>
                  <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-amber-400 rounded-full" style={{ width: `${(val / 5) * 100}%` }} />
                  </div>
                  <span className="text-[10px] font-semibold text-slate-600 w-4 text-right shrink-0">{val}</span>
                </div>
              )
            })}
          </div>
        )}

        {/* Owner response */}
        {r.ownerResponse && (
          <div className="ml-2 border-l-2 border-brand-200 pl-3">
            <p className="text-[10px] font-bold text-brand-600 uppercase tracking-wide mb-1">Owner response</p>
            <p className="text-xs text-slate-600 leading-relaxed">{r.ownerResponse}</p>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2 pt-2 border-t border-slate-50">
          {isPending ? (
            <>
              <button
                onClick={() => onAction(r.id, 'APPROVED')}
                disabled={busy}
                className="flex-1 py-2 rounded-xl bg-emerald-500 text-white text-sm font-semibold hover:bg-emerald-600 disabled:opacity-40 transition-colors"
              >
                ✓ Approve
              </button>
              <button
                onClick={() => onAction(r.id, 'FLAGGED')}
                disabled={busy}
                className="px-4 py-2 rounded-xl bg-orange-50 text-orange-600 text-sm font-semibold hover:bg-orange-100 disabled:opacity-40 transition-colors"
              >
                Flag
              </button>
              <button
                onClick={() => onAction(r.id, 'REJECTED')}
                disabled={busy}
                className="flex-1 py-2 rounded-xl bg-red-50 text-red-600 text-sm font-semibold hover:bg-red-100 disabled:opacity-40 transition-colors"
              >
                ✕ Reject
              </button>
            </>
          ) : r.status === 'APPROVED' ? (
            <button
              onClick={() => onAction(r.id, 'REJECTED')}
              disabled={busy}
              className="flex-1 py-2 rounded-xl border border-slate-200 text-slate-500 text-sm font-medium hover:bg-red-50 hover:text-red-600 hover:border-red-200 disabled:opacity-40 transition-colors"
            >
              Revoke approval
            </button>
          ) : (
            <button
              onClick={() => onAction(r.id, 'APPROVED')}
              disabled={busy}
              className="flex-1 py-2 rounded-xl border border-slate-200 text-slate-500 text-sm font-medium hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-200 disabled:opacity-40 transition-colors"
            >
              Approve
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

function AdminReviewsSection() {
  const qc = useQueryClient()
  const [status, setStatus] = useState('PENDING')

  const { data, isLoading } = useQuery({
    queryKey: ['admin-reviews', status],
    queryFn: () => adminService.reviews({ status, limit: 50 }).then(r => r.data),
  })

  const mutation = useMutation({
    mutationFn: ({ id, nextStatus }) => adminService.setReviewStatus(id, nextStatus),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-reviews'] }),
  })

  const reviews = data?.reviews ?? []
  const TABS = ['PENDING', 'APPROVED', 'REJECTED', 'FLAGGED']

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Reviews</h1>
        <p className="text-sm text-slate-400 mt-0.5">Moderate community reviews before they go live.</p>
      </div>

      {/* Status tabs */}
      <div className="flex gap-1.5">
        {TABS.map(s => (
          <button
            key={s}
            onClick={() => setStatus(s)}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-colors ${status === s ? 'bg-[#111111] text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
          >
            {s.charAt(0) + s.slice(1).toLowerCase()}
          </button>
        ))}
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {[1,2,3].map(i => <div key={i} className="h-64 bg-slate-100 rounded-2xl animate-pulse" />)}
        </div>
      ) : reviews.length === 0 ? (
        <div className="text-center py-20 bg-white border border-slate-100 rounded-2xl">
          <p className="text-sm text-slate-400">No {status.toLowerCase()} reviews</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {reviews.map(r => (
            <AdminReviewCard
              key={r.id}
              r={r}
              onAction={(id, nextStatus) => mutation.mutate({ id, nextStatus })}
              busy={mutation.isPending}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ── Settings ───────────────────────────────────────────────────────────────

function AdminSettingsSection() {
  const qc = useQueryClient()

  // ── Profile state ───────────────────────────────────────────────────────
  const { data: profile, isLoading: profileLoading } = useQuery({
    queryKey: ['admin-profile'],
    queryFn: () => adminService.getProfile().then(r => r.data),
  })
  // Only track what the user has explicitly changed — derive the rest from profile
  const [profileOverrides, setProfileOverrides] = useState({})
  const [profileSaving, setProfileSaving] = useState(false)
  const [profileMsg, setProfileMsg] = useState(null)

  const profileForm = {
    name:  profileOverrides.name  ?? profile?.name  ?? '',
    email: profileOverrides.email ?? profile?.email ?? '',
  }
  function setProfileField(field, value) {
    setProfileOverrides(o => ({ ...o, [field]: value }))
  }

  async function handleProfileSave(e) {
    e.preventDefault()
    setProfileSaving(true)
    setProfileMsg(null)
    try {
      await adminService.updateProfile({ name: profileForm.name, email: profileForm.email })
      qc.invalidateQueries({ queryKey: ['admin-profile'] })
      setProfileOverrides({})
      setProfileMsg({ ok: true, text: 'Profile updated.' })
    } catch (err) {
      setProfileMsg({ ok: false, text: err.response?.data?.message ?? 'Failed to update.' })
    } finally { setProfileSaving(false) }
  }

  // ── Password state ──────────────────────────────────────────────────────
  const [pwForm, setPwForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' })
  const [pwSaving, setPwSaving] = useState(false)
  const [pwMsg, setPwMsg] = useState(null)

  async function handlePasswordSave(e) {
    e.preventDefault()
    if (pwForm.newPassword !== pwForm.confirmPassword) {
      setPwMsg({ ok: false, text: 'New passwords do not match.' }); return
    }
    if (pwForm.newPassword.length < 8) {
      setPwMsg({ ok: false, text: 'Password must be at least 8 characters.' }); return
    }
    setPwSaving(true)
    setPwMsg(null)
    try {
      await adminService.changePassword({ currentPassword: pwForm.currentPassword, newPassword: pwForm.newPassword })
      setPwForm({ currentPassword: '', newPassword: '', confirmPassword: '' })
      setPwMsg({ ok: true, text: 'Password changed successfully.' })
    } catch (err) {
      setPwMsg({ ok: false, text: err.response?.data?.message ?? 'Failed to change password.' })
    } finally { setPwSaving(false) }
  }

  // ── Amenities state ─────────────────────────────────────────────────────
  const KNOWN_ICONS = [
    'WiFi','Parking','AC','Lift','Gym','CCTV','Power Backup','Kitchen',
    'Washing Machine','Pet Friendly','Security Guard','Swimming Pool',
    'Gas Pipeline','Piped Gas','Gated Security','Hot Water','Geyser',
    'Balcony','Terrace','Garden','Club House','Intercom','Water Supply',
    'Rainwater Harvesting','Water Purifier','Water Tank','Play Area',
    'Jogging Track','Visitor Parking','Fire Safety','Laundry','TV',
    'Fridge','Sofa','Bed','Wardrobe','Dining Table','Microwave',
    'Solar Panel','EV Charging','Air Cooler',
  ]

  const [newAmenity, setNewAmenity] = useState('')
  const [adding, setAdding] = useState(false)
  const [showCatalogue, setShowCatalogue] = useState(false)

  const { data: amenities = [], isLoading: amenitiesLoading } = useQuery({
    queryKey: ['admin-amenities'],
    queryFn: () => adminService.amenities().then(r => r.data),
  })

  const existingNames = new Set(amenities.map(a => a.name))
  const hasMatchingIcon = KNOWN_ICONS.includes(newAmenity.trim())

  async function handleAdd(e) {
    e.preventDefault()
    const name = newAmenity.trim()
    if (!name) return
    setAdding(true)
    try {
      await adminService.addAmenity(name)
      qc.invalidateQueries({ queryKey: ['admin-amenities'] })
      setNewAmenity('')
    } finally { setAdding(false) }
  }

  async function handleDelete(id) {
    await adminService.deleteAmenity(id)
    qc.invalidateQueries({ queryKey: ['admin-amenities'] })
  }

  const inputCls = 'w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500'
  const saveBtnCls = 'px-4 py-2 bg-[#111111] text-white text-sm font-semibold rounded-xl hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed'

  return (
    <div className="max-w-xl space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Settings</h1>
        <p className="text-sm text-slate-400 mt-0.5">Manage your profile and platform configuration</p>
      </div>

      {/* Profile card */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
        <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-4">Profile</p>
        {profileLoading ? (
          <div className="space-y-3">{[1,2].map(i => <div key={i} className="h-10 bg-slate-100 rounded-xl animate-pulse" />)}</div>
        ) : (
          <form onSubmit={handleProfileSave} className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Name</label>
              <input
                value={profileForm.name}
                onChange={e => setProfileField('name', e.target.value)}
                className={inputCls}
                placeholder="Your name"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Email</label>
              <input
                type="email"
                value={profileForm.email}
                onChange={e => setProfileField('email', e.target.value)}
                className={inputCls}
                placeholder="you@example.com"
              />
            </div>
            {profileMsg && (
              <p className={`text-xs font-medium ${profileMsg.ok ? 'text-green-600' : 'text-red-600'}`}>{profileMsg.text}</p>
            )}
            <div className="flex justify-end">
              <button type="submit" disabled={profileSaving} className={saveBtnCls}>
                {profileSaving ? 'Saving…' : 'Save profile'}
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Password card */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
        <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-4">Change Password</p>
        <form onSubmit={handlePasswordSave} className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Current password</label>
            <input
              type="password"
              value={pwForm.currentPassword}
              onChange={e => setPwForm(f => ({ ...f, currentPassword: e.target.value }))}
              className={inputCls}
              autoComplete="current-password"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">New password</label>
            <input
              type="password"
              value={pwForm.newPassword}
              onChange={e => setPwForm(f => ({ ...f, newPassword: e.target.value }))}
              className={inputCls}
              autoComplete="new-password"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Confirm new password</label>
            <input
              type="password"
              value={pwForm.confirmPassword}
              onChange={e => setPwForm(f => ({ ...f, confirmPassword: e.target.value }))}
              className={inputCls}
              autoComplete="new-password"
            />
          </div>
          {pwMsg && (
            <p className={`text-xs font-medium ${pwMsg.ok ? 'text-green-600' : 'text-red-600'}`}>{pwMsg.text}</p>
          )}
          <div className="flex justify-end">
            <button type="submit" disabled={pwSaving || !pwForm.currentPassword || !pwForm.newPassword} className={saveBtnCls}>
              {pwSaving ? 'Updating…' : 'Change password'}
            </button>
          </div>
        </form>
      </div>

      {/* Amenities card */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
        <div className="flex items-center justify-between mb-4">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">
            Amenities <span className="font-normal text-slate-400">({amenities.length})</span>
          </p>
          <button
            type="button"
            onClick={() => setShowCatalogue(s => !s)}
            className="text-xs text-brand-600 hover:text-brand-700 font-medium"
          >
            {showCatalogue ? 'Hide catalogue' : 'Browse icons'}
          </button>
        </div>

        {/* Icon catalogue */}
        {showCatalogue && (
          <div className="mb-4 p-3 rounded-xl bg-slate-50 border border-slate-100">
            <p className="text-[11px] text-slate-400 mb-2">Click a name to use it in the field below</p>
            <div className="flex flex-wrap gap-1.5">
              {KNOWN_ICONS.filter(n => !existingNames.has(n)).map(name => (
                <button
                  key={name}
                  type="button"
                  onClick={() => { setNewAmenity(name); setShowCatalogue(false) }}
                  className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-white border border-slate-200 hover:border-brand-400 hover:bg-brand-50 text-xs text-slate-700 transition-colors"
                >
                  <span className="text-slate-400"><AmenityIcon name={name} size={13} /></span>
                  {name}
                </button>
              ))}
            </div>
            {KNOWN_ICONS.filter(n => !existingNames.has(n)).length === 0 && (
              <p className="text-xs text-slate-400 text-center py-2">All known icons are already added.</p>
            )}
          </div>
        )}

        {/* Add form */}
        <form onSubmit={handleAdd} className="mb-4">
          <div className="flex gap-2">
            <div className="relative flex-1">
              {newAmenity.trim() && (
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                  <AmenityIcon name={newAmenity.trim()} size={15} />
                </span>
              )}
              <input
                value={newAmenity}
                onChange={e => setNewAmenity(e.target.value)}
                placeholder="Amenity name… (or browse icons above)"
                className={`w-full py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 ${newAmenity.trim() ? 'pl-8 pr-3' : 'px-3'}`}
              />
            </div>
            <button type="submit" disabled={adding || !newAmenity.trim()} className={saveBtnCls}>
              {adding ? 'Adding…' : 'Add'}
            </button>
          </div>
          {newAmenity.trim() && (
            <p className={`text-[11px] mt-1.5 ${hasMatchingIcon ? 'text-green-600' : 'text-slate-400'}`}>
              {hasMatchingIcon ? '✓ Icon matched' : 'No icon match — will use default icon. Try browsing above.'}
            </p>
          )}
        </form>

        {/* List */}
        {amenitiesLoading ? (
          <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-9 bg-slate-100 rounded-xl animate-pulse" />)}</div>
        ) : amenities.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-6">No amenities yet.</p>
        ) : (
          <ul className="space-y-1.5">
            {amenities.map(a => (
              <li key={a.id} className="flex items-center justify-between px-3 py-2 rounded-xl bg-slate-50 border border-slate-100">
                <div className="flex items-center gap-2.5">
                  <span className="text-slate-400 shrink-0"><AmenityIcon name={a.name} size={15} /></span>
                  <span className="text-sm text-slate-700">{a.name}</span>
                </div>
                <button onClick={() => handleDelete(a.id)} className="text-xs text-red-500 hover:text-red-700 font-medium shrink-0">
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

// ── Page ───────────────────────────────────────────────────────────────────
export default function AdminPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const section = searchParams.get('tab') ?? 'overview'

  const setSection = useCallback((id) => {
    setSearchParams({ tab: id }, { replace: true })
  }, [setSearchParams])

  const handleLogout = useCallback(() => {
    localStorage.removeItem('admin_token')
    window.location.href = '/admin/login'
  }, [])

  function renderSection() {
    switch (section) {
      case 'overview':        return <OverviewSection />
      case 'admin-properties':return <AdminPropertiesMap />
      case 'review-listings': return <ReviewListingsSection />
      case 'users':           return <UsersSection />
      case 'waitlist':        return <WaitlistSection />
      case 'reports':         return <ReportsSection />
      case 'reviews':         return <AdminReviewsSection />
      case 'monitor':         return <AdminMonitorSection />
      case 'settings':        return <AdminSettingsSection />
      default:                return <OverviewSection />
    }
  }

  return (
    <div className="flex h-screen bg-slate-50">
      <UnifiedSidebar active={section} onChange={setSection} isAdmin onLogout={handleLogout} userName="Admin" userEmail="Administrator" />

      <main className="flex-1 overflow-y-auto px-8 py-8">
        {renderSection()}
      </main>
    </div>
  )
}
