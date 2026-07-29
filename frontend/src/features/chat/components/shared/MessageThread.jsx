import { useState, useEffect, useRef, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Check, CheckCheck, Search, MessageCircle, CalendarDays, FileText, Pencil, Trash2, Home, Phone,
} from 'lucide-react'
import { chatService } from '@services/chat.service'
import { getSocket } from '@lib/socket'
import { toast } from '@components/common/Toaster'
import { confirm } from '@components/common/ConfirmDialog'
import { formatTime } from '@utils/time'
import { imgUrl } from '@utils/format'
import Modal from '@components/common/Modal'
import Avatar from './Avatar'
import InputBar from './InputBar'
import { chatTime, dateSeparator, displayName, isImageAttachment, replyTimeLabel } from './chatFormat'

// 16px, not 14: the double tick draws two overlapping strokes across the full
// width of its box, so it loses more to a small size than a single tick does and
// reads as a smudge. 16 is also the floor on the icon scale (.claude/ui-ux.md).
// `text-white/70`, not /50: on the brand-700 bubble that was ~2.9:1, under the
// 3:1 a meaning-bearing icon needs — and "sent but not read yet" is the whole
// meaning of that state.
function ReadReceipt({ isRead }) {
  const cls = `w-4 h-4 shrink-0 ${isRead ? 'text-white' : 'text-white/70'}`
  return isRead ? <CheckCheck className={cls} strokeWidth={2.5} /> : <Check className={cls} strokeWidth={2.5} />
}

// `counterpartRole` is the word for the OTHER person — "Owner" on the tenant
// surface, "Renter" on the owner's. It is passed in rather than derived here so
// this component never has to know which hat it is serving.
function ThreadHeader({ conversation, other, counterpartRole, replyMinutes, typingUser, searchOpen, onToggleSearch }) {
  if (!conversation) return null

  // "Owner · replies in about an hour" — the role plus, only when we've measured
  // it, how long they actually take. Absent rather than optimistic when there
  // isn't enough history, and absent entirely on the owner surface.
  const subtitle = [counterpartRole, replyTimeLabel(replyMinutes)].filter(Boolean).join(' · ')

  return (
    <div className="shrink-0 px-4 sm:px-6 py-3 flex items-center justify-between gap-2 sm:gap-4 border-b border-slate-100 bg-white">
      <div className="flex items-center gap-3 min-w-0">
        <Avatar name={displayName(other)} url={other?.avatarUrl} size={40} />
        <div className="min-w-0">
          <p className="text-base font-bold text-slate-900 truncate">{displayName(other)}</p>
          {typingUser ? (
            <p className="text-sm text-brand-600 font-medium animate-pulse">Typing…</p>
          ) : (
            <p className="text-sm text-slate-500 truncate">{subtitle}</p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {/* Either party can call the other, and the direction is not a rule this
            component enforces: the server decides per PERSON, from their own
            contactVisibility (chat.service.js's gateParticipantPhones), so a
            number the caller shouldn't have simply isn't in the payload. Absent
            therefore means "they chose not to share it, or never saved one" and
            the control does not render — the same behaviour mobile has had since
            P10. Web had no call affordance at all until 2026-07-30, so on this
            platform NEITHER side could call, which read as the feature being
            owner-only.
            `tel:` hands off to the phone/dialer — genuinely another app, the one
            case where leaving ours is correct. */}
        {!!other?.phone && (
          <a
            href={`tel:${other.phone}`}
            aria-label={`Call ${displayName(other)} on ${other.phone}`}
            title={other.phone}
            className="w-9 h-9 rounded-full flex items-center justify-center text-slate-500 hover:bg-slate-100 no-underline transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
          >
            <Phone className="w-[18px] h-[18px]" strokeWidth={2} aria-hidden="true" />
          </a>
        )}
        <button
          onClick={onToggleSearch}
          aria-label="Search in this conversation"
          className={`w-9 h-9 rounded-full flex items-center justify-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${searchOpen ? 'bg-brand-100 text-brand-700' : 'hover:bg-slate-100 text-slate-500'}`}
        >
          <Search className="w-[18px] h-[18px]" strokeWidth={2} />
        </button>
        {/* "View listing" is ~120px of a 375px header that also holds an
            avatar, a name and a search button. Below sm it becomes the same
            control as an icon, keeping its 44px target and its label for
            screen readers. */}
        {conversation.property?.id && (
          <Link
            to={`/property/${conversation.property.id}`}
            aria-label="View listing"
            className="min-h-[44px] flex items-center justify-center w-11 sm:w-auto sm:px-4 py-3 rounded-xl border border-slate-200 text-sm font-semibold text-slate-700 no-underline hover:border-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 transition-colors"
          >
            <Home className="w-[18px] h-[18px] sm:hidden" strokeWidth={2} aria-hidden="true" />
            <span className="hidden sm:inline">View listing</span>
          </Link>
        )}
      </div>
    </div>
  )
}

// A chat about a property almost always exists because someone wants to see it,
// and the two surfaces were disconnected: the appointment lived in one tab and
// the conversation about it in another. This states which visit is on the table
// so neither party has to go looking.
//
// Renders nothing when there is no live appointment — an empty banner saying
// "no visit booked" would be noise on every thread that is still just a question.
function VisitBanner({ visit }) {
  if (!visit) return null

  const when = visit.scheduledAt ?? visit.requestedDate
  const date = when
    ? new Date(when).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })
    : null
  const time = visit.requestedTime ? `, ${formatTime(visit.requestedTime)}` : ''

  const heading = visit.status === 'ACCEPTED' ? 'Visit confirmed'
    : visit.status === 'RESCHEDULED' ? 'Visit rescheduled'
    : 'Visit requested'

  return (
    <div className="shrink-0 flex items-start gap-3 px-4 sm:px-6 py-3.5 bg-brand-50">
      <CalendarDays size={17} strokeWidth={2} className="mt-0.5 shrink-0 text-brand-700" aria-hidden="true" />
      <p className="text-sm text-brand-900 leading-relaxed">
        <strong className="font-bold">{heading}</strong>
        {date && <> — {date}{time}.</>} This thread is about that visit.
      </p>
    </div>
  )
}

function MessageArea({
  messages, userId,
  editingId, editValue, onEditValueChange, onStartEdit, onCancelEdit, onSaveEdit, onDeleteRequest,
  onOpenImage,
}) {
  const scrollRef = useRef(null)

  // Scroll THIS container, not the message into view. scrollIntoView walks up
  // and scrolls every scrollable ancestor it needs to — including the document
  // — so sending a message dragged the whole page up and tucked the
  // conversation list under the fixed header. Setting scrollTop on the
  // container that actually owns the overflow cannot move anything else.
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
  }, [messages])

  let lastDate = null

  return (
    <div ref={scrollRef} className="flex-1 overflow-y-auto bg-white">
      <div className="px-4 sm:px-6 py-5">
      {messages.map((msg, i) => {
        const isMe = msg.senderId === userId
        const msgDate = dateSeparator(msg.createdAt)
        const showDate = msgDate !== lastDate
        lastDate = msgDate

        const prev = messages[i - 1]
        const isGrouped = prev && prev.senderId === msg.senderId &&
          (new Date(msg.createdAt) - new Date(prev.createdAt)) < 120000

        return (
          <div key={msg.id}>
            {showDate && (
              <div className="flex items-center justify-center my-5">
                <span className="px-3 py-1 text-xs font-semibold text-slate-500 bg-slate-50 rounded-full">
                  {msgDate}
                </span>
              </div>
            )}

            {/* No avatars in the thread. A two-person conversation has exactly
                one other face in it, already in the header — repeating it beside
                every bubble spent 42px a line on information nobody was
                missing. Alignment and colour say who spoke. */}
            <div className={`group flex items-center ${isMe ? 'justify-end' : 'justify-start'} ${isGrouped ? 'mt-1.5' : 'mt-4'}`}>

              {isMe && !msg.deletedAt && editingId !== msg.id && (
                <div className="hidden group-hover:flex items-center gap-1 mr-1.5">
                  {/* Edit disappears once they have read it — see editMessage()
                      in chat.service.js, which returns 409 for the same reason.
                      Delete stays: it leaves a visible tombstone, so nothing is
                      rewritten behind the reader's back. */}
                  {!msg.isRead && (
                    <button
                      onClick={() => onStartEdit(msg)}
                      className="w-6 h-6 rounded-full hover:bg-slate-200 flex items-center justify-center text-slate-500 hover:text-slate-600"
                      title="Edit message"
                    >
                      <Pencil className="w-3 h-3" strokeWidth={2} />
                    </button>
                  )}
                  <button
                    onClick={() => onDeleteRequest(msg)}
                    className="w-6 h-6 rounded-full hover:bg-red-50 flex items-center justify-center text-slate-500 hover:text-red-500"
                    title="Delete message"
                  >
                    <Trash2 className="w-3 h-3" strokeWidth={2} />
                  </button>
                </div>
              )}

              <div className="max-w-[70%] min-w-0">
                {editingId === msg.id ? (
                  <div className="px-3 py-2 rounded-2xl bg-white border border-brand-300 shadow-xs">
                    <textarea
                      autoFocus
                      value={editValue}
                      onChange={(e) => onEditValueChange(e.target.value)}
                      rows={2}
                      className="w-full text-sm text-slate-800 resize-none focus:outline-none"
                    />
                    <div className="flex items-center justify-end gap-2 mt-1">
                      <button onClick={onCancelEdit} className="text-xs font-semibold text-slate-500 hover:text-slate-600 px-2 py-1">Cancel</button>
                      <button onClick={onSaveEdit} className="text-xs font-semibold text-brand-600 hover:text-brand-700 px-2 py-1">Save</button>
                    </div>
                  </div>
                ) : (
                  <div className={`px-4 py-3 text-sm leading-relaxed ${isMe
                    ? 'bg-brand-700 text-white rounded-2xl rounded-br-md'
                    : 'bg-slate-100 text-slate-800 rounded-2xl rounded-bl-md'
                  }`}>
                    {msg.deletedAt ? (
                      <span className={`italic ${isMe ? 'text-white/70' : 'text-slate-500'}`}>This message was deleted</span>
                    ) : (
                      <>
                        {isImageAttachment(msg) && (
                          // Thumbnail inline, full resolution on click. It used
                          // to load the FULL image and paint it at 220px, so a
                          // thread of photos downloaded megabytes to show
                          // postage stamps.
                          <button
                            type="button"
                            onClick={() => onOpenImage(msg.attachmentUrl)}
                            className="block mb-1.5 rounded-lg overflow-hidden focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
                            title="Open full size"
                          >
                            <img
                              src={imgUrl(msg.attachmentUrl)}
                              alt="Attachment"
                              className="max-w-[220px] max-h-[220px] rounded-lg object-cover block"
                            />
                          </button>
                        )}
                        {msg.attachmentUrl && !isImageAttachment(msg) && (
                          <a
                            href={msg.attachmentUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={`flex items-center gap-2.5 mb-1.5 px-3 py-2.5 rounded-xl no-underline transition-colors ${
                              isMe ? 'bg-white/15 hover:bg-white/25 text-white' : 'bg-white hover:bg-slate-50 text-slate-800'
                            }`}
                          >
                            <FileText size={18} strokeWidth={2} className="shrink-0" aria-hidden="true" />
                            <span className="flex-1 min-w-0">
                              <span className="block text-sm font-semibold truncate">{msg.attachmentName || 'Document'}</span>
                              <span className={`block text-xs ${isMe ? 'text-white/70' : 'text-slate-500'}`}>PDF · opens in a new tab</span>
                            </span>
                          </a>
                        )}
                        {msg.body && (
                          <span className="block whitespace-pre-wrap break-words">{msg.body}</span>
                        )}
                      </>
                    )}
                    {/* Its own line under the message, not trailing the last
                        word — a timestamp inlined after the text competed with
                        it for the same reading position. */}
                    <span className={`flex items-center gap-1 mt-1 text-xs ${isMe ? 'text-white/70' : 'text-slate-500'}`}>
                      {msg.editedAt && !msg.deletedAt && <span>edited ·</span>}
                      <span>{chatTime(msg.createdAt)}</span>
                      {isMe && <ReadReceipt isRead={msg.isRead} />}
                    </span>
                  </div>
                )}
              </div>

            </div>
          </div>
        )
      })}

      </div>
    </div>
  )
}

function EmptyThread({ prompt }) {
  return (
    <div className="flex-1 flex items-center justify-center bg-slate-50/50">
      <div className="text-center">
        <div className="w-20 h-20 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-5">
          <MessageCircle className="w-9 h-9 text-slate-500" strokeWidth={1.2} />
        </div>
        <p className="text-base font-bold text-slate-600 mb-1">Select a conversation</p>
        <p className="text-sm text-slate-500">{prompt}</p>
      </div>
    </div>
  )
}

// The sender re-announces typing at most once per SEND interval; the receiver
// hides the indicator after HOLD. HOLD must be comfortably LONGER than SEND, or
// the receiver's window closes exactly when the next announcement is due and
// network latency guarantees it closes first — which is why "X is typing"
// flickered, and why whether you saw it at all depended on the other person's
// typing rhythm. Mirrored in mobile's ConversationScreen; keep the two in step.
const TYPING_SEND_EVERY_MS = 2000
const TYPING_HOLD_MS = 4000

// The right pane: one open thread, end to end. Everything here — sending,
// editing, deleting, typing, read receipts, live socket updates — is identical
// for both hats, because a message is a message. What the caller supplies is
// who the other person IS to them (`counterpartRole`) and whether a measured
// reply time is worth showing (`replyMinutes`, tenant surface only).
export default function MessageThread({
  conversation, conversationId, userId, counterpartRole, replyMinutes, emptyPrompt,
}) {
  const qc = useQueryClient()
  const [typing, setTyping] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [msgSearch, setMsgSearch] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [editingId, setEditingId] = useState(null)
  const [editValue, setEditValue] = useState('')
  const [lightbox, setLightbox] = useState(null)
  const typingTimer = useRef(null)

  // Debounce the search box 300ms before hitting the backend search endpoint
  useEffect(() => {
    const t = setTimeout(() => setSearchQuery(msgSearch.trim()), 300)
    return () => clearTimeout(t)
  }, [msgSearch])

  const { data: messages = [], isSuccess } = useQuery({
    queryKey: ['chat-messages', conversationId],
    queryFn: () => chatService.messages(conversationId).then(r => r.data),
    enabled: !!conversationId,
  })

  // Reading a thread makes every count that pointed at it wrong at once: the
  // Header's Messages/Inbox badge, this row's unread pill, and the MESSAGE
  // notification the backend retires alongside the messages (chat.service.js's
  // markConversationRead). Nothing here computes a new number — it drops the
  // stale ones so the next read is the truth. That is the difference between the
  // badge going out now and going out when its 15s/30s poll next came round,
  // which read as "the app thinks I haven't read this".
  const dropStaleCounts = useCallback(() => {
    qc.invalidateQueries({ queryKey: ['conversations'] })
    qc.invalidateQueries({ queryKey: ['chat-unread'] })
    qc.invalidateQueries({ queryKey: ['notifications'] })
    qc.invalidateQueries({ queryKey: ['notification-unread'] })
  }, [qc])

  // The fetch above is what marks the thread read server-side, so the moment it
  // lands is the moment those counts are stale. Once per thread, via the ref:
  // dropStaleCounts refetches `conversations`, which changes this component's
  // props — without the guard that is a loop.
  const syncedFor = useRef(null)
  useEffect(() => {
    if (!conversationId || !isSuccess || syncedFor.current === conversationId) return
    syncedFor.current = conversationId
    dropStaleCounts()
  }, [conversationId, isSuccess, dropStaleCounts])

  const { mutate: markRead } = useMutation({
    mutationFn: () => chatService.markRead(conversationId),
    onSuccess: dropStaleCounts,
  })

  // A message that lands while its own thread is open has been READ — unless the
  // tab is in the background, in which case it hasn't, and sending the other
  // person a read receipt for it would be a lie. So it is parked and settled the
  // moment the reader comes back.
  const arrivedUnseen = useRef(false)
  useEffect(() => {
    function onVisibility() {
      if (document.visibilityState !== 'visible' || !arrivedUnseen.current) return
      arrivedUnseen.current = false
      markRead()
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [markRead])

  const { data: searchResults = [] } = useQuery({
    queryKey: ['chat-search', conversationId, searchQuery],
    queryFn: () => chatService.searchMessages(conversationId, searchQuery).then(r => r.data.slice().reverse()),
    enabled: !!conversationId && searchQuery.length > 0,
  })

  const { mutate: send, isPending } = useMutation({
    mutationFn: ({ body, attachmentUrl, attachmentName, attachmentMime }) =>
      chatService.sendMessage(conversationId, body, { url: attachmentUrl, name: attachmentName, mime: attachmentMime }),
    onSuccess: (res) => {
      qc.setQueryData(['chat-messages', conversationId], (old = []) => [...old, res.data])
      qc.invalidateQueries({ queryKey: ['conversations'] })
    },
    onError: () => toast.error('Error', 'Failed to send message'),
  })

  const { mutate: editMsg } = useMutation({
    mutationFn: ({ messageId, body }) => chatService.editMessage(conversationId, messageId, body).then(r => r.data),
    onSuccess: (updated) => {
      qc.setQueryData(['chat-messages', conversationId], (old = []) => old.map(m => (m.id === updated.id ? updated : m)))
      setEditingId(null)
      setEditValue('')
    },
    onError: () => toast.error('Error', 'Failed to edit message'),
  })

  const { mutate: deleteMsg } = useMutation({
    mutationFn: (messageId) => chatService.deleteMessage(conversationId, messageId),
    onSuccess: (_res, messageId) => {
      qc.setQueryData(['chat-messages', conversationId], (old = []) =>
        old.map(m => (m.id === messageId ? { ...m, deletedAt: new Date().toISOString(), body: '', attachmentUrl: null, attachmentName: null } : m)))
    },
    onError: () => toast.error('Error', 'Failed to delete message'),
  })

  useEffect(() => {
    const socket = getSocket()
    if (!socket || !conversationId) return

    socket.emit('join:conversation', conversationId)

    function onNewMessage(msg) {
      if (msg.senderId === userId) return
      qc.setQueryData(['chat-messages', conversationId], (old = []) => {
        if (old.some(m => m.id === msg.id)) return old
        return [...old, msg]
      })
      // The message is here, so they have stopped typing — leaving the indicator
      // up for another few seconds under the message it was announcing makes it
      // look like a second one is coming.
      clearTimeout(typingTimer.current)
      setTyping(false)
      // It is on screen, so it is read. Otherwise the badge appears over the
      // very tab the reader is looking at.
      if (document.visibilityState === 'visible') markRead()
      else arrivedUnseen.current = true
    }

    function onTypingEvent(data) {
      if (data.userId !== userId && data.conversationId === conversationId) {
        setTyping(true)
        clearTimeout(typingTimer.current)
        typingTimer.current = setTimeout(() => setTyping(false), TYPING_HOLD_MS)
      }
    }

    function onMessageRead(data) {
      if (data.conversationId !== conversationId || data.readerId === userId) return
      qc.setQueryData(['chat-messages', conversationId], (old = []) =>
        old.map(m => (m.senderId === userId ? { ...m, isRead: true } : m)))
      qc.invalidateQueries({ queryKey: ['conversations'] })
    }

    function onMessageEdited(msg) {
      if (msg.conversationId !== conversationId) return
      qc.setQueryData(['chat-messages', conversationId], (old = []) => old.map(m => (m.id === msg.id ? msg : m)))
    }

    function onMessageDeleted(data) {
      if (data.conversationId !== conversationId) return
      qc.setQueryData(['chat-messages', conversationId], (old = []) =>
        old.map(m => (m.id === data.id ? { ...m, deletedAt: new Date().toISOString(), body: '', attachmentUrl: null, attachmentName: null } : m)))
    }

    // Reconnect safety net: catch up on anything missed while disconnected
    function onConnect() {
      qc.invalidateQueries({ queryKey: ['chat-messages', conversationId] })
    }

    socket.on('message:new', onNewMessage)
    socket.on('typing', onTypingEvent)
    socket.on('message:read', onMessageRead)
    socket.on('message:edited', onMessageEdited)
    socket.on('message:deleted', onMessageDeleted)
    socket.on('connect', onConnect)

    return () => {
      socket.emit('leave:conversation', conversationId)
      socket.off('message:new', onNewMessage)
      socket.off('typing', onTypingEvent)
      socket.off('message:read', onMessageRead)
      socket.off('message:edited', onMessageEdited)
      socket.off('message:deleted', onMessageDeleted)
      socket.off('connect', onConnect)
    }
  }, [conversationId, userId, qc, markRead])

  const typingDebounce = useRef(null)
  function emitTyping() {
    if (typingDebounce.current) return
    const socket = getSocket()
    if (socket) socket.emit('typing', { conversationId })
    typingDebounce.current = setTimeout(() => { typingDebounce.current = null }, TYPING_SEND_EVERY_MS)
  }

  function startEdit(msg) { setEditingId(msg.id); setEditValue(msg.body) }
  function cancelEdit() { setEditingId(null); setEditValue('') }
  function saveEdit() {
    const body = editValue.trim()
    if (!body || !editingId) return
    editMsg({ messageId: editingId, body })
  }
  async function requestDelete(msg) {
    const confirmed = await confirm({
      title: 'Delete message?',
      message: 'This cannot be undone.',
      confirmLabel: 'Delete',
    })
    if (confirmed) deleteMsg(msg.id)
  }

  if (!conversationId) return <EmptyThread prompt={emptyPrompt} />

  const visibleMessages = searchQuery.length > 0 ? searchResults : messages
  const other = conversation?.tenantId === userId ? conversation?.owner : conversation?.tenant

  return (
    // min-h-0 so MessageArea's `flex-1 overflow-y-auto` scrolls instead of
    // stretching this column past its parent — see the note in ChatSurface.
    <div className="flex-1 flex flex-col min-w-0 min-h-0">
      <ThreadHeader
        conversation={conversation}
        other={other}
        counterpartRole={counterpartRole}
        replyMinutes={replyMinutes}
        typingUser={typing}
        searchOpen={searchOpen}
        onToggleSearch={() => { setSearchOpen(o => !o); setMsgSearch('') }}
      />
      <VisitBanner visit={conversation?.visit} />
      {searchOpen && (
        <div className="shrink-0 px-4 sm:px-6 py-2.5 border-b border-slate-100 bg-white">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" strokeWidth={2} />
            <input
              autoFocus
              type="text"
              value={msgSearch}
              onChange={e => setMsgSearch(e.target.value)}
              placeholder="Search messages..."
              className="w-full pl-9 pr-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/20 focus:border-brand-400 placeholder:text-slate-500"
            />
            {msgSearch && (
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-slate-500">
                {visibleMessages.length} result{visibleMessages.length !== 1 ? 's' : ''}
              </span>
            )}
          </div>
        </div>
      )}
      <MessageArea
        messages={visibleMessages}
        userId={userId}
        editingId={editingId}
        editValue={editValue}
        onEditValueChange={setEditValue}
        onStartEdit={startEdit}
        onCancelEdit={cancelEdit}
        onSaveEdit={saveEdit}
        onDeleteRequest={requestDelete}
        onOpenImage={setLightbox}
      />
      <InputBar onSend={send} onTyping={emitTyping} isPending={isPending} />

      {/* Full resolution, on the shared Modal primitive rather than a bespoke
          lightbox — the thread in .claude/frontend.md is that every dialog is
          this component. `detail` asks imgUrl for the _full variant; the bubble
          shows the _thumb. */}
      <Modal isOpen={!!lightbox} onClose={() => setLightbox(null)} size="full">
        {lightbox && (
          <img
            src={imgUrl(lightbox, 'detail')}
            alt="Attachment, full size"
            className="mx-auto block max-h-[80vh] w-auto max-w-full rounded-lg"
          />
        )}
      </Modal>
    </div>
  )
}
