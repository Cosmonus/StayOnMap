import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Lock } from 'lucide-react'
import { adminService } from '@services/admin.service'
import Select from '@components/common/Select'
import { toast } from '@components/common/Toaster'
import {
  STATUS_LABEL, STATUS_PILL, PRIORITY_LABEL, PRIORITY_PILL, TYPE_LABEL,
  VISIBILITY_LABEL, MESSAGE_TONE, AUTHOR_LABEL, caseRef, describeEvent,
} from './supportVocab'

/**
 * One case, in full.
 *
 * The spec's requirement is that "the admin should never need to navigate
 * across five different pages to understand a case", so everything is here:
 * who, what listing, the conversation, the evidence, the timeline and every
 * action. The backend loads it in one call for the same reason.
 */

const STATUS_OPTIONS = Object.entries(STATUS_LABEL).map(([value, label]) => ({ value, label }))
const PRIORITY_OPTIONS = Object.entries(PRIORITY_LABEL).map(([value, label]) => ({ value, label }))

// What a reply can be addressed to. INTERNAL is offered LAST and named plainly,
// because the dangerous mistake is choosing it by accident and writing
// something about a user into what you thought was a note — or the reverse.
const REPLY_TARGETS = [
  { value: 'TENANT_ONLY', label: VISIBILITY_LABEL.TENANT_ONLY },
  { value: 'OWNER_ONLY', label: VISIBILITY_LABEL.OWNER_ONLY },
  { value: 'PUBLIC', label: VISIBILITY_LABEL.PUBLIC },
  { value: 'INTERNAL', label: VISIBILITY_LABEL.INTERNAL },
]

function Field({ label, children }) {
  if (children == null || children === '') return null
  return (
    <div>
      <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">{label}</p>
      <p className="text-sm text-slate-800 mt-0.5">{children}</p>
    </div>
  )
}

function Message({ m }) {
  const internal = m.visibility === 'INTERNAL'
  const who = m.authorAdmin?.name ?? m.authorUser?.name ?? AUTHOR_LABEL[m.authorRole] ?? m.authorRole

  return (
    <li className={`rounded-xl border p-3 ${MESSAGE_TONE[m.visibility] ?? MESSAGE_TONE.PUBLIC}`}>
      <div className="flex items-center gap-2 flex-wrap mb-1">
        <span className="text-[11px] font-semibold text-slate-700">{who}</span>
        <span className="text-[11px] text-slate-500">
          {new Date(m.createdAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
        </span>
        {/* The label is stated on EVERY message, not only internal ones. "Who
            can read this" is the question a moderator needs answered before
            they reply, and inferring it from a tint is how the wrong thing
            gets sent to the wrong person. */}
        <span className={`ml-auto inline-flex items-center gap-1 text-[11px] font-semibold ${internal ? 'text-amber-800' : 'text-slate-500'}`}>
          {internal && <Lock size={11} strokeWidth={2.4} aria-hidden />}
          {VISIBILITY_LABEL[m.visibility] ?? m.visibility}
        </span>
      </div>
      <p className="text-sm text-slate-800 whitespace-pre-wrap leading-relaxed">{m.body}</p>
      {m.attachments?.length > 0 && (
        <ul className="mt-2 flex flex-wrap gap-2">
          {m.attachments.map((a) => (
            <li key={a.id}>
              <a
                href={a.url} target="_blank" rel="noopener noreferrer"
                className="text-xs font-medium text-brand-700 underline"
              >
                {a.fileName ?? 'Attachment'}
              </a>
            </li>
          ))}
        </ul>
      )}
    </li>
  )
}

export default function SupportCaseDetail({ caseId, onBack }) {
  const qc = useQueryClient()
  const [, setSearchParams] = useSearchParams()
  const [draft, setDraft] = useState('')
  const [target, setTarget] = useState('TENANT_ONLY')

  const { data: c, isLoading, isError, refetch } = useQuery({
    queryKey: ['admin-support-case', caseId],
    queryFn: () => adminService.supportCase(caseId).then((r) => r.data),
  })

  // Every mutation refreshes the case AND the queue counters — a case moving to
  // RESOLVED changes both, and a stale tile is how somebody works a case twice.
  const after = () => {
    qc.invalidateQueries({ queryKey: ['admin-support-case', caseId] })
    qc.invalidateQueries({ queryKey: ['admin-support-cases'] })
    qc.invalidateQueries({ queryKey: ['admin-support-counts'] })
  }
  const onError = (what) => (err) => toast.error(`Couldn’t ${what}`, err.message ?? 'Please try again')

  const reply = useMutation({
    mutationFn: () => adminService.supportReply(caseId, draft.trim(), target),
    onSuccess: () => { setDraft(''); after() },
    onError: onError('send that'),
  })
  const setStatus = useMutation({
    mutationFn: (status) => adminService.supportSetStatus(caseId, status),
    onSuccess: after,
    onError: onError('change the status'),
  })
  const setPriority = useMutation({
    mutationFn: (priority) => adminService.supportSetPriority(caseId, priority),
    onSuccess: after,
    onError: onError('change the priority'),
  })
  const escalate = useMutation({
    mutationFn: (reason) => adminService.supportEscalate(caseId, reason),
    onSuccess: after,
    onError: onError('escalate this'),
  })

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-9 w-24 bg-slate-100 rounded-xl animate-pulse" />
        <div className="h-40 bg-slate-100 rounded-2xl animate-pulse" />
        <div className="h-64 bg-slate-100 rounded-2xl animate-pulse" />
      </div>
    )
  }

  if (isError || !c) {
    return (
      <div className="text-center py-16 bg-white border border-slate-100 rounded-2xl">
        <p className="text-sm font-semibold text-slate-700">Couldn&apos;t load this case</p>
        <p className="text-sm text-slate-500 mt-1">It may have been deleted, or the link may be wrong.</p>
        <div className="flex items-center justify-center gap-2 mt-4">
          <button onClick={() => refetch()} className="min-h-[44px] px-5 py-3 rounded-xl bg-[#111111] text-white text-sm font-semibold">
            Try again
          </button>
          <button onClick={onBack} className="min-h-[44px] px-5 py-3 rounded-xl border border-slate-200 text-sm font-semibold text-slate-700">
            Back to the queue
          </button>
        </div>
      </div>
    )
  }

  const closed = c.status === 'CLOSED'

  return (
    <div className="space-y-5">
      <button
        onClick={onBack}
        className="min-h-[44px] inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-100 transition-colors"
      >
        <ArrowLeft size={16} /> Back to the queue
      </button>

      {/* ── Case information + actions ── */}
      <div className="bg-white border border-slate-100 rounded-2xl p-5 space-y-4">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono text-xs font-semibold text-slate-500">{caseRef(c.number)}</span>
              <span className={`px-2 py-0.5 rounded-md text-[11px] font-semibold ${STATUS_PILL[c.status]}`}>{STATUS_LABEL[c.status]}</span>
              {PRIORITY_PILL[c.priority] && (
                <span className={`px-2 py-0.5 rounded-md text-[11px] font-semibold ${PRIORITY_PILL[c.priority]}`}>{PRIORITY_LABEL[c.priority]}</span>
              )}
              <span className="text-xs text-slate-500">{TYPE_LABEL[c.type] ?? c.type}</span>
            </div>
            <h1 className="text-lg font-bold text-slate-900 mt-1.5">{c.subject}</h1>
          </div>

          {!closed && (
            <div className="flex items-center gap-2 shrink-0 flex-wrap">
              <div className="w-44">
                <Select
                  value={c.status}
                  onChange={(v) => setStatus.mutate(v)}
                  options={STATUS_OPTIONS}
                  label="Status"
                />
              </div>
              <div className="w-36">
                <Select
                  value={c.priority}
                  onChange={(v) => setPriority.mutate(v)}
                  options={PRIORITY_OPTIONS}
                  label="Priority"
                />
              </div>
            </div>
          )}
        </div>

        <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{c.description}</p>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4 border-t border-slate-100">
          <Field label="Requester">
            {/* Staff DO see who opened it — that is the difference between the
                admin panel and every other surface, and it is why the owner
                never gets this page. */}
            {c.createdBy?.name ?? c.createdBy?.email ?? 'Anonymous'}
          </Field>
          <Field label="Opened">{new Date(c.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</Field>
          <Field label="Assigned">{c.assignedTo?.name ?? 'Nobody'}</Field>
          <Field label="First reply">
            {c.firstResponseAt
              ? `${Math.round((new Date(c.firstResponseAt) - new Date(c.createdAt)) / 60000)} min`
              : '—'}
          </Field>
          <Field label="Listing">{c.relatedProperty ? `${c.relatedProperty.title} · ${c.relatedProperty.city}` : null}</Field>
          <Field label="Report">{c.report ? `${String(c.report.category).replace(/_/g, ' ').toLowerCase()} · ${c.report.severity}` : null}</Field>
        </div>

        {!closed && c.status !== 'ESCALATED' && (
          <div className="pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={() => {
                // Prompted rather than a bare button: an escalation REQUIRES a
                // reason server-side, because one without it is a status
                // change wearing a louder name.
                const reason = window.prompt('What does the next person need to know?')
                if (reason?.trim()) escalate.mutate(reason.trim())
              }}
              className="min-h-[44px] px-4 py-3 rounded-xl text-sm font-semibold text-orange-800 bg-orange-50 hover:bg-orange-100 border border-orange-200 transition-colors"
            >
              Escalate
            </button>
          </div>
        )}
      </div>

      {/* ── Conversation ── */}
      <div className="bg-white border border-slate-100 rounded-2xl p-5">
        <h2 className="text-sm font-bold text-slate-900 mb-3">Conversation</h2>

        {c.messages?.length > 0 ? (
          <ul className="space-y-2">{c.messages.map((m) => <Message key={m.id} m={m} />)}</ul>
        ) : (
          <p className="text-sm text-slate-500 py-2">Nothing said yet.</p>
        )}

        {closed ? (
          <p className="text-sm text-slate-500 mt-4 pt-4 border-t border-slate-100">
            This case is closed. Closed cases cannot take new messages.
          </p>
        ) : (
          <div className="mt-4 pt-4 border-t border-slate-100">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-56">
                <Select value={target} onChange={setTarget} options={REPLY_TARGETS} label="Who can read this" />
              </div>
            </div>
            <textarea
              value={draft}
              onChange={(e) => e.target.value.length <= 4000 && setDraft(e.target.value)}
              rows={3}
              placeholder={target === 'INTERNAL'
                ? 'A note for the team. The requester and the owner never see this.'
                : 'Your reply…'}
              className={`w-full px-3.5 py-3 rounded-xl border text-sm text-slate-800 placeholder-slate-500 outline-none focus:ring-2 focus:ring-black/8 transition resize-none leading-relaxed ${
                // The compose box itself changes colour for an internal note.
                // The dangerous mistake is typing a note into what you thought
                // was a reply, so the surface you are typing on says which.
                target === 'INTERNAL'
                  ? 'border-amber-300 bg-amber-50 focus:border-amber-500'
                  : 'border-slate-200 bg-slate-50 focus:border-[#111111] focus:bg-white'
              }`}
            />
            <div className="flex items-center justify-between gap-3 mt-2">
              <p className="text-xs text-slate-500">
                {target === 'INTERNAL'
                  ? 'Internal — never leaves the admin panel.'
                  : `Goes to: ${VISIBILITY_LABEL[target]}`}
              </p>
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
                {reply.isPending ? 'Sending…' : target === 'INTERNAL' ? 'Add note' : 'Send'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Activity ── */}
      <div className="bg-white border border-slate-100 rounded-2xl p-5">
        <h2 className="text-sm font-bold text-slate-900 mb-1">Activity</h2>
        <p className="text-xs text-slate-500 mb-3">Every action on this case, oldest first. Nobody can edit this.</p>
        {c.events?.length > 0 ? (
          <ol className="space-y-2">
            {c.events.map((e) => (
              <li key={e.id} className="flex items-baseline gap-3 text-xs">
                <span className="text-slate-500 shrink-0 w-32">
                  {new Date(e.createdAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                </span>
                <span className="text-slate-800">{describeEvent(e)}</span>
                <span className="text-slate-500">
                  {e.actorAdmin?.name ?? e.actorUser?.name ?? AUTHOR_LABEL[e.actorRole] ?? ''}
                </span>
              </li>
            ))}
          </ol>
        ) : (
          <p className="text-sm text-slate-500">No activity recorded.</p>
        )}
      </div>

      {c.relatedProperty && (
        <button
          onClick={() => setSearchParams({ tab: 'review-listings', propertyId: c.relatedProperty.id })}
          className="min-h-[44px] w-full sm:w-auto px-4 py-3 rounded-xl border border-slate-200 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
        >
          Open the listing
        </button>
      )}
    </div>
  )
}
