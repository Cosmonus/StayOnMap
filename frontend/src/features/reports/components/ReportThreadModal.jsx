import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import Modal from '@components/common/Modal'
import { toast } from '@components/common/Toaster'
import { reportService } from '@services/report.service'

/**
 * The reporter's side of the conversation on their report.
 *
 * Reached from the notification that announced the reply — the only place a
 * report is ever named in this product. Until 2026-08-10 that notification did
 * not exist and neither did this: a person reported a fraudulent listing and
 * heard nothing, forever, which is how a reporting feature teaches people it
 * does not work.
 *
 * Opens over the notifications tab rather than on a page of its own, because
 * that is where the reader already is (web push lands every notification there)
 * and a report has no other home in the product.
 */
const STATUS_LABEL = {
  PENDING:      'Waiting to be reviewed',
  UNDER_REVIEW: 'Being reviewed',
  RESOLVED:     'Reviewed — action taken',
  DISMISSED:    'Reviewed — no breach found',
}

const MAX = 2000

export default function ReportThreadModal({ reportId, onClose }) {
  const qc = useQueryClient()
  const [draft, setDraft] = useState('')

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['my-report-thread', reportId],
    queryFn: () => reportService.myThread(reportId).then((r) => r.data),
    enabled: !!reportId,
  })

  const reply = useMutation({
    mutationFn: (body) => reportService.myReply(reportId, body),
    onSuccess: () => {
      setDraft('')
      qc.invalidateQueries({ queryKey: ['my-report-thread', reportId] })
      // Opening the thread marks the moderator's messages read server-side, so
      // the bell's count is stale the moment this renders.
      qc.invalidateQueries({ queryKey: ['notifications'] })
      qc.invalidateQueries({ queryKey: ['notification-unread'] })
    },
    onError: (err) => toast.error('Couldn’t send your message', err.message ?? 'Please try again'),
  })

  const messages = data?.messages ?? []

  return (
    <Modal isOpen={!!reportId} onClose={onClose} title="Your report">
      <div className="space-y-3">
        {isLoading ? (
          <div className="h-32 bg-slate-100 rounded-xl animate-pulse" />
        ) : isError ? (
          <div className="text-center py-6">
            <p className="text-sm text-slate-600">Couldn&apos;t load this report.</p>
            <button
              onClick={() => refetch()}
              className="mt-3 min-h-[44px] px-5 py-3 rounded-xl bg-[#111111] text-white text-sm font-semibold hover:bg-[#2a2a2a] transition-colors"
            >
              Try again
            </button>
          </div>
        ) : (
          <>
            <p className="text-sm text-slate-600">
              {data?.report?.category?.replace(/_/g, ' ').toLowerCase()} &middot;{' '}
              {STATUS_LABEL[data?.report?.status] ?? data?.report?.status}
            </p>

            {messages.length > 0 ? (
              <ul className="space-y-2">
                {messages.map((m) => {
                  const mine = m.authorRole === 'REPORTER'
                  return (
                    <li
                      key={m.id}
                      className={`rounded-xl px-3 py-2 text-sm ${mine ? 'bg-slate-50 text-slate-700' : 'bg-brand-50 text-slate-800'}`}
                    >
                      {/* "StayOnMap" and not a moderator's name — which
                          individual handled a report is not something a
                          reporter needs, and is something a determined person
                          could act on. */}
                      <p className="text-[11px] font-semibold text-slate-500 mb-0.5">
                        {mine ? 'You' : 'StayOnMap'}
                        {' · '}
                        {new Date(m.createdAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      </p>
                      <p className="whitespace-pre-wrap leading-relaxed">{m.body}</p>
                    </li>
                  )
                })}
              </ul>
            ) : (
              <p className="text-sm text-slate-500 py-2">
                No messages yet. You can add anything that would help us look into this.
              </p>
            )}

            <textarea
              value={draft}
              onChange={(e) => e.target.value.length <= MAX && setDraft(e.target.value)}
              rows={3}
              placeholder="Add detail — which listing, what happened, anything you can send us."
              className="w-full px-3.5 py-3 rounded-xl border border-slate-200 bg-slate-50 text-sm text-slate-800 placeholder-slate-500 outline-none focus:border-[#111111] focus:bg-white focus:ring-2 focus:ring-black/8 transition resize-none leading-relaxed"
            />
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs text-slate-500">Only our team sees this. The owner never does.</p>
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
      </div>
    </Modal>
  )
}
