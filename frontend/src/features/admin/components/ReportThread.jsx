import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { MessageSquare } from 'lucide-react'
import { adminService } from '@services/admin.service'
import { toast } from '@components/common/Toaster'

/**
 * The moderator's half of a report conversation.
 *
 * Until 2026-08-10 a report was a one-way form: a moderator could resolve or
 * dismiss it and had no way to ask the obvious question — which listing, what
 * exactly happened, do you have the message they sent you. The only options
 * were to guess or to dismiss, and dismissing for lack of detail is how a
 * reporting feature teaches people not to use it.
 *
 * Collapsed by default and opened per report: the queue is a list of decisions,
 * and a thread expanded on every row would bury the decision under the
 * conversation.
 */
export default function ReportThread({ reportId }) {
  const qc = useQueryClient()
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState('')

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['admin-report-thread', reportId],
    queryFn: () => adminService.reportThread(reportId).then((r) => r.data),
    enabled: open,
  })

  const reply = useMutation({
    mutationFn: (body) => adminService.replyToReport(reportId, body),
    onSuccess: () => {
      setDraft('')
      qc.invalidateQueries({ queryKey: ['admin-report-thread', reportId] })
      // The badge on the queue is driven by unread reporter messages; opening
      // and replying both change it.
      qc.invalidateQueries({ queryKey: ['admin-reports-awaiting'] })
    },
    onError: (err) => toast.error('Couldn’t send your reply', err.message ?? 'Please try again'),
  })

  const messages = data?.messages ?? []
  const canReply = data?.canReply

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-3 min-h-[44px] inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
      >
        <MessageSquare size={15} strokeWidth={1.8} />
        Ask the reporter
      </button>
    )
  }

  return (
    <div className="mt-3 pt-3 border-t border-slate-100">
      {isLoading ? (
        <div className="h-20 bg-slate-100 rounded-xl animate-pulse" />
      ) : isError ? (
        <div className="py-3">
          <p className="text-sm text-slate-600">Couldn&apos;t load this conversation.</p>
          <button onClick={() => refetch()} className="mt-2 min-h-[44px] px-4 py-2 rounded-xl bg-[#111111] text-white text-sm font-semibold">
            Try again
          </button>
        </div>
      ) : (
        <>
          {messages.length > 0 && (
            <ul className="space-y-2 mb-3">
              {messages.map((m) => {
                const fromAdmin = m.authorRole === 'ADMIN'
                return (
                  <li
                    key={m.id}
                    className={`rounded-xl px-3 py-2 text-sm ${fromAdmin ? 'bg-brand-50 text-slate-800' : 'bg-slate-50 text-slate-700'}`}
                  >
                    <p className="text-[11px] font-semibold text-slate-500 mb-0.5">
                      {fromAdmin ? 'You' : 'Reporter'}
                      {' · '}
                      {new Date(m.createdAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </p>
                    <p className="whitespace-pre-wrap leading-relaxed">{m.body}</p>
                  </li>
                )
              })}
            </ul>
          )}

          {canReply === false ? (
            // Stated, not a disabled box. An anonymous report has nobody to
            // reply TO, and a reply field that silently discards what you typed
            // is worse than none.
            <p className="text-sm text-slate-500 py-2">
              This report was filed anonymously, so there is nobody to reply to.
            </p>
          ) : (
            <>
              <textarea
                value={draft}
                onChange={(e) => e.target.value.length <= 2000 && setDraft(e.target.value)}
                rows={3}
                placeholder="Ask for the detail you need — which listing, what happened, anything they can send."
                className="w-full px-3.5 py-3 rounded-xl border border-slate-200 bg-slate-50 text-sm text-slate-800 placeholder-slate-500 outline-none focus:border-[#111111] focus:bg-white focus:ring-2 focus:ring-black/8 transition resize-none leading-relaxed"
              />
              <div className="flex items-center justify-between gap-3 mt-2">
                <p className="text-xs text-slate-500">
                  The reporter is notified. The owner never sees this.
                </p>
                <button
                  type="button"
                  disabled={!draft.trim() || reply.isPending}
                  onClick={() => reply.mutate(draft.trim())}
                  className={`min-h-[44px] px-4 py-3 rounded-xl text-sm font-semibold transition-colors ${
                    draft.trim() && !reply.isPending
                      ? 'bg-[#111111] hover:bg-[#2a2a2a] text-white'
                      : 'bg-slate-100 text-slate-500 cursor-not-allowed'
                  }`}
                >
                  {reply.isPending ? 'Sending…' : 'Send'}
                </button>
              </div>
            </>
          )}
        </>
      )}
    </div>
  )
}
