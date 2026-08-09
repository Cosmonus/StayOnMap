import { useState } from 'react'
import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { adminService } from '@services/admin.service'

// The moderation audit trail — who did what, to which listing, when.
//
// `ActivityLog` has been written on every block, moderation decision and status
// change since the admin panel shipped, `GET /admin/logs` has served it the
// whole time, and nothing ever rendered it (found 2026-08-10). So the one
// record of an admin's own actions was invisible to the admins.
//
// Read-only, and permanently so. An audit trail an operator can edit is not one.

const ACTION_TONE = [
  [/BLOCK|SUSPEND|REJECT|DELETE/i, 'bg-red-50 text-red-700'],
  [/APPROV|VERIF|ACTIVE|UNBLOCK/i, 'bg-brand-50 text-brand-700'],
]

function tone(action) {
  return ACTION_TONE.find(([re]) => re.test(action))?.[1] ?? 'bg-slate-100 text-slate-700'
}

function actorOf(log) {
  // Every writer today sets adminId; userId is nullable and reserved for
  // actions a user takes on themselves. Whichever is present is the actor —
  // and "System" is the honest answer when neither is, rather than a blank.
  const who = log.admin ?? log.user
  if (!who) return { name: 'System', detail: null }
  return { name: who.name ?? who.email, detail: log.admin ? 'admin' : 'user' }
}

export default function ActivityLogSection() {
  const [page, setPage] = useState(1)
  const [action, setAction] = useState('')

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['admin-logs', page, action],
    queryFn: () => adminService.logs({ page, limit: 50, action: action || undefined }).then((r) => r.data),
    placeholderData: keepPreviousData,
  })

  const logs = data?.logs ?? []
  const total = data?.total ?? 0
  const pages = Math.max(1, Math.ceil(total / 50))

  return (
    <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between px-5 py-4 border-b border-slate-100">
        <div>
          <h2 className="text-sm font-bold text-slate-900">Activity log</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Every moderation action, oldest kept indefinitely. Read-only.
          </p>
        </div>
        <input
          value={action}
          onChange={(e) => { setAction(e.target.value); setPage(1) }}
          placeholder="Filter by action…"
          aria-label="Filter by action"
          className="min-h-[44px] px-4 py-3 rounded-xl border border-slate-200 text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-brand-500 sm:w-64"
        />
      </div>

      {isLoading ? (
        <div className="p-5 flex flex-col gap-3">
          {[0, 1, 2, 3, 4].map((i) => <div key={i} className="h-12 bg-slate-100 rounded-xl animate-pulse" />)}
        </div>
      ) : isError ? (
        <div className="p-5">
          <p className="text-sm text-slate-600">Could not load the activity log.</p>
          <button
            onClick={() => refetch()}
            className="mt-3 min-h-[44px] px-4 py-3 rounded-xl border border-slate-200 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Try again
          </button>
        </div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px]">
              <thead>
                <tr className="text-left text-xs text-slate-500 border-b border-slate-100">
                  <th className="px-5 py-3 font-medium">Action</th>
                  <th className="px-5 py-3 font-medium">Who</th>
                  <th className="px-5 py-3 font-medium">Target</th>
                  <th className="px-5 py-3 font-medium">When</th>
                </tr>
              </thead>
              <tbody>
                {logs.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-5 py-12 text-center text-sm text-slate-500">
                      {action ? 'No actions match that filter.' : 'No admin actions recorded yet.'}
                    </td>
                  </tr>
                ) : logs.map((log) => {
                  const actor = actorOf(log)
                  return (
                    <tr key={log.id} className="border-b border-slate-50 last:border-0">
                      <td className="px-5 py-3">
                        <span className={`inline-block px-2 py-1 rounded-lg text-badge font-semibold ${tone(log.action)}`}>
                          {log.action}
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        <span className="text-sm text-slate-800">{actor.name}</span>
                        {actor.detail && <span className="text-xs text-slate-500 ml-1.5">{actor.detail}</span>}
                      </td>
                      <td className="px-5 py-3 text-sm text-slate-600">
                        {log.entity ? `${log.entity} ${log.entityId?.slice(-6) ?? ''}` : '—'}
                      </td>
                      <td className="px-5 py-3 text-sm text-slate-500 whitespace-nowrap">
                        {new Date(log.createdAt).toLocaleString('en-IN')}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {pages > 1 && (
            <div className="flex items-center justify-between gap-3 px-5 py-4 border-t border-slate-100">
              <span className="text-xs text-slate-500">Page {page} of {pages} &middot; {total} actions</span>
              <div className="flex gap-2 shrink-0">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="min-h-[44px] px-4 py-3 rounded-xl border border-slate-200 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Previous
                </button>
                <button
                  onClick={() => setPage((p) => Math.min(pages, p + 1))}
                  disabled={page >= pages}
                  className="min-h-[44px] px-4 py-3 rounded-xl border border-slate-200 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
