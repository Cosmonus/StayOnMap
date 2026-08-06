import { useState, useEffect, useMemo } from 'react'
import { ChevronLeft } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@features/auth/hooks/useAuth'
import { chatService } from '@services/chat.service'
import { getSocket, connectSocket } from '@lib/socket'
import ThreadList from './ThreadList'
import MessageThread from './MessageThread'

// The two-pane layout and the plumbing both hats share: one conversations
// query, presence, auto-select, and the mobile list↔thread swap.
//
// It does NOT decide which threads you see or what anything is called — the
// caller does, because that is precisely what makes a tenant's Messages and an
// owner's Inbox two different screens rather than one screen with a flag.
// `side` is 'tenant' | 'owner' and is the only place the partition lives.
export default function ChatSurface({
  side, title, headerAction, empty, counterpartRole, showReplyTime = false, emptyPrompt,
}) {
  const { user } = useAuth()
  const [activeConvo, setActiveConvo] = useState(null)
  const [search, setSearch] = useState('')
  const [onlineUsers, setOnlineUsers] = useState(new Set())

  useEffect(() => {
    if (!user?.id) return
    connectSocket()
    const socket = getSocket()
    if (!socket) return
    function onOnline({ userId }) { setOnlineUsers(prev => new Set([...prev, userId])) }
    function onOffline({ userId }) { setOnlineUsers(prev => { const next = new Set(prev); next.delete(userId); return next }) }
    socket.on('user:online', onOnline)
    socket.on('user:offline', onOffline)
    return () => { socket.off('user:online', onOnline); socket.off('user:offline', onOffline) }
  }, [user?.id])

  // One query for both surfaces, one cache entry: GET /chat returns every
  // thread you are in either way round, and only one of these two components
  // is ever mounted at a time.
  // No interval: useRealtimeUpdates invalidates this key on every
  // `message:notification` and on socket reconnect.
  const { data: conversations = [], isLoading } = useQuery({
    queryKey: ['conversations'],
    queryFn: () => chatService.conversations().then(r => r.data),
  })

  const mine = useMemo(
    () => conversations.filter(c => (side === 'owner' ? c.ownerId === user?.id : c.tenantId === user?.id)),
    [conversations, side, user?.id],
  )

  // Auto-select the first thread; reset if the active one is no longer in this
  // surface's list (switching hats unmounts this component, but a thread can
  // also disappear from under you when a listing is deleted).
  useEffect(() => {
    if (mine.length === 0) {
      if (activeConvo) setActiveConvo(null)
      return
    }
    if (!activeConvo || !mine.some(c => c.id === activeConvo)) {
      setActiveConvo(mine[0].id)
    }
  }, [mine, activeConvo])

  const activeConversation = mine.find(c => c.id === activeConvo) ?? null
  const otherPartyOf = (c) => (side === 'owner' ? c.tenant : c.owner)

  if (isLoading) {
    return (
      <div className="flex h-full bg-white">
        <div className="w-full md:w-[340px] border-r border-slate-100 p-5 space-y-3">
          <div className="h-8 w-32 bg-slate-100 rounded-lg animate-pulse" />
          <div className="h-10 bg-slate-100 rounded-xl animate-pulse" />
          {[1, 2, 3, 4].map(i => <div key={i} className="h-16 bg-slate-100 rounded-xl animate-pulse" />)}
        </div>
        <div className="flex-1 bg-slate-50/50" />
      </div>
    )
  }

  return (
    <div className="flex h-full bg-white overflow-hidden">
      {/* Left panel — full width on mobile when no thread is open.
          `min-h-0` on every flex column that contains a scroller: a flex item
          defaults to min-height:auto, so `flex-1 overflow-y-auto` grows to fit
          its content instead of scrolling, and the ancestors' overflow-hidden
          then CLIPS whatever follows — which is how the input bar and the
          thread header disappeared on a long conversation. */}
      <div className={`shrink-0 min-h-0 border-r border-slate-100 flex flex-col w-full md:w-[340px] ${activeConvo ? 'hidden md:flex' : 'flex'}`}>
        <ThreadList
          title={title}
          headerAction={headerAction}
          conversations={mine}
          activeId={activeConvo}
          onSelect={setActiveConvo}
          userId={user?.id}
          otherPartyOf={otherPartyOf}
          onlineUsers={onlineUsers}
          search={search}
          onSearchChange={setSearch}
          empty={empty}
        />
      </div>

      {/* Right panel — full width on mobile when a thread is open */}
      <div className={`flex-1 min-w-0 min-h-0 ${activeConvo ? 'flex' : 'hidden md:flex'} flex-col`}>
        {activeConvo && (
          <button
            onClick={() => setActiveConvo(null)}
            className="md:hidden shrink-0 flex items-center gap-2 px-4 py-3 border-b border-slate-100 text-sm font-medium text-slate-600 hover:bg-slate-50"
          >
            <ChevronLeft className="w-4 h-4" strokeWidth={2.5} />
            Back to {title.toLowerCase()}
          </button>
        )}
        <MessageThread
          conversation={activeConversation}
          conversationId={activeConvo}
          userId={user?.id}
          counterpartRole={counterpartRole}
          replyMinutes={showReplyTime ? activeConversation?.ownerReplyMinutes : null}
          emptyPrompt={emptyPrompt}
        />
      </div>
    </div>
  )
}
