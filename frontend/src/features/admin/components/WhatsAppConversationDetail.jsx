import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, MapPin, RefreshCw } from 'lucide-react'
import { adminService } from '@services/admin.service'
import { toast } from '@components/common/Toaster'
import { confirm } from '@components/common/ConfirmDialog'
import TrustBadge from '@components/common/TrustBadge'
import PropertyStatusPill from '@components/common/PropertyStatusPill'
import { STATUS_WORD, ago } from './whatsappVocab'

// One conversation: who, how far, the draft so far, the listing it made, the
// transcript, and the interventions its state allows. Interventions go
// through the same engine paths the owner's own replies take.

export default function WhatsAppConversationDetail({ id, onClose }) {
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
          <ol className="space-y-2 max-h-[560px] overflow-y-auto pr-1">
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
