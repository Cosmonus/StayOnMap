import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Doughnut, Line } from 'react-chartjs-2'
import {
  Chart as ChartJS,
  ArcElement, Tooltip, Legend,
  CategoryScale, LinearScale, BarElement,
  LineElement, PointElement, Filler,
} from 'chart.js'
import {
  X, ChevronLeft, ChevronRight, Home, MapPin, Users, CircleCheck, ArrowLeft, Copy,
  Star, Building2, Eye, EyeOff, User,
} from 'lucide-react'
import { adminService } from '@services/admin.service'
import { formatPrice, formatCurrency, formatCompact, formatCompactPrice } from '@utils/format'
import SEOMeta from '@components/common/SEOMeta'
import { AmenityIcon } from '@components/common/AmenityIcon'
import { googleMapsReady, createHtmlMarker } from '@lib/googleMaps'
import { CITIES } from '@/config/cities'
import AreaInput from '@features/search/components/AreaInput'
import FilterButton from '@features/filters/components/FilterButton'
import FilterSheet from '@features/filters/components/FilterSheet'
import { toQueryParams, countActiveFilters } from '@/config/filters'
import { ADMIN_PARAM_DEFS, ADMIN_DEFAULT_FILTERS, ADMIN_FILTER_SECTIONS, STATUS_OPTIONS } from '@/config/adminFilters'

ChartJS.register(
  ArcElement, Tooltip, Legend,
  CategoryScale, LinearScale, BarElement,
  LineElement, PointElement, Filler,
)
import Select           from '@components/common/Select'
import TrustBadge       from '@components/common/TrustBadge'
import RiskAlert        from '@components/common/RiskAlert'
import PropertyStatusPill from '@components/common/PropertyStatusPill'
import PropertyDetailBody from '@features/properties/components/detail/PropertyDetailBody'
import UnifiedSidebar from '@components/layout/UnifiedSidebar'
import { toast } from '@components/common/Toaster'
import ActionMenu from '@components/common/ActionMenu'
import { confirm } from '@components/common/ConfirmDialog'
import AdminMonitorSection from '@features/admin/components/AdminMonitorSection'
import VerificationsSection from '@features/admin/components/VerificationsSection'
import FunnelCard from '@features/admin/components/FunnelCard'
import DemandCard from '@features/admin/components/DemandCard'
import GraphHealthCard from '@features/admin/components/GraphHealthCard'
import SupplySection from '@features/admin/components/SupplySection'
import ActivityLogSection from '@features/admin/components/ActivityLogSection'
import WaitlistByCity from '@features/admin/components/WaitlistByCity'
import { formatTime } from '@utils/time'

/**
 * What a failed admin fetch must look like.
 *
 * Every section on this page destructured only `{ data, isLoading }` until
 * 2026-08-10, so a rejected query left `data` undefined and fell through to
 * `data?.rows ?? []` — rendering the EMPTY state. On a moderation surface that
 * is the worst failure available: a reports queue that could not load looks
 * exactly like a queue with nothing in it, and an admin reads "all clear" off a
 * screen that failed. Every extracted component in features/admin already did
 * this correctly; the 2,600-line page did not.
 *
 * Named, because "Something went wrong" over an empty table is barely better
 * than the empty table.
 */
function SectionError({ what, onRetry }) {
  return (
    <div className="bg-white border border-red-200 rounded-2xl p-5">
      <p className="text-sm font-semibold text-slate-900">Could not load {what}</p>
      <p className="text-xs text-slate-500 mt-1">
        This is a failure to fetch, not an empty list &mdash; do not read it as &ldquo;nothing to do&rdquo;.
      </p>
      <button
        onClick={onRetry}
        className="mt-4 min-h-[44px] px-4 py-3 rounded-xl border border-slate-200 text-sm font-semibold text-slate-700 hover:bg-slate-50"
      >
        Try again
      </button>
    </div>
  )
}

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
          <p className="text-xs text-slate-500">{footer}</p>
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
  const occupied  = data?.properties?.occupied  ?? 0
  const total     = data?.properties?.total     ?? 0
  const other     = Math.max(0, total - active - pending - suspended - occupied)

  if (total === 0) {
    return <div className="flex items-center justify-center h-48 text-sm text-slate-500">No properties yet</div>
  }

  const chartData = {
    labels: ['Active', 'Occupied', 'Pending', 'Suspended', 'Other'],
    datasets: [{
      data: [active, occupied, pending, suspended, other],
      backgroundColor: ['#22c55e', '#6366f1', '#eab308', '#ef4444', '#cbd5e1'],
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
    { label: 'Occupied',  value: occupied,  color: '#6366f1' },
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
          <span className="text-[11px] text-slate-500 font-semibold uppercase tracking-widest">Total</span>
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
      // brand-600 / brand-600 at 10%. Was #0ea5e9 and rgba(14,165,233,0.10) —
      // the same pre-jade sky blue twice, in hex and in rgb, which is why a
      // search for either form alone would have found only half of it. A chart
      // config is the fourth place a retired palette hides from a class sweep.
      borderColor: '#0d8a5f',
      backgroundColor: 'rgba(13,138,95,0.10)',
      borderWidth: 2,
      pointRadius: 3,
      pointBackgroundColor: '#0d8a5f',
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

// Full names for the type breakdown — TYPE_SHORT below is for map pins, where
// space is the constraint; a dashboard card has room to say the whole word.
const TYPE_LABEL = {
  APARTMENT: 'Apartment', HOUSE: 'House', VILLA: 'Villa', PG: 'PG',
  INDEPENDENT_HOUSE: 'Independent house', COMMERCIAL: 'Shop / Commercial',
  LAND: 'Land / Plot', SHORT_STAY: 'Short stay',
}

function StatTile({ label, value, hint }) {
  return (
    <div className="bg-white border border-slate-100 rounded-2xl px-4 py-3.5">
      <p className="text-2xl font-bold text-slate-900">{(value ?? 0).toLocaleString('en-IN')}</p>
      <p className="text-xs font-semibold text-slate-600 mt-0.5">{label}</p>
      {hint && <p className="text-[11px] text-slate-500 mt-0.5">{hint}</p>}
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
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['admin-analytics'],
    queryFn: () => adminService.analytics().then(r => r.data),
  })

  if (isError) return <SectionError what="the dashboard" onRetry={refetch} />

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

  const byType = [...(data?.properties?.byType ?? [])].sort((a, b) => b.count - a.count)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Overview</h1>
        <p className="text-sm text-slate-500 mt-0.5">Platform health at a glance.</p>
      </div>

      {/* Headline numbers. "Tenants placed" is the owner's mark-tenant action
          (status OCCUPIED) — a CURRENT count, since vacating clears it; signed
          leases are the all-time record of tenancies made through StayOnMap. */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        <StatTile label="Users"          value={data?.users?.total} />
        <StatTile label="Owners"         value={data?.users?.owners} />
        <StatTile label="Renters only"   value={data?.users?.renters} />
        <StatTile label="Properties"     value={data?.properties?.total} />
        <StatTile label="Tenants placed" value={data?.tenancy?.occupiedNow} hint="currently occupied" />
        <StatTile label="Leases signed"  value={data?.tenancy?.leasesSigned} hint="all time" />
      </div>

      {/* Behaviour, above the row-count charts: how many of the people who
          arrived ever booked is the question those charts cannot answer.
          Beside it, the question the funnel in turn cannot answer — what people
          asked for that we had nothing to show. Side by side from lg, because
          they are read together: a funnel that leaks at the top and a pile of
          empty searches in one area are the same finding. */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <FunnelCard />
        <DemandCard />
      </div>

      {/* Is the intelligence layer actually built? Coverage, not speed — a
          listing with no edges and a listing whose edges are slow look
          identical to a user, and only one of them has ever happened. */}
      <GraphHealthCard />

      {/* Row 1: Total Users full width */}
      <ChartCard
        title="Total Users"
        value={data?.users?.total ?? 0}
        footer={`Monthly signups · ${monthRange}`}
      >
        {/* Owner implies renter capability (no BOTH role) — "renters" means
            renter-only accounts, so the two add up to the total. */}
        {data?.users?.owners != null && (
          <div className="flex items-center gap-4 pb-2">
            <span className="flex items-center gap-1.5 text-xs text-slate-500">
              <span className="w-2.5 h-2.5 rounded-sm bg-brand-500 shrink-0" />
              Owners <span className="font-bold text-slate-800">{data.users.owners}</span>
            </span>
            <span className="flex items-center gap-1.5 text-xs text-slate-500">
              <span className="w-2.5 h-2.5 rounded-sm bg-sky-400 shrink-0" />
              Renters only <span className="font-bold text-slate-800">{data.users.renters}</span>
            </span>
          </div>
        )}
        <TotalUsersChart monthly={data?.users?.monthly ?? []} />
      </ChartCard>

      {/* Row 2: Property distribution + type breakdown + platform health */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        <ChartCard
          title="Property Distribution"
          value={propTotal}
          footer="Breakdown by current status"
        >
          <PropertyDonut data={data} />
        </ChartCard>

        <ChartCard
          title="Property Types"
          footer="All 6 categories, every status included"
        >
          {byType.length === 0 ? (
            <div className="flex items-center justify-center h-48 text-sm text-slate-500">No properties yet</div>
          ) : (
            <div className="space-y-3 pt-1">
              {byType.map(t => (
                <MetricBar
                  key={t.type}
                  label={TYPE_LABEL[t.type] ?? t.type.replace(/_/g, ' ')}
                  value={t.count}
                  max={Math.max(1, propTotal)}
                />
              ))}
            </div>
          )}
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
  LAND: 'Land', SHORT_STAY: 'Stay',
}

function makeMapPin(pin, selected) {
  // Admin pins mix RENT and LEASE listings (and LAND totals), so no "/mo"
  // suffix — a lease lump sum labelled monthly is exactly the misread to avoid.
  const rent  = formatCompact(Number(pin.rent))
  const type  = TYPE_SHORT[pin.type] ?? ''
  const label = type ? `${rent} · ${type}` : rent
  const el    = document.createElement('div')
  el.setAttribute('aria-label', `Property at ${rent}`)
  el.style.cssText = `
    display:inline-flex;align-items:center;padding:4px 10px;
    border-radius:999px;font-size:12px;font-weight:600;
    font-family:'Plus Jakarta Sans',sans-serif;white-space:nowrap;cursor:pointer;
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

// Password field with a show/hide toggle — same affordance and icons as
// AdminLoginPage/LoginModal/ResetPasswordPage. Each instance owns its own
// visibility so revealing "current" doesn't also reveal "new". tabIndex={-1}
// keeps the eye out of the tab order: Tab should move between the three
// password fields, not stop on a decoration between each one.
function AdminPasswordField({ label, value, onChange, autoComplete }) {
  const [show, setShow] = useState(false)
  return (
    <div>
      <label className="block text-xs font-medium text-slate-500 mb-1">{label}</label>
      <div className="relative">
        <input
          type={show ? 'text' : 'password'}
          value={value}
          onChange={onChange}
          autoComplete={autoComplete}
          className="w-full px-3 py-2 pr-10 rounded-xl border border-slate-200 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
        />
        <button
          type="button"
          onClick={() => setShow((v) => !v)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-600 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 rounded"
          tabIndex={-1}
          aria-label={show ? 'Hide password' : 'Show password'}
        >
          {show ? <EyeOff size={16} strokeWidth={1.8} /> : <Eye size={16} strokeWidth={1.8} />}
        </button>
      </div>
    </div>
  )
}

// ── Admin property popup (right panel, mirrors user PropertyPopup) ──────────
// BHK_OPTIONS_MAP / TYPE_FILTERS / STATUS_FILTERS used to live here, hand-kept
// and drifting: the BHK list was missing Studio (so admins couldn't find studio
// listings at all), the type list was 8 flat enum chips instead of the user's 6
// category cards, and STATUS_FILTERS disagreed with ReviewListingsSection's own
// inline copy. All three now come from config/adminFilters.js.

// Type-appropriate headline chip — BHK only means something for residential types
function typeHeadline(p) {
  if (!p) return null
  switch (p.type) {
    case 'PG':         return p.sharing ? `${p.sharing}-Sharing PG` : 'PG'
    case 'SHORT_STAY': return p.maxGuests ? `Up to ${p.maxGuests} guests` : null
    case 'LAND':       return p.extent ? `${Number(p.extent).toLocaleString('en-IN')} ${(p.extentUnit ?? 'sq.ft').toLowerCase()}` : null
    case 'COMMERCIAL': return p.carpetArea ? `${Number(p.carpetArea).toLocaleString('en-IN')} sq.ft carpet` : null
    default:           return p.bhk === 0 ? 'Studio' : p.bhk ? `${p.bhk} BHK` : null
  }
}

// LAND repurposes rent as total price; SHORT_STAY's headline price is per
// night; everything else reads through formatPrice, which knows a LEASE
// listing's rent column holds a lump sum and must never render "/mo".
function priceLabel(p) {
  if (!p) return ''
  if (p.type === 'SHORT_STAY') return `${formatCurrency(Number(p.nightlyRate ?? p.rent))}/night`
  if (p.type === 'LAND') return formatCurrency(Number(p.rent))
  return formatPrice(p)
}

function AdminPropertyPopup({ property, isLoading, onClose, onViewFull, onApprove, onSuspend, onReject }) {
  const [imgIdx, setImgIdx] = useState(0)
  const images    = property?.images ?? []
  const amenities = property?.amenities ?? []
  const bhkLabel  = typeHeadline(property)

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
          className="shrink-0 p-1 rounded-lg text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition-colors"
        >
          <X size={16} />
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
                    <ChevronLeft size={12} color="white" strokeWidth={2.5} />
                  </button>
                  <button
                    onClick={() => setImgIdx(i => (i + 1) % images.length)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-black/50 hover:bg-black/70 flex items-center justify-center"
                  >
                    <ChevronRight size={12} color="white" strokeWidth={2.5} />
                  </button>
                  <div className="absolute bottom-2 right-3 bg-black/50 text-white text-xs px-2 py-0.5 rounded-full">
                    {imgIdx + 1}/{images.length}
                  </div>
                </>
              )}
            </>
          ) : (
                        <div className="w-full h-full flex items-center justify-center text-slate-500">
              <Home className="w-10 h-10" />
            </div>
          )}
        </div>

        {/* Details */}
        <div className="px-4 pt-4 pb-3 space-y-3">
          {/* Risk warning — renders nothing unless MEDIUM or worse */}
          {!isLoading && property?.riskScore && <RiskAlert riskScore={property.riskScore} />}

          {isLoading ? (
            <div className="w-28 h-7 bg-slate-100 rounded animate-pulse" />
          ) : (
            <div className="flex items-end justify-between gap-2">
              <div>
                <p className="text-2xl font-bold text-slate-900 leading-none">
                  {priceLabel(property)}
                </p>
                {property?.deposit > 0 && (
                  <p className="text-xs text-slate-500 mt-1">
                    {property?.type === 'LAND' ? 'Advance' : 'Deposit'}: ₹{Number(property.deposit).toLocaleString('en-IN')}
                  </p>
                )}
              </div>
              {property?.maintenance > 0 && (
                <p className="text-xs text-slate-500 text-right">
                  +₹{Number(property.maintenance).toLocaleString('en-IN')}<br />
                  <span className="text-slate-500">maintenance</span>
                </p>
              )}
            </div>
          )}

          {!isLoading && (
            <div className="flex flex-wrap items-center gap-1.5">
              {property?.trustScore?.badge && <TrustBadge badge={property.trustScore.badge} size="sm" />}
              {property?.pricingModel === 'LEASE' && (
                <span className="px-2 py-0.5 bg-amber-50 text-amber-700 rounded-full text-xs font-bold">Lease listing</span>
              )}
              {bhkLabel && <span className="px-2 py-0.5 bg-brand-50 text-brand-600 rounded-full text-xs font-semibold">{bhkLabel}</span>}
              {property?.houseStyle && (
                <span className="px-2 py-0.5 bg-slate-100 rounded-full text-xs font-medium text-slate-600">{property.houseStyle}</span>
              )}
              {property?.furnished && property?.type !== 'LAND' && (
                <span className="px-2 py-0.5 bg-slate-100 rounded-full text-xs font-medium text-slate-600">
                  {property.furnished.charAt(0) + property.furnished.slice(1).toLowerCase()}
                </span>
              )}
              {property?.type && (
                <span className="px-2 py-0.5 bg-slate-100 rounded-full text-xs font-medium text-slate-600">
                  {property.type.replace(/_/g, ' ')}
                </span>
              )}
            </div>
          )}

          {!isLoading && property?.address && (
            <div className="flex items-start gap-1.5">
              <MapPin className="w-4 h-4 text-slate-500 mt-0.5 shrink-0" strokeWidth={1.8} />
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
                  : <span className="text-[11px] font-bold text-slate-500">{(property.owner.name || property.owner.email || '?')[0].toUpperCase()}</span>
                }
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-slate-700 truncate">{property.owner.name || property.owner.email?.split('@')[0]}</p>
                <p className="text-[11px] text-slate-500">Owner</p>
              </div>
            </div>
          )}

          {amenities.length > 0 && !isLoading && (
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Amenities</p>
              <div className="flex flex-wrap gap-1.5">
                {amenities.slice(0, 8).map(a => (
                  <span key={a.amenity?.name} className="px-2 py-1 bg-slate-50 border border-slate-100 rounded-lg text-xs text-slate-600 whitespace-nowrap">
                    {a.amenity?.name}
                  </span>
                ))}
                {amenities.length > 8 && (
                  <span className="px-2 py-1 text-xs text-slate-500 bg-slate-50 border border-slate-100 rounded-lg">+{amenities.length - 8} more</span>
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
              className="min-h-[44px] w-full py-3 text-center text-sm font-semibold text-white bg-[#111111] hover:bg-[#2a2a2a] rounded-xl transition-colors"
            >
              View Full Details
            </button>
            {/* Only what this status can actually become. "Approve" used to show
                on a DRAFT too, which would have published an owner's unfinished
                listing — the server refuses that now, so offering it was only
                ever a route to an error. DRAFT / INACTIVE / OCCUPIED are the
                owner's own states and an admin has no business writing them. */}
            <div className="flex gap-2">
              {['PENDING', 'SUSPENDED', 'REJECTED'].includes(property.status) && (
                <button onClick={onApprove} className="min-h-[44px] flex-1 py-3 text-xs font-semibold text-green-700 bg-green-50 hover:bg-green-100 rounded-xl border border-green-200 transition-colors">
                  {property.status === 'SUSPENDED' ? 'Reinstate' : 'Approve'}
                </button>
              )}
              {['ACTIVE', 'PENDING', 'OCCUPIED'].includes(property.status) && (
                <button onClick={onSuspend} className="min-h-[44px] flex-1 py-3 text-xs font-semibold text-orange-700 bg-orange-50 hover:bg-orange-100 rounded-xl border border-orange-200 transition-colors">
                  ⏸ Pause
                </button>
              )}
              {property.status !== 'REJECTED' && property.status !== 'DRAFT' && (
                <button onClick={onReject} className="min-h-[44px] flex-1 py-3 text-xs font-semibold text-red-700 bg-red-50 hover:bg-red-100 rounded-xl border border-red-200 transition-colors">
                  Reject
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// An admin's power over a listing is to pause it, approve it, or reject it —
// never to create or delete one (that is the owner's, see
// properties.service.js). Pausing and rejecting take somebody's listing off
// the map, so both ask for a reason here: the server requires it, the owner is
// sent it verbatim, and the activity log keeps it.
//
// Returns false when dismissed, '' when no reason is needed, else the text.
const MODERATION_PROMPT = {
  SUSPENDED: {
    title: 'Pause this listing?',
    message: 'It comes off the map immediately and stops receiving visit requests. The owner is told, with your reason.',
    confirmLabel: 'Pause listing',
    variant: 'warning',
    label: 'Why are you pausing it?',
    placeholder: 'e.g. Photos appear reused from another listing',
  },
  REJECTED: {
    title: 'Reject this listing?',
    message: 'It won’t go on the map. The owner can edit it and submit again.',
    confirmLabel: 'Reject listing',
    variant: 'danger',
    label: 'Why is it being rejected?',
    placeholder: 'e.g. Address doesn’t match the ownership document',
  },
}

async function askModerationReason(status, title) {
  const cfg = MODERATION_PROMPT[status]
  if (!cfg) return ''   // ACTIVE — approving or reinstating needs no justification
  const reason = await confirm({
    title: cfg.title,
    message: title ? `“${title}” — ${cfg.message}` : cfg.message,
    confirmLabel: cfg.confirmLabel,
    variant: cfg.variant,
    reason: { label: cfg.label, placeholder: cfg.placeholder, minLength: 5 },
  })
  return reason || false
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
  // One filter object driven by the shared config, replacing the five
  // hand-rolled useStates (city/area/bhk/type/status) this panel used to keep.
  // `area` lives in here too — it's search context (geocode + fly), never sent
  // as a query param, same contract as the user side's SEARCH_KEYS.
  const [filters, setFilters]           = useState(ADMIN_DEFAULT_FILTERS)
  const [filterSheetOpen, setFilterSheetOpen] = useState(false)
  const [selectedId, setSelectedId]     = useState(null)
  const [popupProperty, setPopupProperty] = useState(null)
  const [loadingPopup, setLoadingPopup] = useState(false)
  const [fullDetail, setFullDetail]     = useState(null)

  const { city, area } = filters
  const patchFilters = useCallback((patch) => setFilters((prev) => ({ ...prev, ...patch })), [])
  const setArea = useCallback((v) => patchFilters({ area: v }), [patchFilters])

  // Sent to the API — everything except the search context. Serialized here so
  // the fetch effect can depend on the string rather than a new object identity
  // every render (which would refetch on every keystroke elsewhere).
  const queryParams = useMemo(() => toQueryParams(filters, ADMIN_PARAM_DEFS), [filters])
  const queryKey = JSON.stringify(queryParams)

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
        clickableIcons: false,   // Google's POI info windows fight our pins
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
    el.style.filter = 'drop-shadow(0 3px 6px rgba(28,26,22,0.45))'
    el.innerHTML = `<svg width="32" height="42" viewBox="0 0 32 42" fill="none"><path d="M16 0C7.163 0 0 7.163 0 16c0 10.5 16 26 16 26S32 26.5 32 16C32 7.163 24.837 0 16 0z" fill="#1c1a16"/><circle cx="16" cy="16" r="6" fill="white"/></svg>`
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
      // swLat/swLng/neLat/neLng — the same bounds contract as the public map.
      // This panel used to send south/west/north/east, a naming fork that was
      // the only reason admin couldn't reuse the shared parseBounds/geo utils.
      adminService.pins({
        swLat: sw.lat(), swLng: sw.lng(), neLat: ne.lat(), neLng: ne.lng(),
        ...queryParams,
      })
        .then(r => { if (!cancelled) setPins(Array.isArray(r.data) ? r.data : []) })
        .catch(() => {})
    }

    fetchPins()
    const idle = window.google.maps.event.addListener(map, 'idle', () => {
      clearTimeout(debounce)
      debounce = setTimeout(fetchPins, 400)
    })
    return () => { cancelled = true; clearTimeout(debounce); window.google.maps.event.removeListener(idle) }
    // queryKey, not queryParams — a fresh object each render would refetch forever.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapReady, queryKey])

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

  async function handleStatusAction(status) {
    if (!popupProperty) return
    // Pausing and rejecting need a reason: the owner is sent this text and the
    // activity log keeps it. Reinstating doesn't — nothing to justify.
    const note = await askModerationReason(status, popupProperty.title)
    if (note === false) return
    adminService.setPropertyStatus(popupProperty.id, { status, note: note || undefined })
      .then(() => {
        qc.invalidateQueries({ queryKey: ['admin-analytics'] })
        setPopupProperty(prev => prev ? { ...prev, status } : null)
      })
      .catch((err) => toast.error('Couldn’t update the listing', err.message ?? 'Please try again'))
  }

  async function moderateFullDetail(id, status) {
    const note = await askModerationReason(status, fullDetail?.title)
    if (note === false) return
    adminService.setPropertyStatus(id, { status, note: note || undefined })
      .then(() => { qc.invalidateQueries({ queryKey: ['admin-analytics'] }); setFullDetail(null) })
      .catch((err) => toast.error('Couldn’t update the listing', err.message ?? 'Please try again'))
  }

  // Full detail view
  if (fullDetail) {
    return (
      <PropertyDetailView
        property={fullDetail}
        onBack={() => setFullDetail(null)}
        onRefresh={() => adminService.propertyById(fullDetail.id).then(r => setFullDetail(r.data)).catch(() => {})}
        onApprove={(id) => moderateFullDetail(id, 'ACTIVE')}
        onReject={(id) => moderateFullDetail(id, 'REJECTED')}
        onSuspend={(id) => moderateFullDetail(id, 'SUSPENDED')}
      />
    )
  }

  const activeCount = countActiveFilters(filters, ADMIN_PARAM_DEFS)

  return (
    <div className="flex h-[100vh] -mx-8 -my-8 overflow-hidden">

      {/* ── Map + floating filter bar + right popup ── */}
      <div className="relative flex-1 overflow-hidden">
        <div ref={containerRef} className="absolute inset-0" />

        {/* Floating filter bar — the same shape as the public map's Header bar
            (search pill + Filters button opening the sheet), so admins and
            users get one filter UI, not a sidebar fork.

            Area is search context, not a sheet row — it only geocodes and
            flies the map. The city dropdown was removed 2026-07-22 (operator
            decision): admin search is location-only like the public map, and
            typing an area is how you scope. */}
        <div className="absolute top-4 left-4 right-4 z-10 flex items-center gap-2.5 pointer-events-none">
          <div className="flex items-center gap-2.5 h-12 md:h-14 pl-2 pr-1.5 md:pr-2 bg-white rounded-full border border-slate-200 shadow-md pointer-events-auto min-w-0">
            <div className="w-56 md:w-72 min-w-0">
              <AreaInput
                value={area}
                city={city}
                onChange={setArea}
                onPlacePicked={handlePlacePicked}
                onClear={handleAreaClear}
                showLabel={false}
                bare
              />
            </div>
          </div>
          <div className="pointer-events-auto">
            <FilterButton activeCount={activeCount} onClick={() => setFilterSheetOpen(true)} />
          </div>
        </div>

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

      {/* Same sheet the public map opens — Moderation (status/risk) first, then
          the full user filter set, generated from config/adminFilters.js.
          showCount={false}: GET /properties/count is the ACTIVE-only public
          endpoint and has no status/riskLevel params, so it can't count an
          admin draft — the button reads "Show results" instead. */}
      <FilterSheet
        isOpen={filterSheetOpen}
        onClose={() => setFilterSheetOpen(false)}
        value={filters}
        onApply={setFilters}
        sections={ADMIN_FILTER_SECTIONS}
        defs={ADMIN_PARAM_DEFS}
        defaults={ADMIN_DEFAULT_FILTERS}
        showCount={false}
        showModeToggle={false}
      />
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
      <span className="text-[11px] font-bold text-slate-500">{display[0]?.toUpperCase()}</span>
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
  // Through the shared helper (utils/format.js): this ladder had already grown
  // four cases by hand and SALE would have been a fifth place to get it wrong.
  const priceText = property.type === 'SHORT_STAY'
    ? `${formatCompact(Number(property.nightlyRate ?? property.rent))}/night`
    : formatCompactPrice(property)
  const headline = typeHeadline(property)
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
          <img src={img} alt="" loading="lazy" decoding="async" className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-300" />
        ) : (
                    <div className="w-full h-full flex items-center justify-center text-slate-500">
            <Home className="w-10 h-10" />
          </div>
        )}
        <span className="absolute top-2 left-2"><PropertyStatusPill status={property.status} size="sm" /></span>
      </div>

      <div className="p-3.5 space-y-2">
        <div>
          <p className="text-sm font-bold text-slate-800 truncate">{property.title}</p>
          {property.displayId && (
            <p className="text-[11px] font-mono text-slate-500">{property.displayId}</p>
          )}
          <p className="text-xs text-slate-500 mt-0.5">
            {priceText}
            {property.city ? ` · ${property.city}` : ''}
            {headline ? ` · ${headline}` : ''}
          </p>
        </div>

        {/* Trust + type chips */}
        <div className="flex flex-wrap items-center gap-1.5">
          {property.trustScore?.badge && <TrustBadge badge={property.trustScore.badge} size="sm" />}
          <span className="px-2 py-0.5 rounded-full bg-slate-100 text-[11px] font-medium text-slate-600">
            {property.type?.replace(/_/g, ' ')}
          </span>
          {property.pricingModel === 'LEASE' && (
            <span className="px-2 py-0.5 rounded-full bg-amber-50 text-[11px] font-bold text-amber-700">Lease</span>
          )}
        </div>

        {/* Owner line */}
        <div className="flex items-center gap-2">
          <Avatar name={property.owner?.name} email={property.owner?.email} avatarUrl={property.owner?.avatarUrl} />
          <span className="text-xs text-slate-600 font-medium truncate">{ownerName}</span>
        </div>

        {/* Contacted & Visited stats */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-blue-50">
            <Users size={13} stroke="#3b82f6" strokeWidth={2} />
            <span className="text-[11px] font-semibold text-blue-700">{contactedSet.size} contacted</span>
          </div>
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-green-50">
            <CircleCheck size={13} stroke="#22c55e" strokeWidth={2} />
            <span className="text-[11px] font-semibold text-green-700">{visitedCount} visited</span>
          </div>
        </div>

        {/* View More */}
        <button className="min-h-[44px] w-full py-3 text-xs font-semibold text-brand-600 bg-brand-50 hover:bg-brand-100 rounded-xl transition-colors">
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

/* ── Section label helper ── */
function SectionLabel({ children }) {
  return <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2.5">{children}</p>
}

/* ── Inline property detail view (3 columns: Property | Users | User Detail) ── */
/**
 * Re-run the checks on one listing.
 *
 * Both endpoints existed with NO caller anywhere in the app — `POST
 * /admin/trust-scores/:id/recalculate` and `POST /admin/ai/fraud-scan/:id`,
 * built and unreachable, like the activity log was. Surfaced 2026-08-10.
 *
 * The fraud scan is GATED on `property.aiEnabled`, because `scoreFraud`
 * short-circuits to `{score: 0, signals: []}` whenever AI_PROVIDER is not
 * anthropic — which is production. An always-inert button is the thing this
 * codebase removed from the login screen the same week; it must not reappear
 * here. Recalculation is deterministic and always offered.
 */
function RecheckMenu({ property, onRefresh }) {
  const [busy, setBusy] = useState(null)

  async function run(kind, fn, done) {
    setBusy(kind)
    try {
      const res = await fn()
      done(res.data)
      // Refresh is passed IN, never assumed. This screen has two call sites and
      // only one is React Query-backed: the properties map holds its detail in
      // plain state, so invalidating a query key there would leave the new
      // score computed, stored, and invisible — the action appearing to do
      // nothing, which is the worst outcome for a button whose whole job is to
      // recompute a number.
      onRefresh?.()
    } catch (err) {
      toast.error('Could not run', err?.message ?? 'Please try again')
    } finally {
      setBusy(null)
    }
  }

  const items = [
    {
      label: busy === 'scores' ? 'Recalculating…' : 'Recalculate trust & risk',
      onClick: () => run('scores', () => adminService.recalculateScores(property.id), (d) =>
        toast.success('Scores recalculated', `Trust ${d?.trust?.overallScore ?? '—'} · risk ${d?.risk?.level ?? '—'}`)),
    },
    ...(property.aiEnabled
      ? [{
        label: busy === 'fraud' ? 'Scanning…' : 'Run AI fraud scan',
        onClick: () => run('fraud', () => adminService.fraudScan(property.id), (d) =>
          toast.success('Fraud scan complete', d?.score > 70
            ? `Flagged — score ${d.score}`
            : `No flag raised — score ${d?.score ?? 0}`)),
      }]
      : []),
  ]

  return (
    <ActionMenu
      items={items}
      label="Re-run checks"
      triggerClassName="min-h-[44px] px-3 py-3 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50"
    />
  )
}

function PropertyDetailView({ property, onBack, onApprove, onReject, onSuspend, onRefresh }) {
  const [selectedUserId, setSelectedUserId] = useState(null)

  useEffect(() => { setSelectedUserId(null) }, [property?.id])

  if (!property) return null

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
            <ArrowLeft size={16} />
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
                  <Copy size={10} strokeWidth={2.5} />
                </button>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-0.5">{property.address}, {property.city}</p>
          </div>
        </div>
        {/* Actions follow the status. Approve/Reject only made sense on a
            PENDING listing, which left the moderation surface literally called
            "Review Listings" with NO way to pause a live one — the whole point
            of an admin's power over a listing. Pausing is the response to a
            problem found on something already on the map, which is exactly
            what an admin is reading this page to decide. */}
        <div className="flex items-center gap-2 shrink-0">
          <PropertyStatusPill status={property.status} />
          {property.status === 'PENDING' && (
            <>
              <button onClick={() => onApprove(property.id)} className="min-h-[44px] px-4 py-3 text-xs font-semibold text-white bg-green-600 hover:bg-green-700 rounded-xl transition-colors">Approve</button>
              <button onClick={() => onReject(property.id)} className="min-h-[44px] px-4 py-3 text-xs font-semibold text-white bg-red-500 hover:bg-red-600 rounded-xl transition-colors">Reject</button>
            </>
          )}
          {['ACTIVE', 'PENDING', 'OCCUPIED'].includes(property.status) && (
            <button onClick={() => onSuspend?.(property.id)} className="min-h-[44px] px-4 py-3 text-xs font-semibold text-orange-700 bg-orange-50 hover:bg-orange-100 border border-orange-200 rounded-xl transition-colors">
              Pause
            </button>
          )}
          {property.status === 'SUSPENDED' && (
            <button onClick={() => onApprove(property.id)} className="min-h-[44px] px-4 py-3 text-xs font-semibold text-white bg-green-600 hover:bg-green-700 rounded-xl transition-colors">
              Reinstate
            </button>
          )}
          {/* Behind the menu, not beside the moderation buttons: this row can
              already show three, and ui-ux.md caps it at two plus an overflow.
              These are also a different KIND of action — they change nothing
              a renter sees, they re-derive what we know about the listing. */}
          <RecheckMenu property={property} onRefresh={onRefresh} />
        </div>
      </div>

      {/* 3-column body */}
      {/* Below lg the three columns stack and the page scrolls as one; at lg+
          each column scrolls independently. Tailwind's arbitrary-value grid
          form (not an inline style) so the base CAN stack — see ui-ux.md's
          PR #57 lessons. */}
      <div className="flex-1 grid grid-cols-1 divide-y overflow-y-auto lg:grid-cols-[5fr_3fr_4fr] lg:divide-y-0 lg:divide-x lg:overflow-visible divide-slate-200 min-h-0 bg-white">

        {/* ── Column 1: Property Details ──
            Operator decision (2026-07-22): this column renders the EXACT same
            UI as the public property page via the shared PropertyDetailBody
            (variant="admin" — tenant actions suppressed). The other two
            columns keep their admin layout untouched. */}
        <div className="overflow-y-auto thin-scrollbar bg-slate-50">
          <div className="pt-5">
            <PropertyDetailBody property={property} variant="admin" />
          </div>

          {/* Wishlisted by — admin-only data with no tenant-page equivalent */}
          {(property.savedBy?.length ?? 0) > 0 && (
            <div className="max-w-7xl mx-auto px-4 sm:px-6 pb-6">
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
            </div>
          )}
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
                      <ChevronRight
                        size={14}
                        stroke={isActive ? '#6366f1' : '#94a3b8'} strokeWidth={2}
                        className={`shrink-0 transition-transform ${isActive ? 'rotate-90' : ''}`}
                      />
                    </div>
                    <div className="flex items-center gap-2 mt-2.5">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-50 border border-blue-100 text-[11px] font-semibold text-blue-700">
                        {u.appointmentCount} appt{u.appointmentCount !== 1 ? 's' : ''}
                      </span>
                      {u.visitedCount > 0 && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-green-50 border border-green-100 text-[11px] font-semibold text-green-700">
                          visited
                        </span>
                      )}
                      {u.hasConversation && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-purple-50 border border-purple-100 text-[11px] font-semibold text-purple-700">
                          chatted
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
                <Users className="w-6 h-6" strokeWidth={1.8} aria-hidden="true" />
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
                  {selectedUser.phone && <p className="text-xs text-slate-500 mt-0.5">{selectedUser.phone}</p>}
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
                        <p className="text-xs text-slate-500">{fmtDate(r.createdAt)}</p>
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
                          <span className="text-sm font-medium text-slate-700">{fmtDate(a.requestedDate)}{a.requestedTime ? ` at ${formatTime(a.requestedTime)}` : ''}</span>
                          <span className={`shrink-0 px-2 py-0.5 rounded-md text-[11px] font-semibold ${APPT_BADGE[a.status] ?? 'bg-slate-100 text-slate-600'}`}>{a.status}</span>
                        </div>
                        {a.contactNumber && <p className="text-xs text-slate-500">{a.contactNumber}</p>}
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
                                {m.editedAt && !m.deletedAt && (
                                  <span className={`text-[11px] ${isOwner ? 'text-white/50' : 'text-slate-500'}`}>edited</span>
                                )}
                                <span className={`text-[11px] ${isOwner ? 'text-white/50' : 'text-slate-500'}`}>{new Date(m.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</span>
                              </div>
                              {m.deletedAt ? (
                                <p className={`text-sm italic ${isOwner ? 'text-white/70' : 'text-slate-500'}`}>This message was deleted</p>
                              ) : (
                                <>
                                  {m.attachmentUrl && (
                                    // Same behaviour the user-side chat got 2026-07-27: the
                                    // thumbnail opens the photo full size, not a 200px crop.
                                    <a href={m.attachmentUrl} target="_blank" rel="noreferrer" aria-label="Open photo full size">
                                      <img src={m.attachmentUrl} alt="Attachment" className="max-w-[200px] max-h-[200px] rounded-lg object-cover mb-1" />
                                    </a>
                                  )}
                                  {m.body && <p className={`text-sm leading-relaxed ${isOwner ? 'text-white' : 'text-slate-700'}`}>{m.body}</p>}
                                </>
                              )}
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
                <User className="w-6 h-6" strokeWidth={1.8} aria-hidden="true" />
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
  const [selectedId, setSelectedId] = useState(null)

  const deepLinkId = searchParams.get('propertyId')

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['admin-review-listings', statusFilter],
    queryFn: () => adminService.properties({ status: statusFilter || undefined, limit: 50 }).then(r => r.data),
    staleTime: 0,
  })

  // Opening a card always fetches the full property — list rows are summaries
  // and no longer carry chat threads (the unbounded include was an OOM risk).
  const { data: selectedProperty } = useQuery({
    queryKey: ['admin-property', selectedId],
    queryFn: () => adminService.propertyById(selectedId).then(r => r.data),
    enabled: !!selectedId,
  })

  useEffect(() => {
    if (deepLinkId) {
      setSelectedId(deepLinkId)
      setSearchParams({ tab: 'review-listings' }, { replace: true })
    }
  }, [deepLinkId, setSearchParams])

  const mutation = useMutation({
    mutationFn: ({ id, status, note }) => adminService.setPropertyStatus(id, { status, note }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-review-listings'] })
      setSelectedId(null)
    },
    onError: (err) => toast.error('Couldn’t update the listing', err.message ?? 'Please try again'),
  })

  // Same rule as the map popup: a takedown states its reason, an approval
  // doesn't need one.
  async function moderate(id, status, title) {
    const note = await askModerationReason(status, title)
    if (note === false) return
    mutation.mutate({ id, status, note: note || undefined })
  }

  // Guarded here, after every hook, and BEFORE `properties` is derived —
  // `data?.properties ?? []` is precisely the line that turns a failed fetch
  // into "nothing to review".
  if (isError) return <SectionError what="listings to review" onRetry={refetch} />

  const properties = data?.properties ?? []

  // Show detail view inline when a property is selected
  if (selectedId) {
    if (!selectedProperty) {
      return <div className="bg-slate-100 animate-pulse rounded-xl h-[420px]" />
    }
    return (
      <PropertyDetailView
        property={selectedProperty}
        onBack={() => setSelectedId(null)}
        onApprove={(id) => moderate(id, 'ACTIVE', selectedProperty.title)}
        onReject={(id) => moderate(id, 'REJECTED', selectedProperty.title)}
        onSuspend={(id) => moderate(id, 'SUSPENDED', selectedProperty.title)}
        onRefresh={() => qc.invalidateQueries({ queryKey: ['admin-property', selectedId] })}
      />
    )
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Review Listings</h1>
        <p className="text-sm text-slate-500 mt-0.5">Review and approve submitted listings. Click any card for full details.</p>
      </div>

      {/* Status list comes from the shared config — this used to be an inline
          array that had silently drifted from AdminPropertiesMap's (INACTIVE
          was missing here, so those listings were unreachable from this tab). */}
      <div className="flex gap-2 flex-wrap">
        {[{ value: '', label: 'All' }, ...STATUS_OPTIONS].map(({ value, label }) => (
          <button
            key={value}
            onClick={() => setStatusFilter(value)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors focus:ring-2 focus:ring-brand-500 ${statusFilter === value ? 'bg-[#111111] text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
          >
            {label}
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
            <ReviewCard key={p.id} property={p} onSelect={(prop) => setSelectedId(prop.id)} />
          ))}
        </div>
      )}
    </div>
  )
}

// ── Section: Users ─────────────────────────────────────────────────────────
// One account, two hats: the user side now splits chat, notifications and
// appointments by renter/owner mode, and the admin view of a person follows
// the same partition — what they did as a renter, what they hold as an owner.
const LEASE_BADGE = {
  OFFERED: 'bg-amber-50 text-amber-700', ACTIVE: 'bg-green-50 text-green-700',
  REJECTED: 'bg-red-50 text-red-700', TERMINATED: 'bg-slate-100 text-slate-600',
  EXPIRED: 'bg-slate-100 text-slate-600',
}

function HatStat({ label, value }) {
  return (
    <div className="px-3 py-2 rounded-xl bg-slate-50 border border-slate-100 text-center">
      <p className="text-base font-bold text-slate-800">{value ?? 0}</p>
      <p className="text-[11px] text-slate-500">{label}</p>
    </div>
  )
}

function UserDetailView({ userId, onBack }) {
  const qc = useQueryClient()
  const [, setSearchParams] = useSearchParams()

  const { data: user, isLoading } = useQuery({
    queryKey: ['admin-user', userId],
    queryFn: () => adminService.userDetail(userId).then(r => r.data),
  })

  const blockMutation = useMutation({
    mutationFn: (blocked) => adminService.blockUser(userId, { blocked, reason: blocked ? 'Admin action' : 'Unblocked' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-user', userId] })
      qc.invalidateQueries({ queryKey: ['admin-users'] })
    },
    onError: (err) => toast.error('Couldn’t update the user', err.message ?? 'Please try again'),
  })

  const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'

  if (isLoading || !user) {
    return (
      <div className="space-y-4">
        <div className="h-9 w-24 bg-slate-100 rounded-xl animate-pulse" />
        <div className="h-28 bg-slate-100 rounded-2xl animate-pulse" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <div className="h-72 bg-slate-100 rounded-2xl animate-pulse" />
          <div className="h-72 bg-slate-100 rounded-2xl animate-pulse" />
        </div>
      </div>
    )
  }

  const counts = user._count ?? {}
  const isOwner = user.role === 'OWNER'

  return (
    <div className="space-y-5">
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-100 transition-colors"
      >
        <ArrowLeft size={16} />
        Back to users
      </button>

      {/* Identity card */}
      <div className="bg-white rounded-2xl border border-slate-100 p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <Avatar name={user.name} email={user.email} avatarUrl={user.avatarUrl} size={10} />
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-base font-bold text-slate-900 truncate">{user.name || user.email?.split('@')[0]}</p>
                {user.displayId && (
                  <button
                    onClick={() => navigator.clipboard.writeText(user.displayId)}
                    title="Click to copy"
                    className="shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 text-[11px] font-mono font-semibold text-slate-500 hover:bg-slate-200 transition-colors"
                  >
                    {user.displayId}
                    <Copy size={10} strokeWidth={2.5} />
                  </button>
                )}
              </div>
              <p className="text-xs text-slate-500 truncate mt-0.5">{user.email}</p>
              <p className="text-xs text-slate-500 mt-0.5">
                {user.phone ? `${user.phone} · ` : ''}
                {user.city ?? 'City unknown'} · Joined {fmtDate(user.createdAt)}
                {user.lastLoginAt ? ` · Last seen ${fmtDate(user.lastLoginAt)}` : ''}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap shrink-0">
            <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-600">{user.role}</span>
            {user.isBusiness && <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-indigo-50 text-indigo-600 uppercase">Biz</span>}
            {user.isVerified && <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-green-50 text-green-700">Verified</span>}
            {user.isBlocked && <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-red-50 text-red-700">Blocked</span>}
            <button
              onClick={() => blockMutation.mutate(!user.isBlocked)}
              disabled={blockMutation.isPending}
              className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors disabled:opacity-40 ${user.isBlocked ? 'bg-green-50 text-green-700 hover:bg-green-100' : 'bg-red-50 text-red-700 hover:bg-red-100'}`}
            >
              {user.isBlocked ? 'Unblock' : 'Block'}
            </button>
          </div>
        </div>
      </div>

      {/* Two hats, side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">

        {/* ── As a renter ── */}
        <div className="bg-white rounded-2xl border border-slate-100 p-5 space-y-5">
          <div>
            <h3 className="text-base font-bold text-slate-900">As a renter</h3>
            <p className="text-xs text-slate-500 mt-0.5">Visits requested, reviews written, reports filed</p>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <HatStat label="Visits"  value={counts.appointments} />
            <HatStat label="Reviews" value={counts.reviews} />
            <HatStat label="Reports" value={counts.reports} />
            <HatStat label="Leases"  value={counts.tenantLeases} />
            <HatStat label="Saved"   value={counts.savedListings} />
            <HatStat label="Chats"   value={counts.tenantConversations} />
          </div>

          <div>
            <SectionLabel>Visit requests</SectionLabel>
            {(user.appointments ?? []).length > 0 ? (
              <div className="space-y-2">
                {user.appointments.map(a => (
                  <div key={a.id} className="flex items-center gap-2 p-3 rounded-xl border border-slate-100">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-700 truncate">{a.property?.title ?? '—'}</p>
                      <p className="text-xs text-slate-500 mt-0.5">{fmtDate(a.requestedDate)}{a.requestedTime ? ` at ${formatTime(a.requestedTime)}` : ''}{a.property?.city ? ` · ${a.property.city}` : ''}</p>
                    </div>
                    <span className={`shrink-0 px-2 py-0.5 rounded-md text-[11px] font-semibold ${APPT_BADGE[a.status] ?? 'bg-slate-100 text-slate-600'}`}>{a.status}</span>
                  </div>
                ))}
              </div>
            ) : <p className="text-sm text-slate-500">No visit requests</p>}
          </div>

          <div>
            <SectionLabel>Reviews</SectionLabel>
            {(user.reviews ?? []).length > 0 ? (
              <div className="space-y-2">
                {user.reviews.map(r => (
                  <div key={r.id} className="p-3 rounded-xl border border-slate-100">
                    <div className="flex items-center gap-2">
                      <p className="flex-1 min-w-0 text-sm font-medium text-slate-700 truncate">{r.property?.title ?? '—'}</p>
                      <span className={`shrink-0 px-2 py-0.5 rounded-md text-[11px] font-semibold ${REVIEW_STATUS_PILL[r.status] ?? 'bg-slate-100 text-slate-500'}`}>{r.status}</span>
                    </div>
                    {r.body && <p className="text-xs text-slate-500 mt-1 line-clamp-2">{r.body}</p>}
                  </div>
                ))}
              </div>
            ) : <p className="text-sm text-slate-500">No reviews written</p>}
          </div>

          <div>
            <SectionLabel>Reports filed</SectionLabel>
            {(user.reports ?? []).length > 0 ? (
              <div className="space-y-2">
                {user.reports.map(r => (
                  <div key={r.id} className="flex items-center gap-2 p-3 rounded-xl border border-slate-100">
                    <span className={`shrink-0 px-2 py-0.5 rounded-md text-[11px] font-bold uppercase ${SEV_COLOR_PILL[r.severity] ?? 'bg-slate-100 text-slate-600'}`}>{r.severity}</span>
                    <p className="flex-1 min-w-0 text-sm text-slate-700 truncate">{r.category?.replace(/_/g, ' ')} · {r.property?.title ?? '—'}</p>
                    <span className="shrink-0 text-[11px] font-semibold text-slate-500">{r.status}</span>
                  </div>
                ))}
              </div>
            ) : <p className="text-sm text-slate-500">No reports filed</p>}
          </div>

          <div>
            <SectionLabel>Leases as tenant</SectionLabel>
            {(user.tenantLeases ?? []).length > 0 ? (
              <div className="space-y-2">
                {user.tenantLeases.map(l => (
                  <div key={l.id} className="flex items-center gap-2 p-3 rounded-xl border border-slate-100">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-700 truncate">{l.property?.title ?? '—'}</p>
                      <p className="text-xs text-slate-500 mt-0.5">{formatCurrency(Number(l.rentAmount))} · {fmtDate(l.startDate)} → {fmtDate(l.endDate)}</p>
                    </div>
                    <span className={`shrink-0 px-2 py-0.5 rounded-md text-[11px] font-semibold ${LEASE_BADGE[l.status] ?? 'bg-slate-100 text-slate-600'}`}>{l.status}</span>
                  </div>
                ))}
              </div>
            ) : <p className="text-sm text-slate-500">No leases</p>}
          </div>
        </div>

        {/* ── As an owner ── */}
        <div className="bg-white rounded-2xl border border-slate-100 p-5 space-y-5">
          <div>
            <h3 className="text-base font-bold text-slate-900">As an owner</h3>
            <p className="text-xs text-slate-500 mt-0.5">Listings held and tenancies granted</p>
          </div>

          {isOwner ? (
            <>
              <div className="grid grid-cols-3 gap-2">
                <HatStat label="Listings" value={counts.properties} />
                <HatStat label="Leases"   value={counts.ownerLeases} />
                <HatStat label="Chats"    value={counts.ownerConversations} />
              </div>

              <div>
                <SectionLabel>Listings ({counts.properties ?? 0})</SectionLabel>
                {(user.properties ?? []).length > 0 ? (
                  <div className="space-y-2">
                    {user.properties.map(p => (
                      <button
                        key={p.id}
                        onClick={() => setSearchParams({ tab: 'review-listings', propertyId: p.id })}
                        className="w-full flex items-center gap-2 p-3 rounded-xl border border-slate-100 hover:bg-slate-50 hover:border-slate-200 transition-colors text-left"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-slate-700 truncate">{p.title}</p>
                          <p className="text-xs text-slate-500 mt-0.5">
                            {p.type?.replace(/_/g, ' ')}{p.city ? ` · ${p.city}` : ''}
                            {p.pricingModel === 'LEASE' ? ' · Lease listing' : ''}
                          </p>
                        </div>
                        <PropertyStatusPill status={p.status} size="sm" />
                        <ChevronRight size={14} stroke="#94a3b8" strokeWidth={2} className="shrink-0" />
                      </button>
                    ))}
                  </div>
                ) : <p className="text-sm text-slate-500">No listings yet</p>}
              </div>

              <div>
                <SectionLabel>Leases granted</SectionLabel>
                {(user.ownerLeases ?? []).length > 0 ? (
                  <div className="space-y-2">
                    {user.ownerLeases.map(l => (
                      <div key={l.id} className="flex items-center gap-2 p-3 rounded-xl border border-slate-100">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-slate-700 truncate">{l.property?.title ?? '—'}</p>
                          <p className="text-xs text-slate-500 mt-0.5">
                            To {l.tenant?.name || l.tenant?.email?.split('@')[0] || '—'} · {formatCurrency(Number(l.rentAmount))} · {fmtDate(l.startDate)} → {fmtDate(l.endDate)}
                          </p>
                        </div>
                        <span className={`shrink-0 px-2 py-0.5 rounded-md text-[11px] font-semibold ${LEASE_BADGE[l.status] ?? 'bg-slate-100 text-slate-600'}`}>{l.status}</span>
                      </div>
                    ))}
                  </div>
                ) : <p className="text-sm text-slate-500">No leases granted</p>}
              </div>
            </>
          ) : (
            <p className="text-sm text-slate-500 py-6 text-center">
              Renter-only account — hasn&apos;t become a host.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

function UsersSection() {
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [selectedUserId, setSelectedUserId] = useState(null)

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['admin-users', search],
    queryFn: () => adminService.users({ search, limit: 50 }).then(r => r.data),
  })

  const blockMutation = useMutation({
    mutationFn: ({ id, blocked }) => adminService.blockUser(id, { blocked, reason: blocked ? 'Admin action' : 'Unblocked' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-users'] }),
  })

  if (isError) return <SectionError what="users" onRetry={refetch} />

  if (selectedUserId) {
    return <UserDetailView userId={selectedUserId} onBack={() => setSelectedUserId(null)} />
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Users</h1>
        <p className="text-sm text-slate-500 mt-0.5">Search and manage platform users. Click a row for their renter and owner activity.</p>
      </div>

      <input
        value={search}
        onChange={e => setSearch(e.target.value)}
        placeholder="Search by name or email..."
        className="w-full max-w-sm border border-slate-200 rounded-xl px-4 py-2 text-sm bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
      />

      {isLoading ? (
        <div className="h-48 bg-slate-100 rounded-2xl animate-pulse" />
      ) : (
        <div className="bg-white border border-slate-100 rounded-2xl overflow-x-auto">
          <table className="w-full text-sm min-w-[640px]">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                {['User ID', 'Name', 'Email', 'Role', 'City', 'Properties', 'Status', 'Action'].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {(data?.users ?? []).map(u => (
                <tr key={u.id} onClick={() => setSelectedUserId(u.id)} className="hover:bg-slate-50 transition-colors cursor-pointer">
                  <td className="px-4 py-3 text-[11px] font-mono text-slate-500">{u.displayId ?? '—'}</td>
                  <td className="px-4 py-3 font-medium text-slate-800">{u.name ?? '—'}</td>
                  <td className="px-4 py-3 text-slate-500 max-w-48 truncate">{u.email}</td>
                  <td className="px-4 py-3 text-slate-500">
                    {u.role}
                    {u.isBusiness && (
                      <span className="ml-1.5 px-1.5 py-0.5 rounded text-[11px] font-bold bg-indigo-50 text-indigo-600 uppercase">Biz</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-500">{u.city ?? '—'}</td>
                  <td className="px-4 py-3 text-slate-500">{u._count?.properties ?? 0}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${u.isBlocked ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
                      {u.isBlocked ? 'Blocked' : 'Active'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={(e) => { e.stopPropagation(); blockMutation.mutate({ id: u.id, blocked: !u.isBlocked }) }}
                      className={`text-xs px-3 py-1 rounded-lg font-medium transition-colors ${u.isBlocked ? 'bg-green-50 text-green-700 hover:bg-green-100' : 'bg-red-50 text-red-700 hover:bg-red-100'}`}
                    >
                      {u.isBlocked ? 'Unblock' : 'Block'}
                    </button>
                  </td>
                </tr>
              ))}
              {(data?.users ?? []).length === 0 && (
                <tr><td colSpan={8} className="px-4 py-12 text-center text-sm text-slate-500">No users found.</td></tr>
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
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['admin-waitlist'],
    queryFn: () => adminService.waitlist({ limit: 100 }).then(r => r.data),
  })

  if (isError) return <SectionError what="the waitlist" onRetry={refetch} />

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Waitlist</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Signups from cities we haven&apos;t launched in yet — {data?.total ?? 0} total.
        </p>
      </div>

      {/* Server-computed over EVERY entry — see WaitlistByCity for why that
          matters and why it is not derived here from the page on screen. */}
      {!isLoading && <WaitlistByCity rows={data?.byCity} />}

      {isLoading ? (
        <div className="h-48 bg-slate-100 rounded-2xl animate-pulse" />
      ) : (
        <div className="bg-white border border-slate-100 rounded-2xl overflow-x-auto">
          <table className="w-full text-sm min-w-[520px]">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                {['Name', 'Email', 'City', 'Signed up'].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">{h}</th>
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
                  <td className="px-4 py-3 text-slate-500">
                    {new Date(entry.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </td>
                </tr>
              ))}
              {(data?.entries ?? []).length === 0 && (
                <tr><td colSpan={4} className="px-4 py-12 text-center text-sm text-slate-500">No waitlist signups yet.</td></tr>
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

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['admin-reports', status],
    queryFn: () => adminService.reports({ status, limit: 30 }).then(r => r.data),
  })

  const mutation = useMutation({
    mutationFn: ({ id, action }) => adminService.moderateReport(id, { action }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-reports'] }),
  })

  if (isError) return <SectionError what="reports" onRetry={refetch} />

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Reports</h1>
        <p className="text-sm text-slate-500 mt-0.5">Moderate user-submitted reports.</p>
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
                    <span className="text-xs text-slate-500">{new Date(r.createdAt).toLocaleDateString('en-IN')}</span>
                  </div>
                  <p className="text-sm text-slate-700 mt-2 line-clamp-2">{r.description}</p>
                  {r.property && <p className="text-xs text-slate-500 mt-1">{r.property.title} · {r.property.city}</p>}
                </div>
                <div className="w-36 shrink-0">
                  <Select
                    value=""
                    onChange={action => mutation.mutate({ id: r.id, action })}
                    placeholder="Action"
                    options={REPORT_ACTIONS.map(a => ({ value: a, label: a.replace('_', ' ') }))}
                  />
                </div>
              </div>
            </div>
          ))}
          {(data?.reports ?? []).length === 0 && (
            <div className="text-center py-12 bg-white border border-slate-100 rounded-2xl text-sm text-slate-500">No reports found.</div>
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
              <span className="text-xs text-slate-500">{REVIEWER_TYPE_LABEL[r.reviewerType] ?? ''}</span>
              {r.recommend != null && (
                <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                  r.recommend ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'
                }`}>
                  {r.recommend ? 'Recommends' : 'Not recommended'}
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-0.5">{date}</p>
          </div>
          <div className="flex flex-col items-end gap-1.5 shrink-0">
            <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${REVIEW_STATUS_PILL[r.status] ?? 'bg-slate-100 text-slate-500'}`}>
              {r.status.charAt(0) + r.status.slice(1).toLowerCase()}
            </span>
            <div className="flex items-center gap-1">
              <span className="text-base font-bold text-slate-800">{score.toFixed(1)}</span>
              <Star className="w-4 h-4 text-amber-400" fill="currentColor" stroke="none" />
            </div>
          </div>
        </div>

        {/* Property pill */}
        {r.property && (
          <button
            type="button"
            onClick={() => setSearchParams({ tab: 'review-listings', propertyId: r.property.id })}
            className="min-h-[44px] w-full flex items-center gap-2 bg-slate-50 hover:bg-brand-50 border border-slate-100 hover:border-brand-200 rounded-xl px-3 py-3 transition-colors group text-left"
          >
            <Building2 className="w-3.5 h-3.5 text-slate-500 group-hover:text-brand-500 shrink-0" strokeWidth={2} />
            <span className="text-xs font-semibold text-slate-700 group-hover:text-brand-700 truncate flex-1">{r.property.title}</span>
            <span className="text-xs text-slate-500 shrink-0">{r.property.city}</span>
            <ChevronRight className="w-3 h-3 text-slate-500 group-hover:text-brand-400 shrink-0" strokeWidth={2} />
          </button>
        )}

        {/* Review body */}
        <div>
          <p className={`text-sm text-slate-700 leading-relaxed ${expanded ? '' : 'line-clamp-3'}`}>
            {r.content || <span className="text-slate-500 italic">No written comment</span>}
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
                  <span className="text-[11px] text-slate-500 w-20 shrink-0">{label}</span>
                  <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-amber-400 rounded-full" style={{ width: `${(val / 5) * 100}%` }} />
                  </div>
                  <span className="text-[11px] font-semibold text-slate-600 w-4 text-right shrink-0">{val}</span>
                </div>
              )
            })}
          </div>
        )}

        {/* Owner response */}
        {r.ownerResponse && (
          <div className="ml-2 border-l-2 border-brand-200 pl-3">
            <p className="text-[11px] font-bold text-brand-600 uppercase tracking-wide mb-1">Owner response</p>
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
                className="min-h-[44px] flex-1 py-3 rounded-xl bg-emerald-500 text-white text-sm font-semibold hover:bg-emerald-600 disabled:opacity-40 transition-colors"
              >
                Approve
              </button>
              <button
                onClick={() => onAction(r.id, 'FLAGGED')}
                disabled={busy}
                className="min-h-[44px] px-4 py-3 rounded-xl bg-orange-50 text-orange-600 text-sm font-semibold hover:bg-orange-100 disabled:opacity-40 transition-colors"
              >
                Flag
              </button>
              <button
                onClick={() => onAction(r.id, 'REJECTED')}
                disabled={busy}
                className="min-h-[44px] flex-1 py-3 rounded-xl bg-red-50 text-red-600 text-sm font-semibold hover:bg-red-100 disabled:opacity-40 transition-colors"
              >
                Reject
              </button>
            </>
          ) : r.status === 'APPROVED' ? (
            <button
              onClick={() => onAction(r.id, 'REJECTED')}
              disabled={busy}
              className="min-h-[44px] flex-1 py-3 rounded-xl border border-slate-200 text-slate-500 text-sm font-medium hover:bg-red-50 hover:text-red-600 hover:border-red-200 disabled:opacity-40 transition-colors"
            >
              Revoke approval
            </button>
          ) : (
            <button
              onClick={() => onAction(r.id, 'APPROVED')}
              disabled={busy}
              className="min-h-[44px] flex-1 py-3 rounded-xl border border-slate-200 text-slate-500 text-sm font-medium hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-200 disabled:opacity-40 transition-colors"
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

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['admin-reviews', status],
    queryFn: () => adminService.reviews({ status, limit: 50 }).then(r => r.data),
  })

  const mutation = useMutation({
    mutationFn: ({ id, nextStatus }) => adminService.setReviewStatus(id, nextStatus),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-reviews'] }),
  })

  if (isError) return <SectionError what="reviews" onRetry={refetch} />

  const reviews = data?.reviews ?? []
  const TABS = ['PENDING', 'APPROVED', 'REJECTED', 'FLAGGED']

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Reviews</h1>
        <p className="text-sm text-slate-500 mt-0.5">Moderate community reviews before they go live.</p>
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
          <p className="text-sm text-slate-500">No {status.toLowerCase()} reviews</p>
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

  const inputCls = 'w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500'
  const saveBtnCls = 'px-4 py-2 bg-[#111111] text-white text-sm font-semibold rounded-xl hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed'

  return (
    <div className="max-w-xl space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Settings</h1>
        <p className="text-sm text-slate-500 mt-0.5">Manage your profile and platform configuration</p>
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
          <AdminPasswordField
            label="Current password"
            value={pwForm.currentPassword}
            onChange={e => setPwForm(f => ({ ...f, currentPassword: e.target.value }))}
            autoComplete="current-password"
          />
          <AdminPasswordField
            label="New password"
            value={pwForm.newPassword}
            onChange={e => setPwForm(f => ({ ...f, newPassword: e.target.value }))}
            autoComplete="new-password"
          />
          <AdminPasswordField
            label="Confirm new password"
            value={pwForm.confirmPassword}
            onChange={e => setPwForm(f => ({ ...f, confirmPassword: e.target.value }))}
            autoComplete="new-password"
          />
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
            Amenities <span className="font-normal text-slate-500">({amenities.length})</span>
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
            <p className="text-[11px] text-slate-500 mb-2">Click a name to use it in the field below</p>
            <div className="flex flex-wrap gap-1.5">
              {KNOWN_ICONS.filter(n => !existingNames.has(n)).map(name => (
                <button
                  key={name}
                  type="button"
                  onClick={() => { setNewAmenity(name); setShowCatalogue(false) }}
                  className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-white border border-slate-200 hover:border-brand-400 hover:bg-brand-50 text-xs text-slate-700 transition-colors"
                >
                  <span className="text-slate-500"><AmenityIcon name={name} size={13} /></span>
                  {name}
                </button>
              ))}
            </div>
            {KNOWN_ICONS.filter(n => !existingNames.has(n)).length === 0 && (
              <p className="text-xs text-slate-500 text-center py-2">All known icons are already added.</p>
            )}
          </div>
        )}

        {/* Add form */}
        <form onSubmit={handleAdd} className="mb-4">
          <div className="flex gap-2">
            <div className="relative flex-1">
              {newAmenity.trim() && (
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none">
                  <AmenityIcon name={newAmenity.trim()} size={15} />
                </span>
              )}
              <input
                value={newAmenity}
                onChange={e => setNewAmenity(e.target.value)}
                placeholder="Amenity name… (or browse icons above)"
                className={`w-full py-2 rounded-xl border border-slate-200 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${newAmenity.trim() ? 'pl-8 pr-3' : 'px-3'}`}
              />
            </div>
            <button type="submit" disabled={adding || !newAmenity.trim()} className={saveBtnCls}>
              {adding ? 'Adding…' : 'Add'}
            </button>
          </div>
          {newAmenity.trim() && (
            <p className={`text-[11px] mt-1.5 ${hasMatchingIcon ? 'text-green-600' : 'text-slate-500'}`}>
              {hasMatchingIcon ? 'Icon matched' : 'No icon match — will use default icon. Try browsing above.'}
            </p>
          )}
        </form>

        {/* List */}
        {amenitiesLoading ? (
          <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-9 bg-slate-100 rounded-xl animate-pulse" />)}</div>
        ) : amenities.length === 0 ? (
          <p className="text-sm text-slate-500 text-center py-6">No amenities yet.</p>
        ) : (
          <ul className="space-y-1.5">
            {amenities.map(a => (
              <li key={a.id} className="flex items-center justify-between px-3 py-2 rounded-xl bg-slate-50 border border-slate-100">
                <div className="flex items-center gap-2.5">
                  <span className="text-slate-500 shrink-0"><AmenityIcon name={a.name} size={15} /></span>
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
      case 'supply':          return <SupplySection />
      case 'activity':        return <ActivityLogSection />
      case 'admin-properties':return <AdminPropertiesMap />
      case 'review-listings': return <ReviewListingsSection />
      case 'users':           return <UsersSection />
      case 'waitlist':        return <WaitlistSection />
      case 'reports':         return <ReportsSection />
      case 'reviews':         return <AdminReviewsSection />
      case 'verifications':   return <VerificationsSection />
      case 'monitor':         return <AdminMonitorSection />
      case 'settings':        return <AdminSettingsSection />
      default:                return <OverviewSection />
    }
  }

  return (
    <div className="flex h-screen bg-slate-50">
      <SEOMeta title="Admin" noindex />
      <UnifiedSidebar active={section} onChange={setSection} isAdmin onLogout={handleLogout} userName="Admin" userEmail="Administrator" />

      <main className="flex-1 overflow-y-auto px-8 py-8">
        {renderSection()}
      </main>
    </div>
  )
}
