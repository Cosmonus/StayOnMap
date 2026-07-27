import { Search, MessageCircle } from 'lucide-react'
import ConversationRow from './ConversationRow'
import { displayName, propertyLine } from './chatFormat'

function SearchBar({ value, onChange }) {
  return (
    <div className="relative">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" strokeWidth={2} />
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder="Search messages"
        className="w-full pl-9 pr-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/20 focus:border-brand-400 placeholder:text-slate-500"
      />
    </div>
  )
}

// The left pane: title, search, rows. The EMPTY state is passed in rather than
// branched on here — "no conversations yet" and "no messages from renters yet"
// are different situations with different next steps, and each surface owns
// its own words (TenantMessages / OwnerInbox).
export default function ThreadList({
  title, headerAction, conversations, activeId, onSelect, userId, otherPartyOf, onlineUsers, search, onSearchChange, empty,
}) {
  const filtered = search
    ? conversations.filter(c => {
        const q = search.toLowerCase()
        return displayName(otherPartyOf(c)).toLowerCase().includes(q) ||
               c.property?.title?.toLowerCase().includes(q) ||
               propertyLine(c.property).toLowerCase().includes(q)
      })
    : conversations

  return (
    <>
      <div className="shrink-0 px-5 pt-5 pb-3 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h1 className="text-xl font-bold text-slate-900">{title}</h1>
          {headerAction}
        </div>
        <SearchBar value={search} onChange={onSearchChange} />
      </div>

      {!conversations.length ? (
        <div className="flex flex-col items-center justify-center flex-1 px-8 text-center">
          <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mb-4">
            <MessageCircle className="w-7 h-7 text-slate-500" strokeWidth={1.5} />
          </div>
          <p className="text-sm font-semibold text-slate-600">{empty.title}</p>
          <p className="text-xs text-slate-500 mt-1 leading-relaxed">{empty.body}</p>
          {empty.action}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center flex-1 px-8 text-center">
          <p className="text-sm text-slate-500">No results for &ldquo;{search}&rdquo;</p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto">
          {filtered.map(c => (
            <ConversationRow
              key={c.id}
              conversation={c}
              other={otherPartyOf(c)}
              isActive={c.id === activeId}
              isOnline={onlineUsers.has(otherPartyOf(c)?.id)}
              userId={userId}
              onSelect={onSelect}
            />
          ))}
        </div>
      )}
    </>
  )
}
