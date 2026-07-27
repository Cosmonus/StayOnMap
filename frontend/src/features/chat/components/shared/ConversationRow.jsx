import Avatar from './Avatar'
import { displayName, propertyLine, timeLabel } from './chatFormat'

// One row in the thread list. Identical for both hats — `other` is already
// resolved by the caller, which is the only thing that differs (the tenant
// surface shows owners, the owner surface shows renters).
//
// No role chip here: in a list of threads, WHICH listing this is about
// identifies it — "Owner"/"Tenant" would be the same word on every row and told
// you nothing. The role stays in the thread header, where there's one of it.
export default function ConversationRow({ conversation, other, isActive, isOnline, userId, onSelect }) {
  const lastMsg = conversation.messages?.[0]
  const unread = conversation._count?.messages ?? 0

  return (
    <button
      onClick={() => onSelect(conversation.id)}
      className={`w-full text-left px-5 py-4 flex items-center gap-3.5 transition-colors border-l-3 ${
        isActive ? 'bg-brand-50/60 border-l-brand-500' : 'border-l-transparent hover:bg-slate-50'
      }`}
    >
      <div className="relative">
        <Avatar name={displayName(other)} url={other?.avatarUrl} size={44} />
        {isOnline && (
          <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-400 border-2 border-white rounded-full" />
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <p className={`text-sm truncate ${isActive || unread > 0 ? 'font-bold text-slate-900' : 'font-semibold text-slate-800'}`}>
            {displayName(other)}
          </p>
          <span className="text-xs text-slate-500 shrink-0">
            {lastMsg ? timeLabel(lastMsg.createdAt) : ''}
          </span>
        </div>
        <p className="text-xs font-semibold text-brand-700 truncate mt-0.5">{propertyLine(conversation.property)}</p>
        {lastMsg && (
          <p className={`text-xs truncate mt-0.5 ${unread > 0 ? 'text-slate-800 font-medium' : 'text-slate-600'}`}>
            {lastMsg.senderId === userId ? 'You: ' : ''}
            {lastMsg.body || (lastMsg.attachmentMime === 'application/pdf' ? 'Sent a document' : 'Sent a photo')}
          </p>
        )}
      </div>

      {unread > 0 && (
        <span className="min-w-[20px] h-5 px-1.5 flex items-center justify-center text-[11px] font-bold text-white bg-red-500 rounded-full shrink-0">
          {unread > 9 ? '9+' : unread}
        </span>
      )}
    </button>
  )
}
