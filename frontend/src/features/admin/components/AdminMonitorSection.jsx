import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import { RefreshCw } from 'lucide-react'
import { adminService } from '@services/admin.service'
import DataQualityPanel from './DataQualityPanel'

// ── helpers ────────────────────────────────────────────────────────────────

function timeAgo(isoString) {
  const diff = Math.floor((Date.now() - new Date(isoString).getTime()) / 1000)
  if (diff < 60)    return `${diff}s ago`
  if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

function useSecondTick() {
  const [tick, setTick] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 1000)
    return () => clearInterval(id)
  }, [])
  return tick
}

function byKey(arr, key) {
  return Object.fromEntries((arr ?? []).map(r => [r[key], r.count]))
}

function humanizeAction(action = '') {
  const map = {
    USER_BLOCKED:         'Blocked a user account',
    USER_UNBLOCKED:       'Unblocked a user account',
    PROPERTY_APPROVED:    'Approved a property listing',
    PROPERTY_REJECTED:    'Rejected a property listing',
    PROPERTY_SUSPENDED:   'Suspended a property listing',
    REVIEW_APPROVED:      'Approved a tenant review',
    REVIEW_REJECTED:      'Rejected a tenant review',
    REVIEW_FLAGGED:       'Flagged a review for further review',
    REPORT_RESOLVED:      'Resolved a reported listing',
    REPORT_DISMISSED:     'Dismissed a moderation report',
    VERIFICATION_APPROVED:'Verified property ownership documents',
    VERIFICATION_REJECTED:'Rejected ownership verification',
    AMENITY_CREATED:      'Added a new amenity',
    AMENITY_DELETED:      'Removed an amenity',
    ADMIN_LOGIN:          'Admin logged in',
    PASSWORD_CHANGED:     'Admin password was changed',
  }
  return map[action] ?? action.replace(/_/g, ' ').toLowerCase().replace(/^\w/, c => c.toUpperCase())
}

// ── small presentational pieces ────────────────────────────────────────────

function SectionHeading({ title, description }) {
  return (
    <div className="mb-3">
      <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">{title}</p>
      {description && <p className="text-xs text-slate-400 mt-0.5">{description}</p>}
    </div>
  )
}

function Card({ children, className = '' }) {
  return (
    <div className={`bg-white rounded-xl border border-slate-200 shadow-sm p-4 ${className}`}>
      {children}
    </div>
  )
}

// ── Section 1: System Health ───────────────────────────────────────────────

const HEALTH_CONFIG = [
  {
    key: 'db',
    label: 'Database',
    purpose: 'All property and user data lives here. If this goes down, the entire platform stops.',
    getOk:  d => d.dbStatus === 'ok',
    getLabel: d => d.dbStatus === 'ok' ? 'Connected' : 'Connection failed',
  },
  {
    key: 'ai',
    label: 'Fraud Detection AI',
    purpose: 'Scans listings for duplicate images, fake prices, and suspicious patterns. Stub mode means no AI scanning.',
    getOk:  d => d.system?.aiProvider === 'anthropic',
    getLabel: d => d.system?.aiProvider === 'anthropic' ? 'Active (Anthropic)' : 'Stub mode — not scanning',
  },
  {
    key: 'email',
    label: 'Email Notifications',
    purpose: 'Sends appointment confirmations, lease offers, and password change alerts to users.',
    getOk:  d => d.system?.emailEnabled,
    getLabel: d => d.system?.emailEnabled ? 'Active (Resend)' : 'Not configured — no emails sent',
  },
  {
    key: 'push',
    label: 'Push Notifications',
    purpose: 'Delivers real-time alerts to users\' devices even when they\'re not on the site.',
    getOk:  d => d.system?.pushEnabled,
    getLabel: d => d.system?.pushEnabled ? 'Active (VAPID)' : 'Not configured — no push alerts',
  },
]

function SystemHealthSection({ data }) {
  return (
    <div>
      <SectionHeading
        title="System Health"
        description="Core services the platform depends on. Red means something needs fixing."
      />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {HEALTH_CONFIG.map(cfg => {
          const ok    = cfg.getOk(data)
          const label = cfg.getLabel(data)
          return (
            <Card key={cfg.key} className={ok ? '' : 'bg-red-50 border-red-200'}>
              <div className="flex items-start justify-between gap-2 mb-2">
                <p className="text-sm font-semibold text-slate-800">{cfg.label}</p>
                <span className={`mt-0.5 w-2.5 h-2.5 rounded-full shrink-0 ${ok ? 'bg-green-500' : 'bg-red-500'}`} />
              </div>
              <p className={`text-xs font-medium mb-2 ${ok ? 'text-green-700' : 'text-red-600'}`}>{label}</p>
              <p className="text-xs text-slate-400 leading-relaxed">{cfg.purpose}</p>
            </Card>
          )
        })}
      </div>
    </div>
  )
}

// ── Section 2: Action Queue ────────────────────────────────────────────────

function ActionQueueSection({ pending }) {
  const [, setSearchParams] = useSearchParams()

  const items = [
    {
      label:       'Properties to review',
      count:       pending?.properties ?? 0,
      description: 'Owners have submitted listings waiting for your approval before they go live on the map.',
      tab:         'properties',
      cta:         'Review listings',
      urgentAt:    5,
    },
    {
      label:       'Reports to moderate',
      count:       pending?.reports ?? 0,
      description: 'Users have flagged listings as fraudulent, wrong price, or harassment. Unresolved reports hurt trust.',
      tab:         'reports',
      cta:         'View reports',
      urgentAt:    3,
    },
    {
      label:       'Reviews awaiting approval',
      count:       pending?.reviews ?? 0,
      description: 'Tenant reviews are held until an admin approves them to prevent spam and fake feedback.',
      tab:         'reviews',
      cta:         'Approve reviews',
      urgentAt:    10,
    },
    {
      label:       'Ownership verifications',
      count:       pending?.verifications ?? 0,
      description: 'Owners have uploaded documents to prove they own a property. Verified owners get a badge.',
      tab:         'verifications',
      cta:         'Verify owners',
      urgentAt:    2,
    },
  ]

  return (
    <div>
      <SectionHeading
        title="Action Queue"
        description="Things that need your attention. Amber means it's building up — act before it gets worse."
      />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {items.map(item => {
          const urgent = item.count >= item.urgentAt
          const none   = item.count === 0
          return (
            <Card
              key={item.label}
              className={urgent ? 'bg-amber-50 border-amber-200' : none ? 'opacity-60' : ''}
            >
              <p className="text-xs font-semibold text-slate-500 mb-1">{item.label}</p>
              <p className={`text-3xl font-bold mb-2 ${urgent ? 'text-amber-700' : none ? 'text-slate-300' : 'text-slate-800'}`}>
                {item.count}
              </p>
              <p className="text-xs text-slate-400 leading-relaxed mb-3">{item.description}</p>
              {item.count > 0 && (
                <button
                  onClick={() => setSearchParams({ tab: item.tab })}
                  className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors ${
                    urgent
                      ? 'bg-amber-100 text-amber-800 hover:bg-amber-200'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  {item.cta} →
                </button>
              )}
              {item.count === 0 && (
                <p className="text-xs text-green-600 font-medium">All clear</p>
              )}
            </Card>
          )
        })}
      </div>
    </div>
  )
}

// ── Section 3: Listing Pipeline ────────────────────────────────────────────

const STATUS_META = {
  ACTIVE:    { bg: 'bg-green-100',   text: 'text-green-700',   meaning: 'Live on the map, visible to tenants'         },
  PENDING:   { bg: 'bg-amber-100',   text: 'text-amber-700',   meaning: 'Submitted by owner, waiting for admin review' },
  DRAFT:     { bg: 'bg-slate-100',   text: 'text-slate-600',   meaning: 'Owner is still editing, not submitted yet'    },
  INACTIVE:  { bg: 'bg-gray-100',    text: 'text-gray-600',    meaning: 'Owner turned it off, hidden from search'      },
  OCCUPIED:  { bg: 'bg-indigo-100',  text: 'text-indigo-700',  meaning: 'Property has a confirmed tenant'              },
  SUSPENDED: { bg: 'bg-red-100',     text: 'text-red-700',     meaning: 'Removed by admin due to reports or fraud'     },
  REJECTED:  { bg: 'bg-red-100',     text: 'text-red-700',     meaning: 'Admin rejected the listing after review'      },
}
const ALL_STATUSES = ['ACTIVE', 'PENDING', 'DRAFT', 'INACTIVE', 'OCCUPIED', 'SUSPENDED', 'REJECTED']

function ListingPipelineSection({ propertyByStatus }) {
  const counts = byKey(propertyByStatus, 'status')
  const [expanded, setExpanded] = useState(null)

  return (
    <div>
      <SectionHeading
        title="Listing Pipeline"
        description="Where every property is in its lifecycle. Click any status to see what it means."
      />
      <Card>
        <div className="flex flex-wrap gap-2">
          {ALL_STATUSES.map(s => {
            const count = counts[s] ?? 0
            const meta  = STATUS_META[s] ?? { bg: 'bg-slate-100', text: 'text-slate-600', meaning: '' }
            const isOpen = expanded === s
            return (
              <button
                key={s}
                onClick={() => setExpanded(isOpen ? null : s)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${meta.bg} ${isOpen ? 'ring-2 ring-offset-1 ring-slate-300' : ''}`}
              >
                <span className={`text-xs font-semibold ${meta.text}`}>{s}</span>
                <span className={`text-xs font-bold ${meta.text}`}>{count}</span>
              </button>
            )
          })}
        </div>
        {expanded && (
          <div className="mt-3 pt-3 border-t border-slate-100">
            <p className="text-xs text-slate-500 leading-relaxed">
              <span className="font-semibold text-slate-700">{expanded}:</span> {STATUS_META[expanded]?.meaning}
            </p>
          </div>
        )}
      </Card>
    </div>
  )
}

// ── Section 4: Users + Appointments ────────────────────────────────────────

function UsersCard({ userByRole, blockedUsers }) {
  const roles  = byKey(userByRole, 'role')
  const tenant = roles.TENANT ?? 0
  const owner  = roles.OWNER  ?? 0
  const total  = tenant + owner
  const ownerPct = total > 0 ? Math.round((owner / total) * 100) : 0

  return (
    <Card>
      <SectionHeading
        title="Users"
        description="Tenants browse and book. Owners list properties. Healthy ratio: 80–90% tenants."
      />
      <div className="space-y-3">
        <div className="flex justify-between items-center">
          <div>
            <p className="text-sm font-medium text-slate-700">Tenants</p>
            <p className="text-xs text-slate-400">Browse, save, book appointments</p>
          </div>
          <span className="text-2xl font-bold text-slate-800">{tenant}</span>
        </div>
        <div className="flex justify-between items-center">
          <div>
            <p className="text-sm font-medium text-slate-700">Owners</p>
            <p className="text-xs text-slate-400">List properties · {ownerPct}% of all users</p>
          </div>
          <span className="text-2xl font-bold text-slate-800">{owner}</span>
        </div>
        <div className="flex justify-between items-center pt-2 border-t border-slate-100">
          <div>
            <p className="text-sm font-medium text-slate-500">Blocked accounts</p>
            <p className="text-xs text-slate-400">Cannot log in or list properties</p>
          </div>
          <span className={`text-2xl font-bold ${(blockedUsers ?? 0) > 0 ? 'text-red-600' : 'text-slate-300'}`}>
            {blockedUsers ?? 0}
          </span>
        </div>
      </div>
    </Card>
  )
}

function AppointmentsCard({ appointmentByStatus }) {
  const counts = byKey(appointmentByStatus, 'status')
  const total  = Object.values(counts).reduce((a, b) => a + b, 0)
  const accepted = counts.ACCEPTED ?? 0
  const conversionPct = total > 0 ? Math.round((accepted / total) * 100) : 0

  const rows = [
    { s: 'PENDING',     label: 'Waiting for owner response', color: 'text-amber-700'  },
    { s: 'ACCEPTED',    label: 'Owner confirmed the visit',  color: 'text-green-700'  },
    { s: 'RESCHEDULED', label: 'Owner proposed a new time',  color: 'text-blue-600'   },
    { s: 'REJECTED',    label: 'Owner declined',             color: 'text-red-500'    },
    { s: 'CANCELLED',   label: 'Tenant cancelled',           color: 'text-slate-400'  },
  ]

  return (
    <Card>
      <SectionHeading
        title="Appointments"
        description={`Visit requests between tenants and owners. Acceptance rate: ${conversionPct}% (higher is better).`}
      />
      <div className="space-y-2.5">
        {rows.map(({ s, label, color }) => (
          <div key={s} className="flex items-center justify-between gap-2">
            <div>
              <p className="text-xs font-medium text-slate-700">{s.charAt(0) + s.slice(1).toLowerCase()}</p>
              <p className="text-[11px] text-slate-400">{label}</p>
            </div>
            <span className={`text-xl font-bold shrink-0 ${color}`}>{counts[s] ?? 0}</span>
          </div>
        ))}
      </div>
    </Card>
  )
}

// ── Section 5: Recent Activity ─────────────────────────────────────────────

function RecentActivitySection({ activity }) {
  useSecondTick()

  if (!activity?.length) {
    return (
      <div>
        <SectionHeading
          title="Admin Activity Log"
          description="Every action taken inside the admin panel is recorded here for accountability."
        />
        <Card>
          <p className="text-sm text-slate-400 py-4 text-center">No activity logged yet.</p>
        </Card>
      </div>
    )
  }

  return (
    <div>
      <SectionHeading
        title="Admin Activity Log"
        description="A timestamped record of every action taken in this panel. Useful for auditing changes."
      />
      <Card>
        <ol className="divide-y divide-slate-50">
          {activity.map(log => (
            <li key={log.id} className="flex items-start gap-3 py-2.5 first:pt-0 last:pb-0">
              <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-brand-400 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm text-slate-700">
                  <span className="font-medium">{log.admin?.name ?? 'System'}</span>
                  <span className="text-slate-400"> · </span>
                  <span className="text-slate-600">{humanizeAction(log.action)}</span>
                </p>
                {log.entity && (
                  <p className="text-xs text-slate-400 mt-0.5">{log.entity}</p>
                )}
              </div>
              <span className="text-xs text-slate-400 shrink-0 whitespace-nowrap">
                {timeAgo(log.createdAt)}
              </span>
            </li>
          ))}
        </ol>
      </Card>
    </div>
  )
}

// ── Loading skeleton ───────────────────────────────────────────────────────

function MonitorSkeleton() {
  return (
    <div className="space-y-8">
      {[4, 4, 1, 2, 1].map((cols, i) => (
        <div key={i} className={`grid grid-cols-${cols === 1 ? '1' : '2'} sm:grid-cols-${Math.min(cols, 4)} gap-3`}>
          {Array.from({ length: cols }).map((_, j) => (
            <div key={j} className="h-24 bg-slate-100 rounded-xl animate-pulse" />
          ))}
        </div>
      ))}
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────

export default function AdminMonitorSection() {
  const tick = useSecondTick()

  const { data, isLoading, isError, refetch, dataUpdatedAt } = useQuery({
    queryKey: ['admin-monitor'],
    queryFn: () => adminService.getMonitorStatus().then(r => r.data),
    refetchInterval: 30000,
  })

  const secondsSince = dataUpdatedAt
    ? Math.floor((Date.now() - dataUpdatedAt) / 1000)
    : null

  void tick

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Platform Operations</h1>
          <p className="text-sm text-slate-400 mt-0.5">
            {secondsSince !== null
              ? `Live snapshot · refreshes every 30s · last updated ${secondsSince}s ago`
              : 'Loading…'}
          </p>
        </div>
        <button
          onClick={() => refetch()}
          disabled={isLoading}
          className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm transition-colors"
        >
          <RefreshCw size={14} strokeWidth={2} className={isLoading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {isLoading && <MonitorSkeleton />}

      {isError && !isLoading && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">
          Failed to load platform data. Check that the backend is running and the database is connected.
        </div>
      )}

      {data && (
        <>
          <SystemHealthSection data={data} />
          <ActionQueueSection pending={data.pendingModeration} />
          <ListingPipelineSection propertyByStatus={data.propertyByStatus} />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <UsersCard userByRole={data.userByRole} blockedUsers={data.blockedUsers} />
            <AppointmentsCard appointmentByStatus={data.appointmentByStatus} />
          </div>
          <DataQualityPanel />
          <RecentActivitySection activity={data.recentActivity} />
        </>
      )}
    </div>
  )
}
