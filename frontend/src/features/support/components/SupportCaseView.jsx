import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft } from 'lucide-react'
import { useAuth } from '@features/auth/hooks/useAuth'
import { supportService } from '@services/support.service'
import { toast } from '@components/common/Toaster'
import { STATUS_COPY, CATEGORY_LABEL, caseRef, authorName } from './supportCopy'

/**
 * One of your support requests.
 *
 * Everything here arrives already filtered: the server decided which messages
 * this reader may see before it sent them, so there is no visibility logic in
 * this file and there must never be. If a message is on screen, it was meant
 * for them.
 */
export default function SupportCaseView({ caseId, onBack }) {
  const qc = useQueryClient()
  const { user } = useAuth()
  const [draft, setDraft] = useState('')

  const { data: c, isLoading, isError, refetch } = useQuery({
    queryKey: ['support-case', caseId],
    queryFn: () => supportService.getCase(caseId).then((r) => r.data),
  })

  const after = () => {
    qc.invalidateQueries({ queryKey: ['support-case', caseId] })
    qc.invalidateQueries({ queryKey: ['support-cases'] })
    // Opening the case marks staff messages read server-side, so the bell's
    // count is stale the moment this renders.
    qc.invalidateQueries({ queryKey: ['notifications'] })
    qc.invalidateQueries({ queryKey: ['notification-unread'] })
  }

  const reply = useMutation({
    mutationFn: () => supportService.reply(caseId, draft.trim()),
    onSuccess: () => { setDraft(''); after() },
    onError: (err) => toast.error('Couldn’t send that', err.message ?? 'Please try again'),
  })

  const close = useMutation({
    mutationFn: () => supportService.close(caseId),
    onSuccess: () => { toast.success('Thanks — closed', 'You can always open a new request.'); after() },
    onError: (err) => toast.error('Couldn’t close it', err.message ?? 'Please try again'),
  })

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-9 w-28 bg-slate-100 rounded-xl animate-pulse" />
        <div className="h-32 bg-slate-100 rounded-2xl animate-pulse" />
      </div>
    )
  }

  if (isError || !c) {
    return (
      <div className="text-center py-16 bg-white border border-slate-100 rounded-2xl">
        <p className="text-sm font-semibold text-slate-700">Couldn&apos;t open this request</p>
        <p className="text-sm text-slate-500 mt-1">It may have been closed, or the link may be old.</p>
        <div className="flex items-center justify-center gap-2 mt-4">
          <button onClick={() => refetch()} className="min-h-[44px] px-5 py-3 rounded-xl bg-[#111111] text-white text-sm font-semibold">Try again</button>
          <button onClick={onBack} className="min-h-[44px] px-5 py-3 rounded-xl border border-slate-200 text-sm font-semibold text-slate-700">Back</button>
        </div>
      </div>
    )
  }

  const status = STATUS_COPY[c.status] ?? { label: c.status, tone: 'text-slate-500' }
  const closed = c.status === 'CLOSED'

  return (
    <div className="space-y-5">
      <button
        onClick={onBack}
        className="min-h-[44px] inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-100 transition-colors"
      >
        <ArrowLeft size={16} /> Back to support
      </button>

      <div className="bg-white border border-slate-200 rounded-2xl p-5">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-mono text-[11px] font-semibold text-slate-500">{caseRef(c.number)}</span>
          <span className="text-xs text-slate-500">{CATEGORY_LABEL[c.type] ?? c.type}</span>
        </div>
        <h1 className="text-lg font-bold text-slate-900 mt-1">{c.subject}</h1>
        <p className={`text-sm mt-1 ${status.tone}`}>{status.label}</p>
        <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed mt-3">{c.description}</p>
        {c.relatedProperty && (
          <p className="text-xs text-slate-500 mt-3">
            About {c.relatedProperty.title}{c.relatedProperty.city ? ` · ${c.relatedProperty.city}` : ''}
          </p>
        )}
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl p-5">
        {c.messages?.length > 0 ? (
          <ul className="space-y-2">
            {c.messages.map((m) => {
              const mine = m.authorUser?.id === user?.id
              return (
                <li key={m.id} className={`rounded-xl px-3 py-2 ${mine ? 'bg-slate-50' : 'bg-brand-50'}`}>
                  <p className="text-[11px] font-semibold text-slate-500 mb-0.5">
                    {authorName(m, user?.id)}
                    {' · '}
                    {new Date(m.createdAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  </p>
                  <p className="text-sm text-slate-800 whitespace-pre-wrap leading-relaxed">{m.body}</p>
                </li>
              )
            })}
          </ul>
        ) : (
          <p className="text-sm text-slate-500">
            No replies yet. We read everything that comes in — usually the same day.
          </p>
        )}

        {closed ? (
          <p className="text-sm text-slate-500 mt-4 pt-4 border-t border-slate-100">
            This request is closed. If it comes back, open a new one and we will pick it up from there.
          </p>
        ) : (
          <div className="mt-4 pt-4 border-t border-slate-100">
            <textarea
              value={draft}
              onChange={(e) => e.target.value.length <= 4000 && setDraft(e.target.value)}
              rows={3}
              placeholder="Add anything else that would help."
              className="w-full px-3.5 py-3 rounded-xl border border-slate-200 bg-slate-50 text-sm text-slate-800 placeholder-slate-500 outline-none focus:border-[#111111] focus:bg-white focus:ring-2 focus:ring-black/8 transition resize-none leading-relaxed"
            />
            <div className="flex items-center justify-between gap-3 mt-2 flex-wrap">
              {/* Offered only once WE have said it is resolved. Closing is the
                  requester agreeing, not deciding — and a Close button on an
                  unanswered request is an invitation to give up. */}
              {c.status === 'RESOLVED' ? (
                <button
                  type="button"
                  onClick={() => close.mutate()}
                  disabled={close.isPending}
                  className="min-h-[44px] px-4 py-3 rounded-xl border border-slate-200 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  {close.isPending ? 'Closing…' : 'That fixed it — close'}
                </button>
              ) : <span />}
              <button
                type="button"
                disabled={!draft.trim() || reply.isPending}
                onClick={() => reply.mutate()}
                className={`min-h-[44px] px-4 py-3 rounded-xl text-sm font-semibold transition-colors ${
                  draft.trim() && !reply.isPending
                    ? 'bg-[#111111] hover:bg-[#2a2a2a] text-white'
                    : 'bg-slate-100 text-slate-500 cursor-not-allowed'
                }`}
              >
                {reply.isPending ? 'Sending…' : 'Send'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
