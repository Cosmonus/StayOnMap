import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { MessageCircle, AlertTriangle, BarChart3 } from 'lucide-react'
import { adminService } from '@services/admin.service'
import WhatsAppFunnel from './WhatsAppFunnel'
import WhatsAppConversationDetail from './WhatsAppConversationDetail'
import { STATUS_WORD, ago } from './whatsappVocab'

// Owners listing over WhatsApp. Two tabs: Conversations (the work surface —
// a master-detail split, list left, transcript right) and Funnel (the
// analytics). Kept separate so reading numbers never competes with reading a
// conversation.

const FILTERS = [
  { value: 'open',      label: 'In progress' },
  { value: 'VERIFICATION', label: 'Awaiting review' },
  { value: 'COMPLETED', label: 'Live' },
  { value: 'CANCELLED', label: 'Cancelled' },
  { value: 'errors',    label: 'Errors' },
  { value: '',          label: 'All' },
]

const PAGE_SIZE = 30

function ConversationRow({ c, selected, onOpen }) {
  return (
    <button onClick={() => onOpen(c.id)} aria-current={selected || undefined} className={`w-full text-left rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-brand-500 ${selected ? 'bg-brand-50 ring-1 ring-brand-200' : 'bg-white ring-1 ring-slate-200 hover:bg-slate-50'}`}>
      <p className="text-sm font-semibold text-slate-900 truncate">{c.user?.name ?? 'Unknown owner'}</p>
      <p className="font-mono text-xs text-slate-500 truncate">{c.phoneMasked}</p>
      <p className="text-xs text-slate-500 mt-1 truncate">
        {c.propertyTypeLabel ?? 'No type yet'} · {STATUS_WORD[c.status] ?? c.status}{c.currentQuestion ? ` (${c.currentQuestion})` : ''} · {c.completionPct}%
      </p>
      <p className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
        {ago(c.lastMessageAt)}
        {c.lastError && <span className="flex items-center gap-1 text-amber-700"><AlertTriangle size={16} aria-hidden="true" />error</span>}
      </p>
    </button>
  )
}

function ConversationsView({ openId, setOpenId }) {
  const [filter, setFilterRaw] = useState('open')
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)

  const setFilter = (v) => { setFilterRaw(v); setPage(1) }

  // Debounced search — one query per pause, not per keystroke.
  useEffect(() => {
    const t = setTimeout(() => { setSearch(searchInput.trim()); setPage(1) }, 300)
    return () => clearTimeout(t)
  }, [searchInput])

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['admin-whatsapp', filter, search, page],
    queryFn: () => adminService.whatsappConversations({ status: filter || undefined, search: search || undefined, page, limit: PAGE_SIZE }).then((r) => r.data),
    placeholderData: (prev) => prev,
  })
  const rows = data?.conversations ?? []
  const counts = data?.counts
  const totalPages = data?.total ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1
  const chipCount = (value) => (counts ? (value === '' ? counts.all : counts[value] ?? null) : null)

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="flex gap-2 flex-wrap">
          {FILTERS.map((f) => {
            const n = chipCount(f.value)
            return (
              <button key={f.value} onClick={() => setFilter(f.value)} className={`min-h-[40px] px-3 rounded-lg text-xs font-semibold ${filter === f.value ? 'bg-slate-900 text-white' : 'bg-white ring-1 ring-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                {f.label}{n != null && <span className={`ml-1.5 font-mono ${filter === f.value ? 'text-slate-200' : 'text-slate-500'}`}>{n}</span>}
              </button>
            )
          })}
        </div>
        <input value={searchInput} onChange={(e) => setSearchInput(e.target.value)} placeholder="Search name or number" aria-label="Search conversations" className="sm:ml-auto min-h-[40px] px-3 rounded-lg ring-1 ring-slate-200 text-sm focus:ring-2 focus:ring-brand-500 outline-none" />
      </div>

      {isLoading ? (
        <div className="space-y-2">{[1, 2, 3].map((i) => <div key={i} className="h-16 bg-slate-100 animate-pulse rounded-2xl" />)}</div>
      ) : isError ? (
        <div className="bg-white rounded-2xl ring-1 ring-slate-200 p-6 text-sm text-slate-600">Couldn’t load conversations. <button onClick={() => refetch()} className="underline">Retry</button></div>
      ) : rows.length === 0 ? (
        <div className="bg-white rounded-2xl ring-1 ring-slate-200 p-8 text-center">
          <MessageCircle size={24} className="mx-auto text-slate-500" aria-hidden="true" />
          <h2 className="text-base font-semibold text-slate-800 mt-2">No conversations here</h2>
          <p className="text-sm text-slate-500 mt-1">When an owner messages the StayOnMap WhatsApp number, they appear in this list.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
          <aside className="lg:col-span-3 space-y-2">
            {rows.map((c) => <ConversationRow key={c.id} c={c} selected={c.id === openId} onOpen={setOpenId} />)}
            {totalPages > 1 && (
              <div className="flex items-center justify-between gap-2 pt-1">
                <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="min-h-[40px] px-3 rounded-lg text-xs font-semibold bg-white ring-1 ring-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed">Previous</button>
                <span className="text-xs text-slate-500 text-center">Page {page} of {totalPages}</span>
                <button disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)} className="min-h-[40px] px-3 rounded-lg text-xs font-semibold bg-white ring-1 ring-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed">Next</button>
              </div>
            )}
          </aside>
          <section className="lg:col-span-9">
            {openId ? (
              <WhatsAppConversationDetail id={openId} onClose={() => setOpenId(null)} />
            ) : (
              <div className="bg-white rounded-2xl ring-1 ring-slate-200 p-10 text-center">
                <MessageCircle size={24} className="mx-auto text-slate-500" aria-hidden="true" />
                <p className="text-sm text-slate-500 mt-2">Select a conversation to read its transcript and intervene.</p>
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  )
}

export default function WhatsAppSection() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [view, setView] = useState('conversations')
  const [days, setDays] = useState(30)
  const [openId, setOpenId] = useState(null)

  // Review Listings links here with ?conversationId= — open it on the
  // Conversations tab, then drop the param so a refresh does not re-open it.
  const deepLinkId = searchParams.get('conversationId')
  useEffect(() => {
    if (deepLinkId) {
      setOpenId(deepLinkId)
      setView('conversations')
      setSearchParams({ tab: 'whatsapp' }, { replace: true })
    }
  }, [deepLinkId, setSearchParams])

  const TABS = [
    { id: 'conversations', label: 'Conversations', icon: MessageCircle },
    { id: 'funnel', label: 'Funnel', icon: BarChart3 },
  ]

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2"><MessageCircle size={20} className="text-brand-700" />WhatsApp listings</h1>
        <p className="text-sm text-slate-500 mt-1">Owners listing by chat. Nothing here is auto-approved: a submitted listing waits in Review Listings like any other, and the bot tells the owner when you approve or reject it.</p>
      </div>

      <div className="border-b border-slate-200 flex gap-1" role="tablist" aria-label="WhatsApp views">
        {TABS.map((t) => (
          <button key={t.id} role="tab" aria-selected={view === t.id} onClick={() => setView(t.id)} className={`flex items-center gap-1.5 min-h-[44px] px-4 text-sm font-semibold border-b-2 -mb-px ${view === t.id ? 'border-brand-600 text-brand-700' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
            <t.icon size={16} aria-hidden="true" />{t.label}
          </button>
        ))}
      </div>

      {view === 'funnel'
        ? <WhatsAppFunnel days={days} setDays={setDays} />
        : <ConversationsView openId={openId} setOpenId={setOpenId} />}
    </div>
  )
}
