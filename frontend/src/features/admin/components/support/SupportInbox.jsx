import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { Search } from 'lucide-react'
import { adminService } from '@services/admin.service'
import Select from '@components/common/Select'
import SupportCaseDetail from './SupportCaseDetail'
import {
  STATUS_LABEL, STATUS_PILL, PRIORITY_LABEL, PRIORITY_PILL, TYPE_LABEL, caseRef,
} from './supportVocab'

/**
 * The support inbox — one queue for every kind of human intervention.
 *
 * Before this, the four things needing a human lived in four places: property
 * reports in their own tab, the contact form in an inbox nobody could see from
 * here, user reports in a table with no reader at all, and general questions
 * nowhere. This is the single list.
 *
 * The counters are their own query, not derived from the page. Deriving them
 * would report "3 open" when three of the twenty-five rows on screen happen to
 * be open — a number that looks like a queue depth and is a page statistic.
 */

const STATUS_OPTIONS = Object.entries(STATUS_LABEL).map(([value, label]) => ({ value, label }))
const TYPE_OPTIONS = Object.entries(TYPE_LABEL).map(([value, label]) => ({ value, label }))
const PRIORITY_OPTIONS = Object.entries(PRIORITY_LABEL).map(([value, label]) => ({ value, label }))

/**
 * The six numbers that decide what to work on.
 *
 * Each is a FILTER, not a statistic — clicking "Unassigned" shows the
 * unassigned. A dashboard tile that only informs is a tile you read once and
 * then go looking for the same thing by hand.
 */
function Counters({ counts, active, onPick }) {
  const tiles = [
    { key: 'open', label: 'Open', value: counts?.open, filter: { status: 'OPEN' } },
    { key: 'urgent', label: 'Urgent', value: counts?.urgent, filter: { priority: 'URGENT' }, alert: true },
    { key: 'unassigned', label: 'Unassigned', value: counts?.unassigned, filter: { unassigned: 'true' } },
    { key: 'waiting', label: 'Waiting', value: counts?.waiting, filter: { status: 'WAITING_FOR_USER' } },
    { key: 'escalated', label: 'Escalated', value: counts?.escalated, filter: { status: 'ESCALATED' }, alert: true },
    { key: 'resolved', label: 'Resolved', value: counts?.resolved, filter: { status: 'RESOLVED' } },
  ]

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
      {tiles.map((t) => (
        <button
          key={t.key}
          type="button"
          onClick={() => onPick(active === t.key ? null : t.key, t.filter)}
          aria-pressed={active === t.key}
          className={`min-h-[44px] text-left rounded-2xl border px-4 py-3 transition-colors ${
            active === t.key
              ? 'border-brand-500 bg-brand-50 ring-1 ring-brand-200'
              : 'border-slate-100 bg-white hover:border-slate-300 hover:bg-slate-50'
          }`}
        >
          <p className={`text-2xl font-bold font-mono ${t.alert && t.value > 0 ? 'text-orange-700' : 'text-slate-900'}`}>
            {/* An em-dash while loading, not 0 — "no urgent cases" and "we have
                not counted yet" are different claims and only one is reassuring. */}
            {counts ? (t.value ?? 0) : '—'}
          </p>
          <p className="text-xs font-semibold text-slate-600 mt-0.5">{t.label}</p>
        </button>
      ))}
    </div>
  )
}

function Pill({ className, children }) {
  if (!className) return null
  return <span className={`shrink-0 px-2 py-0.5 rounded-md text-[11px] font-semibold ${className}`}>{children}</span>
}

function CaseRow({ c, onOpen }) {
  const waiting = c._count?.messages ?? 0
  return (
    <button
      type="button"
      onClick={() => onOpen(c.id)}
      className="w-full text-left bg-white border border-slate-100 rounded-2xl p-4 hover:border-slate-300 hover:bg-slate-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono text-[11px] font-semibold text-slate-500">{caseRef(c.number)}</span>
            <Pill className={STATUS_PILL[c.status]}>{STATUS_LABEL[c.status]}</Pill>
            <Pill className={PRIORITY_PILL[c.priority]}>{PRIORITY_LABEL[c.priority]}</Pill>
            <span className="text-xs text-slate-500">{TYPE_LABEL[c.type] ?? c.type}</span>
            {/* The only badge that means "act now": somebody wrote to us and
                nobody has read it. Staff have no notification stream, so this
                count is the entire signal. */}
            {waiting > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 text-[11px] font-semibold">
                {waiting} unread
              </span>
            )}
          </div>
          <p className="text-sm font-medium text-slate-800 mt-1.5 truncate">{c.subject}</p>
          <p className="text-xs text-slate-500 mt-0.5 truncate">
            {c.createdBy?.name || c.createdBy?.email?.split('@')[0] || 'Anonymous'}
            {c.relatedProperty ? ` · ${c.relatedProperty.title}` : ''}
            {c.relatedProperty?.city ? ` · ${c.relatedProperty.city}` : ''}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-xs text-slate-500">{new Date(c.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</p>
          <p className="text-[11px] text-slate-500 mt-0.5">
            {c.assignedTo?.name ?? 'Unassigned'}
          </p>
        </div>
      </div>
    </button>
  )
}

export default function SupportInbox() {
  const [searchParams, setSearchParams] = useSearchParams()
  const openId = searchParams.get('case')

  const [filters, setFilters] = useState({})
  const [activeTile, setActiveTile] = useState(null)
  const [searchDraft, setSearchDraft] = useState('')

  const { data: counts } = useQuery({
    queryKey: ['admin-support-counts'],
    queryFn: () => adminService.supportCounts().then((r) => r.data),
  })

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['admin-support-cases', filters],
    queryFn: () => adminService.supportCases(filters).then((r) => r.data),
    // The list stays on screen while a new filter loads. Without it the whole
    // page flips to skeletons on every click, which reads slower than it is.
    placeholderData: keepPreviousData,
  })

  const openCase = (id) => {
    const next = new URLSearchParams(searchParams)
    next.set('case', id)
    setSearchParams(next)
  }
  const closeCase = () => {
    const next = new URLSearchParams(searchParams)
    next.delete('case')
    setSearchParams(next, { replace: true })
  }

  // A case is addressable by URL, so an admin can send a colleague a link to
  // the exact case rather than "check the support tab, third one down".
  if (openId) return <SupportCaseDetail caseId={openId} onBack={closeCase} />

  const cases = data?.cases ?? []

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Support</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Every request that needs a person — reports, questions, verification, safety.
        </p>
      </div>

      <Counters
        counts={counts}
        active={activeTile}
        onPick={(key, filter) => {
          setActiveTile(key)
          setFilters(key ? filter : {})
        }}
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <form
          className="flex-1 flex items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            // Submitted, not debounced-as-you-type: the search resolves
            // "SC-1042" to one row, and firing per keystroke would run that
            // lookup for "S", "SC", "SC-"…
            setActiveTile(null)
            setFilters(searchDraft.trim() ? { search: searchDraft.trim() } : {})
          }}
        >
          <div className="relative flex-1">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" aria-hidden />
            <input
              value={searchDraft}
              onChange={(e) => setSearchDraft(e.target.value)}
              placeholder="SC-1042, a name, an email, a listing…"
              aria-label="Search support cases"
              className="min-h-[44px] w-full pl-9 pr-3 py-3 rounded-xl border border-slate-200 bg-white text-sm text-slate-800 placeholder-slate-500 outline-none focus:border-[#111111] focus:ring-2 focus:ring-black/8 transition"
            />
          </div>
        </form>

        <div className="flex items-center gap-2">
          <div className="w-40">
            <Select
              value={filters.status ?? ''}
              onChange={(v) => { setActiveTile(null); setFilters((f) => ({ ...f, status: v || undefined })) }}
              placeholder="Any status"
              options={[{ value: '', label: 'Any status' }, ...STATUS_OPTIONS]}
            />
          </div>
          <div className="w-40">
            <Select
              value={filters.type ?? ''}
              onChange={(v) => { setActiveTile(null); setFilters((f) => ({ ...f, type: v || undefined })) }}
              placeholder="Any type"
              options={[{ value: '', label: 'Any type' }, ...TYPE_OPTIONS]}
            />
          </div>
          <div className="w-36">
            <Select
              value={filters.priority ?? ''}
              onChange={(v) => { setActiveTile(null); setFilters((f) => ({ ...f, priority: v || undefined })) }}
              placeholder="Any priority"
              options={[{ value: '', label: 'Any priority' }, ...PRIORITY_OPTIONS]}
            />
          </div>
        </div>
      </div>

      {isError ? (
        <div className="text-center py-12 bg-white border border-slate-100 rounded-2xl">
          <p className="text-sm text-slate-600">Couldn&apos;t load the support queue.</p>
          <button
            onClick={() => refetch()}
            className="mt-3 min-h-[44px] px-5 py-3 rounded-xl bg-[#111111] text-white text-sm font-semibold hover:bg-[#2a2a2a] transition-colors"
          >
            Try again
          </button>
        </div>
      ) : isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => <div key={i} className="h-24 bg-slate-100 rounded-2xl animate-pulse" />)}
        </div>
      ) : cases.length === 0 ? (
        <div className="text-center py-16 bg-white border border-slate-100 rounded-2xl">
          <p className="text-sm font-semibold text-slate-700">
            {/* Two different facts, and only one of them is good news. */}
            {Object.keys(filters).length > 0 ? 'No cases match this filter' : 'No support cases yet'}
          </p>
          <p className="text-sm text-slate-500 mt-1 max-w-sm mx-auto">
            {Object.keys(filters).length > 0
              ? 'Clear the filter to see the rest of the queue.'
              : 'Reports, questions and safety issues will arrive here as people send them.'}
          </p>
        </div>
      ) : (
        <>
          <div className="space-y-3">
            {cases.map((c) => <CaseRow key={c.id} c={c} onOpen={openCase} />)}
          </div>
          <p className="text-xs text-slate-500">
            Showing {cases.length} of {data?.total ?? cases.length} · urgent first, then oldest
          </p>
        </>
      )}
    </div>
  )
}
