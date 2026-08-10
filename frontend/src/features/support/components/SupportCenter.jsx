import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { LifeBuoy, Plus, Search } from 'lucide-react'
import { useUiStore } from '@store/uiStore'
import { supportService } from '@services/support.service'
import NewCaseModal from './NewCaseModal'
import SupportCaseView from './SupportCaseView'
import { STATUS_COPY, CATEGORY_LABEL, caseRef } from './supportCopy'

/**
 * Help & Support, for whichever hat you are wearing.
 *
 * ONE component for tenant and owner, unlike chat — and the difference is worth
 * stating, because the chat split was deliberate. There, the two surfaces
 * genuinely diverged: reply time is meaningless to an owner reading their own
 * speed, and only a renter can start a thread. Here both hats do exactly the
 * same three things — read the help, open a request, continue a conversation —
 * and the only difference is WHICH cases the list contains, which the backend
 * already decides from `hat`. Two files would be one file copied twice.
 *
 * Follows `uiStore.hostMode` like Appointments, Chat and Notifications, so a
 * host sees requests about their listings and a renter sees their own.
 */
export default function SupportCenter() {
  const hostMode = useUiStore((s) => s.hostMode)
  const hat = hostMode ? 'OWNER' : 'TENANT'

  const [openId, setOpenId] = useState(null)
  const [composing, setComposing] = useState(false)
  const [query, setQuery] = useState('')

  const { data: cases, isLoading, isError, refetch } = useQuery({
    queryKey: ['support-cases', hat],
    queryFn: () => supportService.listCases(hat).then((r) => r.data),
  })

  const { data: help } = useQuery({
    queryKey: ['support-articles', hat, query],
    queryFn: () => supportService.articles({ hat, search: query || undefined }).then((r) => r.data),
  })

  if (openId) return <SupportCaseView caseId={openId} onBack={() => setOpenId(null)} />

  const list = cases ?? []
  const articles = help?.articles ?? []

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Help &amp; support</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {hostMode
              ? 'Questions about your listings, and anything raised about them.'
              : 'A real person reads every message. Usually the same day.'}
          </p>
        </div>
        <button
          onClick={() => setComposing(true)}
          className="min-h-[44px] inline-flex items-center gap-2 px-4 py-3 rounded-xl bg-[#111111] hover:bg-[#2a2a2a] text-white text-sm font-semibold transition-colors"
        >
          <Plus size={15} strokeWidth={2.5} />
          New request
        </button>
      </div>

      {/* ── Help first ──
          Deliberately above the request list and above the button's natural
          reading order: the cheapest support request is the one somebody did
          not need to send. Search is over titles and bodies, so typing
          "deposit" finds the lease article even though the word is not in its
          title. */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5">
        <div className="relative mb-4">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" aria-hidden />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search help — deposits, visits, reporting a listing…"
            aria-label="Search help articles"
            className="min-h-[44px] w-full pl-9 pr-3 py-3 rounded-xl border border-slate-200 bg-slate-50 text-sm text-slate-800 placeholder-slate-500 outline-none focus:border-[#111111] focus:bg-white focus:ring-2 focus:ring-black/8 transition"
          />
        </div>

        {articles.length > 0 ? (
          <ul className="divide-y divide-slate-100">
            {articles.slice(0, 6).map((a) => (
              <li key={a.id}>
                <details className="group py-3">
                  <summary className="cursor-pointer list-none flex items-center justify-between gap-3">
                    <span className="text-sm font-medium text-slate-800">{a.title}</span>
                    <span className="text-xs text-slate-500 shrink-0">{a.category?.title}</span>
                  </summary>
                  {/* whitespace-pre-wrap, not a markdown renderer: the bodies
                      are plain text with light formatting, and a parser would
                      be a dependency plus an XSS surface for content that has
                      neither links nor images. */}
                  <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-wrap mt-2">{a.body}</p>
                </details>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-slate-500 py-2">
            {query ? 'Nothing in the help centre matches that. Open a request and ask us.' : 'Help articles will appear here.'}
          </p>
        )}
      </div>

      {/* ── Your requests ── */}
      <div>
        <h2 className="text-sm font-bold text-slate-900 mb-3">
          {hostMode ? 'Requests and reports' : 'Your requests'}
        </h2>

        {isError ? (
          <div className="text-center py-10 bg-white border border-slate-100 rounded-2xl">
            <p className="text-sm text-slate-600">Couldn&apos;t load your requests.</p>
            <button onClick={() => refetch()} className="mt-3 min-h-[44px] px-5 py-3 rounded-xl bg-[#111111] text-white text-sm font-semibold">
              Try again
            </button>
          </div>
        ) : isLoading ? (
          <div className="space-y-3">
            {[1, 2].map((i) => <div key={i} className="h-20 bg-slate-100 rounded-2xl animate-pulse" />)}
          </div>
        ) : list.length === 0 ? (
          <div className="text-center py-12 bg-white border border-slate-100 rounded-2xl">
            <div className="w-12 h-12 rounded-2xl bg-brand-50 text-brand-700 flex items-center justify-center mx-auto mb-3">
              <LifeBuoy size={22} strokeWidth={1.8} />
            </div>
            <p className="text-sm font-semibold text-slate-700">Nothing open</p>
            <p className="text-sm text-slate-500 mt-1 max-w-xs mx-auto">
              {hostMode
                ? 'Requests you send us, and anything raised about your listings, appear here.'
                : 'If something is wrong or you are not sure about a listing, tell us and we will look.'}
            </p>
          </div>
        ) : (
          <ul className="space-y-3">
            {list.map((c) => {
              const unread = c._count?.messages ?? 0
              const copy = STATUS_COPY[c.status] ?? { label: c.status, tone: 'text-slate-600' }
              return (
                <li key={c.id}>
                  <button
                    onClick={() => setOpenId(c.id)}
                    className="w-full text-left bg-white border border-slate-100 rounded-2xl p-4 hover:border-slate-300 hover:bg-slate-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono text-[11px] font-semibold text-slate-500">{caseRef(c.number)}</span>
                          <span className="text-xs text-slate-500">{CATEGORY_LABEL[c.type] ?? c.type}</span>
                          {unread > 0 && (
                            <span className="px-2 py-0.5 rounded-full bg-brand-50 text-brand-700 text-[11px] font-semibold">
                              New reply
                            </span>
                          )}
                        </div>
                        <p className="text-sm font-medium text-slate-800 mt-1 truncate">{c.subject}</p>
                        {/* The status in the user's words, not ours. "Waiting
                            on requester" is our queue's vocabulary; the person
                            waiting needs to read "we need something from you". */}
                        <p className={`text-xs mt-0.5 ${copy.tone}`}>{copy.label}</p>
                      </div>
                      <span className="text-xs text-slate-500 shrink-0">
                        {new Date(c.updatedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                      </span>
                    </div>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      {composing && (
        <NewCaseModal
          hat={hat}
          onClose={() => setComposing(false)}
          onCreated={(id) => { setComposing(false); setOpenId(id) }}
        />
      )}
    </div>
  )
}
