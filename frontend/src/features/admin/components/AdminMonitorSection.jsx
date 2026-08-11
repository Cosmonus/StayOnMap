import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import { RefreshCw } from 'lucide-react'
import { adminService } from '@services/admin.service'
import DataQualityPanel from './DataQualityPanel'
import PoiQualityCard from './PoiQualityCard'

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
      {description && <p className="text-xs text-slate-500 mt-0.5">{description}</p>}
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
    purpose: 'Sends OTP codes, appointment confirmations, lease offers, and password change alerts. Quota is the shared daily send cap.',
    // The real mailer state, not an SMTP_HOST guess — this card said
    // "Not configured" on a prod box happily sending via ZeptoMail.
    getOk:  d => d.system?.mail ? d.system.mail.configured : d.system?.emailEnabled,
    getLabel: d => {
      const m = d.system?.mail
      if (!m) return d.system?.emailEnabled ? 'Active' : 'Not configured — no emails sent'
      if (!m.configured) return 'Not configured — no emails sent'
      if (m.provider === 'dev-echo') return 'Dev echo — prints to the server console'
      const name = { zeptomail: 'ZeptoMail', resend: 'Resend', brevo: 'Brevo', smtp: 'SMTP' }[m.provider] ?? m.provider
      return `Active (${name}) · ${m.usedToday}/${m.dailyCap} sent today`
    },
  },
  {
    key: 'web-push',
    label: 'Web Push',
    purpose: 'Browser alerts via VAPID + service worker, delivered even when the site is closed.',
    getOk:  d => d.system?.webPush ? d.system.webPush.enabled : d.system?.pushEnabled,
    getLabel: d => {
      const w = d.system?.webPush
      if (!w) return d.system?.pushEnabled ? 'Active (VAPID)' : 'Not configured — no push alerts'
      if (!w.enabled) return 'Not configured — no push alerts'
      return `Active (VAPID) · ${w.subscriptions} ${w.subscriptions === 1 ? 'browser' : 'browsers'} subscribed`
    },
  },
  {
    // The backend has fetched and returned this since phone verification
    // shipped; the card was simply never added. It is the one channel whose
    // configured state GATES PRODUCT SURFACES — the Settings verify row, the
    // points checklist entry, and the SMS sign-in button all hide themselves
    // when it is off (smsConfigured, see .claude/auth.md). So "unconfigured"
    // here is not a warning, it is the explanation for three things being
    // absent, which is exactly what an operator comes to this page to find.
    key: 'sms',
    label: 'SMS',
    purpose: 'Phone verification and SMS sign-in codes. Costs money per message and needs TRAI DLT registration — deferred until funded, so unconfigured is the expected state.',
    getOk:  d => d.system?.sms?.configured ?? false,
    getLabel: d => {
      const s = d.system?.sms
      if (!s) return 'Unknown'
      if (!s.configured) return 'Not configured — phone verification and SMS sign-in are hidden'
      if (s.provider === 'dev-echo') return 'Dev echo — prints to the server console'
      const name = { msg91: 'MSG91', fast2sms: 'Fast2SMS' }[s.provider] ?? s.provider
      return `Active (${name}) · ${s.usedToday}/${s.dailyCap} sent today`
    },
  },
  {
    key: 'mobile-push',
    label: 'Mobile Push',
    purpose: 'App notifications via the Expo push service. Needs no server key — reach is however many devices registered a token.',
    getOk:  () => true,
    getLabel: d => {
      const devices = d.system?.mobilePush?.devices ?? 0
      return `Expo · ${devices} ${devices === 1 ? 'device' : 'devices'} registered`
    },
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
              <p className="text-xs text-slate-500 leading-relaxed">{cfg.purpose}</p>
            </Card>
          )
        })}
      </div>
    </div>
  )
}

// ── Section 1a: Server errors ──────────────────────────────────────────────
// Until now nothing in this panel could tell a broken deploy from a quiet
// afternoon: SENTRY_DSN is unset and the only record of a 5xx was journalctl on
// the VM. This is the smallest thing that removes that blindness — an in-memory
// ring in the API process, so it costs no vendor, no dependency and no table.
//
// Its limits are printed, not implied. A number that silently resets on deploy
// is worse than no number, because it reads as "nothing is wrong".

function ServerErrorsSection({ errors }) {
  if (!errors) return null
  const quiet = errors.lastHour === 0

  return (
    <div>
      <SectionHeading
        title="Server errors"
        description="Requests that failed with a 5xx. Anything above zero is ours, not the caller's."
      />
      <Card className={quiet ? '' : 'bg-red-50 border-red-200'}>
        <div className="flex items-baseline gap-6">
          <div>
            <p className={`text-2xl font-bold font-mono ${quiet ? 'text-slate-900' : 'text-red-700'}`}>
              {errors.lastHour}
            </p>
            <p className="text-xs text-slate-500 mt-0.5">last hour</p>
          </div>
          <div>
            <p className="text-2xl font-bold font-mono text-slate-900">{errors.sinceRestart}</p>
            <p className="text-xs text-slate-500 mt-0.5">since the API restarted</p>
          </div>
        </div>

        {errors.recent?.length > 0 && (
          <ul className="mt-4 pt-4 border-t border-slate-100 flex flex-col gap-2">
            {errors.recent.slice(0, 8).map((e, i) => (
              <li key={i} className="flex items-baseline justify-between gap-3">
                <span className="text-xs font-mono text-slate-800 truncate">{e.path || '—'}</span>
                <span className="text-xs text-slate-500 shrink-0 truncate max-w-[45%]">{e.message}</span>
              </li>
            ))}
          </ul>
        )}

        <p className="text-xs text-slate-500 mt-4">
          Held in memory in the API process: this resets when the API restarts, including on
          every deploy, and keeps the newest {errors.kept}. It answers &ldquo;is something
          broken right now&rdquo;, never &ldquo;what broke last Tuesday&rdquo;.
        </p>
      </Card>
    </div>
  )
}

// ── Section 1b: Email quota ────────────────────────────────────────────────
// Every email — OTP codes, resets, appointment mail — spends one of the same
// MAIL_DAILY_CAP daily sends, and the last few are held back for critical
// email. This card is the "how much is left today" answer at a glance; the
// Email health card above only says whether the channel works at all.

const PROVIDER_NAME = { zeptomail: 'ZeptoMail', resend: 'Resend', brevo: 'Brevo', smtp: 'SMTP', 'dev-echo': 'Dev echo' }

function EmailQuotaSection({ mail }) {
  if (!mail) return null

  const used     = mail.usedToday ?? 0
  const cap      = mail.dailyCap ?? 0
  const reserve  = mail.criticalReserve ?? 0
  const routine  = Math.max(0, cap - reserve - used)   // left for non-critical email
  const pct      = cap > 0 ? Math.min(100, Math.round((used / cap) * 100)) : 0
  // Amber once routine headroom is under a quarter of the cap; red once
  // routine email is already being dropped (only the reserve remains).
  const barColor = routine === 0 ? 'bg-red-500' : used >= cap * 0.75 ? 'bg-amber-400' : 'bg-brand-500'

  return (
    <div>
      <SectionHeading
        title="Email quota today"
        description="One shared daily cap across all email — sign-in codes, resets, appointment and lease mail. Resets at midnight UTC."
      />
      <Card>
        <div className="flex items-baseline justify-between gap-3 flex-wrap mb-2">
          <p className="text-sm font-semibold text-slate-800">
            {PROVIDER_NAME[mail.provider] ?? mail.provider}
            {mail.provider === 'dev-echo' && <span className="ml-2 text-xs font-normal text-slate-500">prints to the server console — nothing is counted</span>}
          </p>
          <p className="text-sm font-bold text-slate-900 font-mono">
            {used.toLocaleString('en-IN')} / {cap.toLocaleString('en-IN')} sent
          </p>
        </div>
        <div className="h-2 bg-slate-100 rounded-full overflow-hidden mb-2">
          <div className={`h-full ${barColor} rounded-full transition-all`} style={{ width: `${pct}%` }} />
        </div>
        <p className="text-xs text-slate-500">
          {routine > 0
            ? `${routine.toLocaleString('en-IN')} left for routine email · last ${reserve} held for critical sends (sign-in codes, password resets)`
            : `Routine email is being dropped — only the ${reserve}-send critical reserve (sign-in codes, password resets) remains until midnight UTC`}
        </p>
      </Card>
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
      tab:         'review-listings',
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
              <p className={`text-3xl font-bold mb-2 ${urgent ? 'text-amber-700' : none ? 'text-slate-500' : 'text-slate-800'}`}>
                {item.count}
              </p>
              <p className="text-xs text-slate-500 leading-relaxed mb-3">{item.description}</p>
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
            <p className="text-xs text-slate-500">Browse, save, book appointments</p>
          </div>
          <span className="text-2xl font-bold text-slate-800">{tenant}</span>
        </div>
        <div className="flex justify-between items-center">
          <div>
            <p className="text-sm font-medium text-slate-700">Owners</p>
            <p className="text-xs text-slate-500">List properties · {ownerPct}% of all users</p>
          </div>
          <span className="text-2xl font-bold text-slate-800">{owner}</span>
        </div>
        <div className="flex justify-between items-center pt-2 border-t border-slate-100">
          <div>
            <p className="text-sm font-medium text-slate-500">Blocked accounts</p>
            <p className="text-xs text-slate-500">Cannot log in or list properties</p>
          </div>
          <span className={`text-2xl font-bold ${(blockedUsers ?? 0) > 0 ? 'text-red-600' : 'text-slate-500'}`}>
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
    { s: 'RESCHEDULE_REQUESTED', label: 'Renter proposed a new time', color: 'text-amber-600' },
    { s: 'REJECTED',    label: 'Owner declined',             color: 'text-red-500'    },
    { s: 'CANCELLED',   label: 'Tenant cancelled',           color: 'text-slate-500'  },
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
              <p className="text-[11px] text-slate-500">{label}</p>
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
          <p className="text-sm text-slate-500 py-4 text-center">No activity logged yet.</p>
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
                  <span className="text-slate-500"> · </span>
                  <span className="text-slate-600">{humanizeAction(log.action)}</span>
                </p>
                {log.entity && (
                  <p className="text-xs text-slate-500 mt-0.5">{log.entity}</p>
                )}
              </div>
              <span className="text-xs text-slate-500 shrink-0 whitespace-nowrap">
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
          <p className="text-sm text-slate-500 mt-0.5">
            {secondsSince !== null
              ? `Live snapshot · refreshes every 30s · last updated ${secondsSince}s ago`
              : 'Loading…'}
          </p>
        </div>
        <button
          onClick={() => refetch()}
          disabled={isLoading}
          className="min-h-[44px] flex items-center gap-2 px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm transition-colors"
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
          <ServerErrorsSection errors={data.errors} />
          <EmailQuotaSection mail={data.system?.mail} />
          <ActionQueueSection pending={data.pendingModeration} />
          <ListingPipelineSection propertyByStatus={data.propertyByStatus} />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <UsersCard userByRole={data.userByRole} blockedUsers={data.blockedUsers} />
            <AppointmentsCard appointmentByStatus={data.appointmentByStatus} />
          </div>
          <DataQualityPanel />
          {/* Below DataQualityPanel deliberately: that answers "did the fetch
              run", this answers "and is what it fetched any good". Reading them
              the other way round invites explaining a quality number with a
              coverage problem nobody has looked at yet. */}
          <PoiQualityCard />
          <RecentActivitySection activity={data.recentActivity} />
        </>
      )}
    </div>
  )
}
