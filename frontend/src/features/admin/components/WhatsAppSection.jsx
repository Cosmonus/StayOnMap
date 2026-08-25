import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { MessageCircle, AlertTriangle, MapPin, Image as ImageIcon, RefreshCw } from 'lucide-react'
import { adminService } from '@services/admin.service'
import { toast } from '@components/common/Toaster'
import { confirm } from '@components/common/ConfirmDialog'
import TrustBadge from '@components/common/TrustBadge'
import PropertyStatusPill from '@components/common/PropertyStatusPill'

// Owners listing over WhatsApp: who is mid-conversation, where they got
// stuck, what broke, and the funnel across all of them. Interventions go
// through the same engine paths the owner's own replies take.

const FILTERS = [
  { value: 'open',      label: 'In progress' },
  { value: 'VERIFICATION', label: 'Awaiting review' },
  { value: 'COMPLETED', label: 'Live' },
  { value: 'CANCELLED', label: 'Cancelled' },
  { value: 'errors',    label: 'Errors' },
  { value: '',          label: 'All' },
]

const STATUS_WORD = {
  START: 'Starting', PROPERTY_TYPE: 'Choosing type', QUESTIONNAIRE: 'Answering', LOCATION: 'Sharing location',
  PHOTOS: 'Sending photos', REVIEW: 'Reviewing', CONFIRMATION: 'Publishing', VERIFICATION: 'Awaiting review',
  COMPLETED: 'Live', CANCELLED: 'Cancelled',
}

const STEP_LABEL = {
  wa_conversation_started: 'Started', wa_type_selected: 'Chose type', wa_questionnaire_started: 'Began questions',
  wa_location_submitted: 'Location confirmed', wa_photos_submitted: 'Photos sent', wa_draft_completed: 'Draft complete',
  wa_review_shown: 'Saw review', wa_publish_confirmed: 'Pressed publish', wa_verification_passed: 'Approved',
  wa_listing_published: 'Told it is live',
}
const FAILURE_LABEL = {
  wa_extraction_failed: 'Not understood', wa_location_failed: 'Location failed', wa_photo_failed: 'Photo failed',
  wa_verification_failed: 'Rejected', wa_publish_failed: 'Publish failed', wa_conversation_cancelled: 'Cancelled',
}

const ago = (iso) => {
  const ms = Date.now() - new Date(iso).getTime()
  const m = Math.round(ms / 60_000)
  if (m < 60) return `${m}m ago`
  const h = Math.round(m / 60)
  if (h < 48) return `${h}h ago`
  return `${Math.round(h / 24)}d ago`
}

function FunnelPanel({ days, setDays }) {
  const { data, isLoading } = useQuery({
    queryKey: ['admin-whatsapp-funnel', days],
    queryFn: () => adminService.whatsappFunnel(days).then((r) => r.data),
  })
  if (isLoading || !data) return <div className="h-40 bg-slate-100 animate-pulse rounded-2xl" />
  const max = Math.max(1, ...data.steps.map((s) => s.count))
  return (
    <div className="bg-white rounded-2xl ring-1 ring-slate-200 p-4 sm:p-6 space-y-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-semibold text-slate-900">WhatsApp listing funnel</h2>
          <p className="text-sm text-slate-500">Counted in conversations. Every rate is against conversations started.</p>
        </div>
        <div className="flex gap-2">
          {[7, 30, 90].map((d) => (
            <button key={d} onClick={() => setDays(d)} className={`min-h-[40px] px-3 rounded-lg text-xs font-semibold ${days === d ? 'bg-slate-900 text-white' : 'bg-white ring-1 ring-slate-200 text-slate-600 hover:bg-slate-50'}`}>
              {d}d
            </button>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Stat label="Started" value={data.started} />
        <Stat label="Listings created" value={data.listingsCreated} sub={`${data.completionRate}% of started`} />
        <Stat label="Went live" value={data.listingsPublished} />
        <Stat label="Median time to submit" value={data.medianMinutesToSubmit != null ? `${data.medianMinutesToSubmit} min` : '—'} sub={data.sampleSize ? `${data.sampleSize} listings` : 'no data yet'} />
      </div>
      <ol className="space-y-2">
        {data.steps.map((s) => (
          <li key={s.name} className="flex items-center gap-4 text-sm">
            <span className="w-36 shrink-0 text-slate-600">{STEP_LABEL[s.name] ?? s.name}</span>
            <div className="flex-1 h-3 bg-slate-100 rounded-full overflow-hidden">
              <div className="h-full bg-brand-500 rounded-full" style={{ width: `${Math.round((s.count / max) * 100)}%` }} />
            </div>
            <span className="w-24 shrink-0 text-right text-slate-700 font-mono">{s.count} <span className="text-slate-500">· {s.rate}%</span></span>
          </li>
        ))}
      </ol>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
        <div>
          <h3 className="font-semibold text-slate-700 mb-2">By property type</h3>
          {data.byType.length ? data.byType.map((t) => <p key={t.propertyType} className="flex justify-between text-slate-600"><span>{t.label}</span><span className="font-mono">{t.count}</span></p>) : <p className="text-slate-500">Nothing yet.</p>}
        </div>
        <div>
          <h3 className="font-semibold text-slate-700 mb-2">Where quiet conversations are stuck</h3>
          {data.dropOff.length ? data.dropOff.slice(0, 6).map((d) => <p key={d.question} className="flex justify-between text-slate-600"><span className="font-mono text-xs">{d.question}</span><span className="font-mono">{d.count}</span></p>) : <p className="text-slate-500">Nobody stuck for over a day.</p>}
        </div>
        <div>
          <h3 className="font-semibold text-slate-700 mb-2">Failures</h3>
          {data.failures.map((f) => <p key={f.name} className="flex justify-between text-slate-600"><span>{FAILURE_LABEL[f.name] ?? f.name}</span><span className="font-mono">{f.count}</span></p>)}
        </div>
      </div>
    </div>
  )
}

function Stat({ label, value, sub }) {
  return (
    <div className="bg-slate-50 rounded-xl p-4">
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className="text-2xl font-serif font-semibold text-slate-900">{value}</p>
      {sub && <p className="text-xs text-slate-500 mt-1">{sub}</p>}
    </div>
  )
}

function ConversationRow({ c, onOpen }) {
  return (
    <button onClick={() => onOpen(c.id)} className="w-full text-left bg-white rounded-2xl ring-1 ring-slate-200 p-4 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-brand-500">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-slate-900 truncate">
            {c.user?.name ?? 'Unknown owner'} <span className="font-mono text-slate-500 font-normal">{c.phoneMasked}</span>
          </p>
          <p className="text-xs text-slate-500 mt-1">
            {c.propertyTypeLabel ?? 'No type yet'} · {STATUS_WORD[c.status] ?? c.status}{c.currentQuestion ? ` (${c.currentQuestion})` : ''} · {c.completionPct}% · {ago(c.lastMessageAt)}
          </p>
        </div>
        <div className="flex items-center gap-4 text-xs text-slate-500 shrink-0">
          {c.location && <span className="flex items-center gap-1"><MapPin size={16} className="text-brand-700" />{c.location.locality ?? c.location.city}</span>}
          <span className="flex items-center gap-1"><ImageIcon size={16} />{c.photoCount}</span>
          {c.property && <PropertyStatusPill status={c.property.status} />}
          {c.lastError && <span className="flex items-center gap-1 text-amber-700"><AlertTriangle size={16} />error</span>}
        </div>
      </div>
    </button>
  )
}

function ConversationDetail({ id, onClose }) {
  const qc = useQueryClient()
  const [text, setText] = useState('')
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['admin-whatsapp-conversation', id],
    queryFn: () => adminService.whatsappConversation(id).then((r) => r.data),
  })
  const act = useMutation({
    mutationFn: (body) => adminService.whatsappIntervene(id, body),
    onSuccess: () => { toast.success('Done'); setText(''); qc.invalidateQueries({ queryKey: ['admin-whatsapp'] }); refetch() },
    onError: (err) => toast.error('Couldn’t do that', err.message ?? 'Please try again'),
  })

  if (isLoading) return <div className="h-64 bg-slate-100 animate-pulse rounded-2xl" />
  if (isError || !data) return <div className="bg-white rounded-2xl ring-1 ring-slate-200 p-6 text-sm text-slate-600">Couldn’t load this conversation. <button onClick={() => refetch()} className="underline">Retry</button></div>

  const open = !['COMPLETED', 'CANCELLED', 'VERIFICATION'].includes(data.status)
  return (
    <div className="bg-white rounded-2xl ring-1 ring-slate-200 p-4 sm:p-6 space-y-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-base font-semibold text-slate-900">{data.user?.name ?? 'Unknown owner'} <span className="font-mono text-slate-500 font-normal">{data.phoneMasked}</span></h2>
          <p className="text-sm text-slate-500">{data.propertyTypeLabel ?? 'No type yet'} · {STATUS_WORD[data.status]} · {data.completionPct}% · started {ago(data.createdAt)}</p>
          {data.user?.email && <p className="text-xs text-slate-500">{data.user.email}</p>}
        </div>
        <button onClick={onClose} className="min-h-[40px] px-3 rounded-lg text-xs font-semibold bg-white ring-1 ring-slate-200 text-slate-600 hover:bg-slate-50 shrink-0">Close</button>
      </div>

      {data.lastError && (
        <div className="rounded-xl bg-amber-50 ring-1 ring-amber-200 p-4 text-sm text-amber-900 flex items-start gap-2">
          <AlertTriangle size={16} className="shrink-0 mt-0.5" />
          <span><strong>Last error</strong> ({data.errorCount} total): {data.lastError}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="space-y-4">
          <div className="rounded-xl bg-slate-50 p-4 text-sm space-y-2">
            <h3 className="font-semibold text-slate-700">Draft</h3>
            {data.location ? <p className="text-slate-600 flex items-center gap-1"><MapPin size={16} className="text-brand-700" />{[data.location.locality, data.location.city].filter(Boolean).join(', ')} <span className="font-mono text-xs text-slate-500">{data.location.lat?.toFixed?.(5)}, {data.location.lng?.toFixed?.(5)}</span></p> : <p className="text-slate-500">Location not confirmed</p>}
            <dl className="grid grid-cols-2 gap-x-4 gap-y-1">
              {Object.entries(data.draft.fields).filter(([, v]) => v !== null && v !== '').map(([k, v]) => (
                <div key={k} className="contents"><dt className="text-slate-500 font-mono text-xs">{k}</dt><dd className="text-slate-700 truncate">{Array.isArray(v) ? v.join(', ') : String(v)}</dd></div>
              ))}
            </dl>
            {data.draft.photos.length > 0 && (
              <div className="pt-2">
                <p className="text-xs font-semibold text-slate-500 mb-2">Photos sent ({data.draft.photos.length}) — click to open full size</p>
                <div className="flex gap-2 flex-wrap">
                  {data.draft.photos.map((p, i) => (
                    <a key={p.url} href={p.url} target="_blank" rel="noreferrer" className="block rounded-lg overflow-hidden ring-1 ring-slate-200 focus:ring-2 focus:ring-brand-500">
                      <img src={p.url.replace('_full.webp', '_thumb.webp')} alt={`Photo ${i + 1} sent by the owner`} className="w-24 h-24 object-cover" loading="lazy" />
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>
          {data.property && (
            <div className="rounded-xl bg-slate-50 p-4 text-sm space-y-2">
              <h3 className="font-semibold text-slate-700">Listing</h3>
              <p className="text-slate-700">{data.property.title}</p>
              <p className="flex items-center gap-4 flex-wrap text-xs text-slate-500">
                <PropertyStatusPill status={data.property.status} />
                {data.property.trustScore?.badge && <TrustBadge badge={data.property.trustScore.badge} size="sm" />}
                {data.property.riskScore && <span>Risk {data.property.riskScore.level}</span>}
                {data.property.verification && <span>Verification {data.property.verification.status}</span>}
                <span>{data.property._count?.images ?? 0} photos</span>
              </p>
              <a href={`/admin?tab=review-listings&propertyId=${data.property.id}`} className="text-brand-700 underline text-xs">Open in Review Listings</a>
            </div>
          )}
          <div className="rounded-xl bg-slate-50 p-4 text-sm space-y-2">
            <h3 className="font-semibold text-slate-700">Intervene</h3>
            <div className="flex gap-2 flex-wrap">
              {open && <button disabled={act.isPending} onClick={() => act.mutate({ action: 'nudge' })} className="min-h-[40px] px-3 rounded-lg text-xs font-semibold bg-white ring-1 ring-slate-200 text-slate-700 hover:bg-slate-100 disabled:opacity-60">Re-ask current question</button>}
              {['REVIEW', 'CONFIRMATION'].includes(data.status) && <button disabled={act.isPending} onClick={() => act.mutate({ action: 'retry_publish' })} className="min-h-[40px] px-3 rounded-lg text-xs font-semibold bg-white ring-1 ring-slate-200 text-slate-700 hover:bg-slate-100 disabled:opacity-60 flex items-center gap-1"><RefreshCw size={16} />Retry publish</button>}
              {open && <button disabled={act.isPending} onClick={async () => { if (await confirm({ title: 'Cancel this conversation?', body: 'The owner will be told and can start again.', confirmLabel: 'Cancel it', danger: true })) act.mutate({ action: 'cancel' }) }} className="min-h-[40px] px-3 rounded-lg text-xs font-semibold bg-white ring-1 ring-red-200 text-red-700 hover:bg-red-50 disabled:opacity-60">Cancel conversation</button>}
            </div>
            <form onSubmit={(e) => { e.preventDefault(); if (text.trim()) act.mutate({ action: 'message', text }) }} className="flex gap-2">
              <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Send the owner a message on WhatsApp…" aria-label="Message to owner" className="flex-1 min-h-[44px] px-3 rounded-xl ring-1 ring-slate-200 text-sm focus:ring-2 focus:ring-brand-500 outline-none" />
              <button type="submit" disabled={act.isPending || !text.trim()} className="min-h-[44px] px-4 rounded-xl bg-[#111111] text-white text-sm font-semibold hover:bg-[#2a2a2a] disabled:opacity-60">Send</button>
            </form>
          </div>
        </div>

        <div className="rounded-xl bg-slate-50 p-4 text-sm">
          <h3 className="font-semibold text-slate-700 mb-2">Transcript</h3>
          <ol className="space-y-2 max-h-[480px] overflow-y-auto pr-1">
            {data.messages.map((m) => (
              <li key={m.id} className={`flex ${m.direction === 'OUT' ? 'justify-start' : 'justify-end'}`}>
                <div className={`max-w-[85%] rounded-xl px-3 py-2 whitespace-pre-wrap ${m.direction === 'OUT' ? 'bg-white ring-1 ring-slate-200 text-slate-700' : 'bg-brand-50 text-slate-800'}`}>
                  {m.text}
                  <p className="text-[11px] text-slate-500 mt-1">{ago(m.createdAt)}{m.status === 'SEND_FAILED' || m.status === 'FAILED' ? ` · ${m.status.toLowerCase()}${m.error ? `: ${m.error}` : ''}` : ''}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </div>
  )
}

export default function WhatsAppSection() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [filter, setFilter] = useState('open')
  const [search, setSearch] = useState('')
  const [days, setDays] = useState(30)
  const [openId, setOpenId] = useState(null)

  // Review Listings links here with ?conversationId= — open it, then drop the
  // param so a refresh does not keep re-opening it.
  const deepLinkId = searchParams.get('conversationId')
  useEffect(() => {
    if (deepLinkId) {
      setOpenId(deepLinkId)
      setSearchParams({ tab: 'whatsapp' }, { replace: true })
    }
  }, [deepLinkId, setSearchParams])

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['admin-whatsapp', filter, search],
    queryFn: () => adminService.whatsappConversations({ status: filter || undefined, search: search || undefined, limit: 50 }).then((r) => r.data),
  })
  const rows = data?.conversations ?? []

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2"><MessageCircle size={20} className="text-brand-700" />WhatsApp listings</h1>
        <p className="text-sm text-slate-500 mt-1">Owners listing by chat. Nothing here is auto-approved: a submitted listing waits in Review Listings like any other, and the bot tells the owner when you approve or reject it.</p>
      </div>

      <FunnelPanel days={days} setDays={setDays} />

      {openId && <ConversationDetail id={openId} onClose={() => setOpenId(null)} />}

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="flex gap-2 flex-wrap">
          {FILTERS.map((f) => (
            <button key={f.value} onClick={() => setFilter(f.value)} className={`min-h-[40px] px-3 rounded-lg text-xs font-semibold ${filter === f.value ? 'bg-slate-900 text-white' : 'bg-white ring-1 ring-slate-200 text-slate-600 hover:bg-slate-50'}`}>{f.label}</button>
          ))}
        </div>
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name or number" aria-label="Search conversations" className="sm:ml-auto min-h-[40px] px-3 rounded-lg ring-1 ring-slate-200 text-sm focus:ring-2 focus:ring-brand-500 outline-none" />
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
        <div className="space-y-2">
          {rows.map((c) => <ConversationRow key={c.id} c={c} onOpen={setOpenId} />)}
          {data.total > rows.length && <p className="text-xs text-slate-500 text-center">Showing {rows.length} of {data.total}</p>}
        </div>
      )}
    </div>
  )
}
