import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@features/auth/hooks/useAuth'
import { chatService } from '@services/chat.service'
import { getSocket, connectSocket } from '@lib/socket'
import { toast } from '@components/common/Toaster'
import { formatRent } from '@utils/format'

// ── Helpers ─────────────────────────────────────────────────────────────────
function timeLabel(date) {
  const d = new Date(date)
  const now = new Date()
  const diff = Math.floor((now - d) / 1000)
  if (diff < 60)   return 'now'
  if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
  if (diff < 604800) {
    const days = Math.floor(diff / 86400)
    return days === 1 ? 'Yesterday' : `${days}d ago`
  }
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
}

function chatTime(date) {
  return new Date(date).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
}

function dateSeparator(date) {
  const d = new Date(date)
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)
  if (d.toDateString() === today.toDateString()) return 'Today'
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday'
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

// ── Helpers ─────────────────────────────────────────────────────────────────
function displayName(user) {
  return user?.name || user?.email?.split('@')[0] || 'Unknown'
}

// ── Read receipt ticks ──────────────────────────────────────────────────────
function ReadReceipt({ isRead }) {
  return (
    <svg className={`w-3.5 h-3.5 shrink-0 ${isRead ? 'text-white' : 'text-white/50'}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      {isRead ? (
        <>
          <path d="M2 13l4 4L14 7" />
          <path d="M9 13l4 4L21 7" />
        </>
      ) : (
        <path d="M5 13l4 4L17 7" />
      )}
    </svg>
  )
}

// ── Avatar ──────────────────────────────────────────────────────────────────
function Avatar({ name, url, size = 40, className = '' }) {
  const initial = name?.[0]?.toUpperCase() ?? '?'
  return url ? (
    <img src={url} alt={name} className={`rounded-full object-cover shrink-0 ${className}`} style={{ width: size, height: size }} />
  ) : (
    <div className={`rounded-full bg-brand-100 flex items-center justify-center font-bold text-brand-600 shrink-0 ${className}`} style={{ width: size, height: size, fontSize: size * 0.4 }}>
      {initial}
    </div>
  )
}

// ── Search bar ──────────────────────────────────────────────────────────────
function SearchBar({ value, onChange }) {
  return (
    <div className="relative">
      <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
        <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
      </svg>
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder="Search conversations..."
        className="w-full pl-9 pr-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-400 placeholder:text-slate-400"
      />
    </div>
  )
}

// ── Left panel: conversation list ───────────────────────────────────────────
function ConversationList({ conversations, activeId, onSelect, userId, search, onlineUsers }) {
  const filtered = search
    ? conversations.filter(c => {
        const other = c.tenantId === userId ? c.owner : c.tenant
        return displayName(other).toLowerCase().includes(search.toLowerCase()) ||
               c.property?.title?.toLowerCase().includes(search.toLowerCase())
      })
    : conversations

  if (!conversations.length) {
    return (
      <div className="flex flex-col items-center justify-center flex-1 px-8 text-center">
        <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mb-4">
          <svg className="w-7 h-7 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
        </div>
        <p className="text-sm font-semibold text-slate-600">No conversations yet</p>
        <p className="text-xs text-slate-400 mt-1 leading-relaxed">Start a chat by visiting a property and clicking &ldquo;Chat with owner&rdquo;</p>
      </div>
    )
  }

  if (filtered.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center flex-1 px-8 text-center">
        <p className="text-sm text-slate-400">No results for &ldquo;{search}&rdquo;</p>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto">
      {filtered.map(c => {
        const other = c.tenantId === userId ? c.owner : c.tenant
        const otherRole = c.tenantId === userId ? 'Owner' : 'Tenant'
        const lastMsg = c.messages?.[0]
        const isActive = c.id === activeId
        const unread = c._count?.messages ?? 0
        const propertyImg = c.property?.images?.[0]?.url
        const isOnline = onlineUsers.has(other?.id)

        return (
          <button
            key={c.id}
            onClick={() => onSelect(c.id)}
            className={`w-full text-left px-5 py-4 flex items-center gap-3.5 transition-colors border-l-3 ${
              isActive
                ? 'bg-brand-50/60 border-l-brand-500'
                : 'border-l-transparent hover:bg-slate-50'
            }`}
          >
            <div className="relative">
              <Avatar name={displayName(other)} url={other.avatarUrl ?? propertyImg} size={44} />
              {isOnline && (
                <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-400 border-2 border-white rounded-full" />
              )}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-0.5">
                <div className="flex items-center gap-1.5 min-w-0">
                  <p className={`text-sm truncate ${isActive || unread > 0 ? 'font-bold text-slate-900' : 'font-semibold text-slate-700'}`}>
                    {displayName(other)}
                  </p>
                  <span className={`text-[9px] font-bold px-1 py-0.5 rounded shrink-0 ${otherRole === 'Owner' ? 'bg-amber-50 text-amber-600' : 'bg-blue-50 text-blue-600'}`}>
                    {otherRole}
                  </span>
                </div>
                <span className="text-[11px] text-slate-400 shrink-0 ml-2">
                  {lastMsg ? timeLabel(lastMsg.createdAt) : ''}
                </span>
              </div>
              <p className="text-xs text-slate-400 truncate">{c.property?.title}</p>
              {lastMsg && (
                <p className={`text-xs truncate mt-0.5 ${unread > 0 ? 'text-slate-700 font-medium' : 'text-slate-500'}`}>
                  {lastMsg.senderId === userId ? 'You: ' : ''}{lastMsg.body}
                </p>
              )}
            </div>

            {unread > 0 && (
              <span className="min-w-[20px] h-5 px-1.5 flex items-center justify-center text-[10px] font-bold text-white bg-brand-500 rounded-full shrink-0">
                {unread > 9 ? '9+' : unread}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}

// ── Right panel: chat header ────────────────────────────────────────────────
function ChatHeader({ conversation, userId, typingUser, searchOpen, onToggleSearch }) {
  if (!conversation) return null

  const other = conversation.tenantId === userId ? conversation.owner : conversation.tenant
  const otherRole = conversation.tenantId === userId ? 'Owner' : 'Tenant'

  return (
    <div className="shrink-0 h-16 px-6 flex items-center justify-between border-b border-slate-100 bg-white">
      <div className="flex items-center gap-3">
        <Avatar name={displayName(other)} url={other.avatarUrl} size={38} />
        <div>
          <div className="flex items-center gap-2">
            <p className="text-sm font-bold text-slate-900">{displayName(other)}</p>
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${otherRole === 'Owner' ? 'bg-amber-50 text-amber-600' : 'bg-blue-50 text-blue-600'}`}>
              {otherRole}
            </span>
          </div>
          {typingUser ? (
            <p className="text-xs text-brand-500 font-medium animate-pulse">Typing...</p>
          ) : (
            <p className="text-xs text-slate-400">{conversation.property?.title}</p>
          )}
        </div>
      </div>

      <button
        onClick={onToggleSearch}
        className={`w-9 h-9 rounded-full flex items-center justify-center transition-colors ${searchOpen ? 'bg-brand-100 text-brand-600' : 'hover:bg-slate-100 text-slate-500'}`}
        title="Search messages"
      >
        <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
          <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
        </svg>
      </button>
    </div>
  )
}

// ── Property card shown at top of chat ─────────────────────────────────────
function ChatPropertyCard({ property }) {
  if (!property) return null

  const img = property.images?.[0]?.url
  const bhkLabel = property.bhk ? `${property.bhk} BHK` : null
  const typeLabel = property.type?.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())

  return (
    <Link
      to={`/property/${property.id}`}
      className="mx-6 mt-4 mb-2 flex items-center gap-3.5 p-3 bg-white rounded-xl border border-slate-100 shadow-xs hover:shadow-sm transition-shadow no-underline group"
    >
      {/* Thumbnail */}
      <div className="w-16 h-16 rounded-lg bg-slate-100 overflow-hidden shrink-0">
        {img ? (
          <img src={img} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <svg className="w-6 h-6 text-slate-300" viewBox="0 0 24 24" fill="currentColor"><path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/></svg>
          </div>
        )}
      </div>

      {/* Details */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-slate-800 truncate group-hover:text-brand-600 transition-colors">{property.title}</p>
        <div className="flex items-center gap-1.5 mt-0.5">
          {property.city && (
            <span className="text-xs text-slate-400 truncate">
              {property.address ? `${property.address}, ` : ''}{property.city}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 mt-1">
          {property.rent && (
            <span className="text-xs font-bold text-brand-600">{formatRent(Number(property.rent))}</span>
          )}
          {bhkLabel && (
            <span className="text-[10px] font-semibold text-slate-500 px-1.5 py-0.5 bg-slate-100 rounded">{bhkLabel}</span>
          )}
          {typeLabel && (
            <span className="text-[10px] font-semibold text-slate-500 px-1.5 py-0.5 bg-slate-100 rounded">{typeLabel}</span>
          )}
        </div>
      </div>

      {/* Arrow */}
      <svg className="w-4 h-4 text-slate-300 shrink-0 group-hover:text-brand-500 transition-colors" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 18l6-6-6-6" />
      </svg>
    </Link>
  )
}

// ── Right panel: message area ───────────────────────────────────────────────
function MessageArea({ messages, userId, conversation }) {
  const bottomRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Determine role for a given senderId
  function senderRole(senderId) {
    if (!conversation) return ''
    if (senderId === conversation.ownerId) return 'Owner'
    if (senderId === conversation.tenantId) return 'Tenant'
    return ''
  }

  // Group messages by date
  let lastDate = null

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50/50">
      {/* Property card at top */}
      <ChatPropertyCard property={conversation?.property} />

      <div className="px-6 py-5">
      {messages.map((msg, i) => {
        const isMe = msg.senderId === userId
        const msgDate = dateSeparator(msg.createdAt)
        const showDate = msgDate !== lastDate
        lastDate = msgDate
        const role = senderRole(msg.senderId)

        // Check if previous message is from same sender within 2 min
        const prev = messages[i - 1]
        const isGrouped = prev && prev.senderId === msg.senderId &&
          (new Date(msg.createdAt) - new Date(prev.createdAt)) < 120000

        return (
          <div key={msg.id}>
            {showDate && (
              <div className="flex items-center justify-center my-5">
                <span className="px-3 py-1 text-[11px] font-semibold text-slate-400 bg-white rounded-full border border-slate-100 shadow-xs">
                  {msgDate}
                </span>
              </div>
            )}

            <div className={`flex ${isMe ? 'justify-end' : 'justify-start'} ${isGrouped ? 'mt-1' : 'mt-4'}`}>
              {/* Sender avatar (left side only, only on first of group) */}
              {!isMe && !isGrouped && (
                <Avatar name={displayName(msg.sender)} url={msg.sender?.avatarUrl} size={32} className="mt-1 mr-2.5" />
              )}
              {!isMe && isGrouped && <div className="w-[32px] mr-2.5 shrink-0" />}

              <div className="max-w-[65%]">
                {/* Sender name + role + time header */}
                {!isGrouped && (
                  <div className={`flex items-center gap-2 mb-1 ${isMe ? 'justify-end' : ''}`}>
                    <span className="text-xs font-semibold text-slate-600">
                      {isMe ? 'You' : displayName(msg.sender)}
                    </span>
                    {role && (
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                        role === 'Owner' ? 'bg-amber-50 text-amber-600' : 'bg-blue-50 text-blue-600'
                      }`}>
                        {role}
                      </span>
                    )}
                  </div>
                )}

                {/* Bubble */}
                <div className={`px-4 py-2.5 text-sm leading-relaxed ${isMe
                  ? 'bg-brand-500 text-white rounded-2xl rounded-br-md'
                  : 'bg-white text-slate-800 rounded-2xl rounded-bl-md border border-slate-100 shadow-xs'
                }`}>
                  <span>{msg.body}</span>
                  <span className="inline-flex items-center gap-1 ml-2 align-bottom translate-y-0.5">
                    <span className={`text-[10px] ${isMe ? 'opacity-70' : 'text-slate-400'}`}>{chatTime(msg.createdAt)}</span>
                    {isMe && <ReadReceipt isRead={msg.isRead} />}
                  </span>
                </div>
              </div>

              {/* My avatar (right side, only on first of group) */}
              {isMe && !isGrouped && (
                <Avatar name={displayName(msg.sender)} url={msg.sender?.avatarUrl} size={32} className="mt-1 ml-2.5" />
              )}
              {isMe && isGrouped && <div className="w-[32px] ml-2.5 shrink-0" />}
            </div>
          </div>
        )
      })}

      <div ref={bottomRef} />
      </div>
    </div>
  )
}

// ── Right panel: input bar ──────────────────────────────────────────────────
function InputBar({ onSend, onTyping, isPending }) {
  const [input, setInput] = useState('')

  function handleSubmit(e) {
    e.preventDefault()
    const body = input.trim()
    if (!body || isPending) return
    onSend(body)
    setInput('')
  }

  function handleChange(e) {
    setInput(e.target.value)
    onTyping?.()
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit(e)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="shrink-0 border-t border-slate-100 bg-white px-5 py-3.5 flex items-end gap-3">
      {/* Attachment button */}
      <button type="button" className="w-9 h-9 rounded-full hover:bg-slate-100 flex items-center justify-center transition-colors text-slate-400 shrink-0 mb-0.5">
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
        </svg>
      </button>

      {/* Text input */}
      <div className="flex-1 relative">
        <textarea
          value={input}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder="Type a message..."
          rows={1}
          className="w-full px-4 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-400 resize-none placeholder:text-slate-400"
          style={{ minHeight: '42px', maxHeight: '120px' }}
        />
      </div>

      {/* Emoji */}
      <button type="button" className="w-9 h-9 rounded-full hover:bg-slate-100 flex items-center justify-center transition-colors text-slate-400 shrink-0 mb-0.5">
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10" /><path d="M8 14s1.5 2 4 2 4-2 4-2" /><line x1="9" y1="9" x2="9.01" y2="9" /><line x1="15" y1="9" x2="15.01" y2="9" />
        </svg>
      </button>

      {/* Send */}
      <button
        type="submit"
        disabled={!input.trim() || isPending}
        className="w-10 h-10 rounded-full bg-brand-500 text-white flex items-center justify-center hover:bg-brand-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed shrink-0 mb-0.5"
      >
        <svg className="w-4 h-4 -rotate-45" fill="currentColor" viewBox="0 0 24 24">
          <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
        </svg>
      </button>
    </form>
  )
}

// ── Right panel: empty state ────────────────────────────────────────────────
function EmptyChat() {
  return (
    <div className="flex-1 flex items-center justify-center bg-slate-50/50">
      <div className="text-center">
        <div className="w-20 h-20 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-5">
          <svg className="w-9 h-9 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
        </div>
        <p className="text-base font-bold text-slate-600 mb-1">Select a conversation</p>
        <p className="text-sm text-slate-400">Choose from your existing chats on the left</p>
      </div>
    </div>
  )
}

// ── Chat window (right side) ────────────────────────────────────────────────
function ChatWindow({ conversation, conversationId, userId }) {
  const qc = useQueryClient()
  const [typing, setTyping] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [msgSearch, setMsgSearch] = useState('')
  const typingTimer = useRef(null)

  const { data: messages = [] } = useQuery({
    queryKey: ['chat-messages', conversationId],
    queryFn: () => chatService.messages(conversationId).then(r => r.data),
    enabled: !!conversationId,
    refetchInterval: 10000,
  })

  const { mutate: send, isPending } = useMutation({
    mutationFn: (body) => chatService.sendMessage(conversationId, body),
    onSuccess: (res) => {
      qc.setQueryData(['chat-messages', conversationId], (old = []) => [...old, res.data])
      qc.invalidateQueries({ queryKey: ['conversations'] })
    },
    onError: () => toast.error('Error', 'Failed to send message'),
  })

  useEffect(() => {
    const socket = getSocket()
    if (!socket || !conversationId) return

    socket.emit('join:conversation', conversationId)

    function onNewMessage(msg) {
      if (msg.senderId !== userId) {
        qc.setQueryData(['chat-messages', conversationId], (old = []) => {
          if (old.some(m => m.id === msg.id)) return old
          return [...old, msg]
        })
      }
    }

    function onTypingEvent(data) {
      if (data.userId !== userId && data.conversationId === conversationId) {
        setTyping(true)
        clearTimeout(typingTimer.current)
        typingTimer.current = setTimeout(() => setTyping(false), 2000)
      }
    }

    socket.on('message:new', onNewMessage)
    socket.on('typing', onTypingEvent)

    return () => {
      socket.emit('leave:conversation', conversationId)
      socket.off('message:new', onNewMessage)
      socket.off('typing', onTypingEvent)
    }
  }, [conversationId, userId, qc])

  const typingDebounce = useRef(null)
  function emitTyping() {
    if (typingDebounce.current) return
    const socket = getSocket()
    if (socket) socket.emit('typing', { conversationId })
    typingDebounce.current = setTimeout(() => { typingDebounce.current = null }, 2000)
  }

  if (!conversationId) return <EmptyChat />

  const visibleMessages = msgSearch.trim()
    ? messages.filter(m => m.body.toLowerCase().includes(msgSearch.toLowerCase()))
    : messages

  return (
    <div className="flex-1 flex flex-col min-w-0">
      <ChatHeader
        conversation={conversation}
        userId={userId}
        typingUser={typing}
        searchOpen={searchOpen}
        onToggleSearch={() => { setSearchOpen(o => !o); setMsgSearch('') }}
      />
      {searchOpen && (
        <div className="shrink-0 px-6 py-2.5 border-b border-slate-100 bg-white">
          <div className="relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
            </svg>
            <input
              autoFocus
              type="text"
              value={msgSearch}
              onChange={e => setMsgSearch(e.target.value)}
              placeholder="Search messages..."
              className="w-full pl-9 pr-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-400 placeholder:text-slate-400"
            />
            {msgSearch && (
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-slate-400">
                {visibleMessages.length} result{visibleMessages.length !== 1 ? 's' : ''}
              </span>
            )}
          </div>
        </div>
      )}
      <MessageArea messages={visibleMessages} userId={userId} conversation={conversation} />
      <InputBar onSend={send} onTyping={emitTyping} isPending={isPending} />
    </div>
  )
}

// ── Main ChatPanel ──────────────────────────────────────────────────────────
export default function ChatPanel() {
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

  const { data: conversations = [], isLoading } = useQuery({
    queryKey: ['conversations'],
    queryFn: () => chatService.conversations().then(r => r.data),
    refetchInterval: 15000,
  })

  // Auto-select first conversation once loaded
  useEffect(() => {
    if (!activeConvo && conversations.length > 0) setActiveConvo(conversations[0].id)
  }, [conversations, activeConvo])

  const activeConversation = conversations.find(c => c.id === activeConvo) ?? null

  if (isLoading) {
    return (
      <div className="flex h-full bg-white">
        <div className="w-[340px] border-r border-slate-100 p-5 space-y-3">
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
      {/* Left panel — full width on mobile when no convo selected, fixed width on desktop */}
      <div className={`shrink-0 border-r border-slate-100 flex flex-col w-full md:w-[340px] ${activeConvo ? 'hidden md:flex' : 'flex'}`}>
        {/* Header */}
        <div className="shrink-0 px-5 pt-5 pb-3 space-y-3">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-bold text-slate-900">Messages</h1>
            <div className="flex items-center gap-1">
              <button className="w-8 h-8 rounded-full hover:bg-slate-100 flex items-center justify-center transition-colors text-slate-500">
                <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </button>
            </div>
          </div>
          <SearchBar value={search} onChange={setSearch} />
        </div>

        {/* Conversation list */}
        <ConversationList
          conversations={conversations}
          activeId={activeConvo}
          onSelect={setActiveConvo}
          userId={user?.id}
          search={search}
          onlineUsers={onlineUsers}
        />
      </div>

      {/* Right panel — full width on mobile when convo selected */}
      <div className={`flex-1 min-w-0 ${activeConvo ? 'flex' : 'hidden md:flex'} flex-col`}>
        {/* Mobile back button */}
        {activeConvo && (
          <button
            onClick={() => setActiveConvo(null)}
            className="md:hidden shrink-0 flex items-center gap-2 px-4 py-3 border-b border-slate-100 text-sm font-medium text-slate-600 hover:bg-slate-50"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 18l-6-6 6-6" />
            </svg>
            Back to messages
          </button>
        )}
        <ChatWindow
          conversation={activeConversation}
          conversationId={activeConvo}
          userId={user?.id}
        />
      </div>
    </div>
  )
}
