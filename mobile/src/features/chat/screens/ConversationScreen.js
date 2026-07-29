import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { View, Text, TextInput, Pressable, FlatList, KeyboardAvoidingView, ActivityIndicator, Alert, AppState, Linking, Modal, StyleSheet } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useIsFocused } from '@react-navigation/native'
import { Image } from 'expo-image'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import * as ImagePicker from 'expo-image-picker'
import { chatService } from '@services/chat.service'
import { uploadService } from '@services/upload.service'
import { useAuth } from '@features/auth/hooks/useAuth'
import { getSocket } from '@lib/socket'
import { imgUrl } from '@utils/format'
import { formatTime } from '@utils/time'
import Icon from '@components/common/Icon'
import ErrorState from '@components/common/ErrorState'
import ScreenHeader from '@components/common/ScreenHeader'
import ReadReceipt from '../components/ReadReceipt'
import ChatPropertyCard from '../components/ChatPropertyCard'
import { colors } from '@theme/colors'
import { fonts, fontSizes } from '@theme/typography'
import { spacing, radius } from '@theme/spacing'

// Mirrors web's isImageAttachment. Messages older than 2026-07-26 carry no
// attachmentMime and were images by construction — chat accepted nothing else.
function isImageAttachment(msg) {
  if (!msg?.attachmentUrl) return false
  return !msg.attachmentMime || msg.attachmentMime.startsWith('image/')
}

function chatTime(date) {
  return new Date(date).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
}

// Mirrors web ChatPanel's dateSeparator()
function dateSeparator(date) {
  const d = new Date(date)
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)
  if (d.toDateString() === today.toDateString()) return 'Today'
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday'
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

function displayName(user) {
  return user?.name || user?.email?.split('@')[0] || 'Unknown'
}

function SenderAvatar({ sender }) {
  if (sender?.avatarUrl) {
    return <Image source={{ uri: imgUrl(sender.avatarUrl) }} style={styles.senderAvatar} contentFit="cover" cachePolicy="memory-disk" transition={200} />
  }
  return (
    <View style={[styles.senderAvatar, styles.senderAvatarFallback]}>
      <Text style={styles.senderAvatarInitial}>{displayName(sender)[0]?.toUpperCase()}</Text>
    </View>
  )
}

// A chat about a property almost always exists because someone wants to see it,
// and the two surfaces were disconnected: the appointment lived in one tab and
// the conversation about it in another. Web has said this in the thread since
// the visit context shipped; mobile did not, which is why a rescheduled visit
// looked like it had gone nowhere.
//
// Renders nothing when there is no live appointment — an empty "no visit
// booked" strip would be noise on every thread that is still just a question.
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
    <View style={styles.visitBanner}>
      <Icon name="calendar" size={16} color={colors.brand700} />
      <Text style={styles.visitBannerText}>
        <Text style={styles.visitBannerHeading}>{heading}</Text>
        {date ? ` — ${date}${time}.` : '.'} This thread is about that visit.
      </Text>
    </View>
  )
}

// MEASURED from the owner's own reply history (chat.service.js returns a median
// and nothing below three samples). Shown only to the RENTER: an owner does not
// need to be told how fast they themselves answer. Mirrors web's
// chatFormat.js replyTimeLabel.
function replyTimeLabel(minutes) {
  if (minutes == null) return null
  if (minutes < 15) return 'replies within minutes'
  if (minutes < 90) return 'replies in about an hour'
  if (minutes < 60 * 20) return `replies in about ${Math.round(minutes / 60)} hours`
  const days = Math.round(minutes / 60 / 24)
  return days <= 1 ? 'replies within a day' : `replies in about ${days} days`
}

export default function ConversationScreen({ route, navigation }) {
  const { conversationId, other: otherParam, otherRole } = route.params
  const { user } = useAuth()
  const qc = useQueryClient()
  const [input, setInput] = useState('')
  const [typing, setTyping] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [msgSearch, setMsgSearch] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [editingId, setEditingId] = useState(null)
  const [lightbox, setLightbox] = useState(null)
  const [uploading, setUploading] = useState(false)
  const typingTimer = useRef(null)
  const typingDebounce = useRef(null)

  // Deep links (push notifications) pass only conversationId — derive the
  // other party and the property from the cached conversations list.
  const { data: conversations = [] } = useQuery({
    queryKey: ['conversations'],
    queryFn: () => chatService.conversations().then((r) => r.data),
  })
  const conversation = conversations.find((c) => c.id === conversationId)
  const counterpart = conversation ? (conversation.tenantId === user?.id ? conversation.owner : conversation.tenant) : null
  const other = otherParam ?? counterpart
  const property = conversation?.property

  const otherName = other?.name || other?.email?.split('@')[0] || 'Chat'
  // Server-gated by the counterpart's own contactVisibility (chat.service.js's
  // gateParticipantPhones) — absent means they chose not to share it, and the
  // call button simply doesn't render. The conversation payload wins over the
  // route param because it is the surface the gate is applied to.
  const otherPhone = counterpart?.phone ?? other?.phone ?? null

  // Debounce the search box 300ms before hitting the backend search endpoint
  useEffect(() => {
    const t = setTimeout(() => setSearchQuery(msgSearch.trim()), 300)
    return () => clearTimeout(t)
  }, [msgSearch])

  const { data: messages = [], isLoading, isSuccess, isError, refetch } = useQuery({
    queryKey: ['chat-messages', conversationId],
    queryFn: () => chatService.messages(conversationId).then((r) => r.data),
    enabled: !!conversationId,
  })

  // Reading a thread makes every count that pointed at it wrong at once: the
  // Chat/Inbox tab badge (useTabBadges sums the same ['conversations'] rows),
  // this thread's unread pill, and the MESSAGE notification the backend retires
  // alongside the messages (chat.service.js's markConversationRead). Nothing
  // here computes a number — it drops the stale ones so the next read is the
  // truth. Without it the tab badge outlived the reading by up to 15 seconds.
  const dropStaleCounts = useCallback(() => {
    qc.invalidateQueries({ queryKey: ['conversations'] })
    qc.invalidateQueries({ queryKey: ['notifications'] })
    qc.invalidateQueries({ queryKey: ['notification-unread'] })
  }, [qc])

  // The fetch above is what marks the thread read server-side, so the moment it
  // lands is the moment those counts are stale. Once per thread, via the ref:
  // dropStaleCounts refetches `conversations`, which this screen reads.
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

  // "The reader can actually see this thread" = this screen is focused AND the
  // app is foregrounded. A message that lands while both are true has been read;
  // one that lands otherwise has NOT, and claiming so would put a false read
  // receipt in front of the sender. Kept in refs so the socket effect below
  // never re-subscribes — it would leave and re-join the room on every app
  // switch. Anything parked is settled the moment attention returns.
  const isFocused = useIsFocused()
  const canSee = useRef(false)
  const arrivedUnseen = useRef(false)

  useEffect(() => {
    function sync(appState = AppState.currentState) {
      canSee.current = isFocused && appState === 'active'
      if (!canSee.current || !arrivedUnseen.current) return
      arrivedUnseen.current = false
      markRead()
    }
    sync()
    const sub = AppState.addEventListener('change', sync)
    return () => sub.remove()
  }, [isFocused, markRead])

  const { data: searchResults = [] } = useQuery({
    queryKey: ['chat-search', conversationId, searchQuery],
    queryFn: () => chatService.searchMessages(conversationId, searchQuery).then((r) => r.data.slice().reverse()),
    enabled: !!conversationId && searchQuery.length > 0,
  })

  const { mutate: send, isPending } = useMutation({
    mutationFn: ({ body, attachmentUrl, attachmentName, attachmentMime }) =>
      chatService.sendMessage(conversationId, body, { url: attachmentUrl, name: attachmentName, mime: attachmentMime }),
    onSuccess: (res) => {
      qc.setQueryData(['chat-messages', conversationId], (old = []) => [...old, res.data])
      qc.invalidateQueries({ queryKey: ['conversations'] })
    },
    onError: () => Alert.alert('Message not sent', 'Check your connection and try again.'),
  })

  const { mutate: editMsg, isPending: isEditPending } = useMutation({
    mutationFn: ({ messageId, body }) => chatService.editMessage(conversationId, messageId, body).then((r) => r.data),
    onSuccess: (updated) => {
      qc.setQueryData(['chat-messages', conversationId], (old = []) => old.map((m) => (m.id === updated.id ? updated : m)))
      setEditingId(null)
      setInput('')
    },
    onError: () => Alert.alert('Edit failed', 'Could not save your changes. Please try again.'),
  })

  const { mutate: deleteMsg } = useMutation({
    mutationFn: (messageId) => chatService.deleteMessage(conversationId, messageId),
    onSuccess: (_res, messageId) => {
      qc.setQueryData(['chat-messages', conversationId], (old = []) =>
        old.map((m) => (m.id === messageId ? { ...m, deletedAt: new Date().toISOString(), body: '', attachmentUrl: null } : m)))
    },
    onError: () => Alert.alert('Delete failed', 'Could not delete the message. Please try again.'),
  })

  useEffect(() => {
    const socket = getSocket()
    if (!socket || !conversationId) return

    socket.emit('join:conversation', conversationId)

    function onNewMessage(msg) {
      if (msg.senderId === user?.id) return
      qc.setQueryData(['chat-messages', conversationId], (old = []) => {
        if (old.some((m) => m.id === msg.id)) return old
        return [...old, msg]
      })
      // It is on screen, so it is read. Otherwise the badge appears over the
      // very tab the reader is looking at.
      if (canSee.current) markRead()
      else arrivedUnseen.current = true
    }

    function onTypingEvent(data) {
      if (data.userId !== user?.id && data.conversationId === conversationId) {
        setTyping(true)
        clearTimeout(typingTimer.current)
        typingTimer.current = setTimeout(() => setTyping(false), 2000)
      }
    }

    function onMessageRead(data) {
      if (data.conversationId !== conversationId || data.readerId === user?.id) return
      qc.setQueryData(['chat-messages', conversationId], (old = []) =>
        old.map((m) => (m.senderId === user?.id ? { ...m, isRead: true } : m)))
      qc.invalidateQueries({ queryKey: ['conversations'] })
    }

    function onMessageEdited(msg) {
      if (msg.conversationId !== conversationId) return
      qc.setQueryData(['chat-messages', conversationId], (old = []) => old.map((m) => (m.id === msg.id ? msg : m)))
    }

    function onMessageDeleted(data) {
      if (data.conversationId !== conversationId) return
      qc.setQueryData(['chat-messages', conversationId], (old = []) =>
        old.map((m) => (m.id === data.id ? { ...m, deletedAt: new Date().toISOString(), body: '', attachmentUrl: null } : m)))
    }

    // Reconnect safety net (also covers foreground-after-background): catch
    // up on anything missed while the socket was disconnected.
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
  }, [conversationId, user?.id, qc, markRead])

  function emitTyping() {
    if (typingDebounce.current) return
    getSocket()?.emit('typing', { conversationId })
    typingDebounce.current = setTimeout(() => { typingDebounce.current = null }, 2000)
  }

  const busy = isPending || isEditPending || uploading

  function handleSend() {
    const body = input.trim()
    if (!body || busy) return
    if (editingId) {
      editMsg({ messageId: editingId, body })
      return
    }
    send({ body })
    setInput('')
  }

  function cancelEdit() {
    setEditingId(null)
    setInput('')
  }

  async function handleAttach() {
    // Permissionless OS photo picker — matches ImageUploader.js's convention,
    // no requestMediaLibraryPermissionsAsync needed for launchImageLibraryAsync.
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7 })
    if (result.canceled || !result.assets?.length) return
    setUploading(true)
    try {
      const res = await uploadService.uploadChatImage(result.assets[0])
      send({ body: input.trim(), attachmentUrl: res.data.url })
      setInput('')
    } catch {
      Alert.alert('Upload failed', 'Could not send the image. Please try again.')
    } finally {
      setUploading(false)
    }
  }

  function confirmDelete(messageId) {
    Alert.alert('Delete message?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteMsg(messageId) },
    ])
  }

  // Edit is offered only until they have read it. After that the words are
  // theirs too, and rewriting them leaves nothing behind but a small "edited"
  // label the reader has no reason to look at again. Delete stays on the menu
  // either way — it leaves "This message was deleted", which is visible.
  // editMessage() in chat.service.js returns 409 for the same reason, so this
  // is the affordance matching the rule, not the rule itself.
  function handleLongPressOwn(item) {
    if (item.deletedAt) return
    Alert.alert('Message options', undefined, [
      ...(item.isRead ? [] : [{ text: 'Edit', onPress: () => { setEditingId(item.id); setInput(item.body) } }]),
      { text: 'Delete', style: 'destructive', onPress: () => confirmDelete(item.id) },
      { text: 'Cancel', style: 'cancel' },
    ])
  }

  function openProperty() {
    if (!property?.id) return
    // Pushed onto THIS stack — every stack that carries Conversation also
    // carries PropertyDetail (AppTabs.js's BOOKING_SCREENS), so back returns
    // to this thread. The old cross-tab hop to Explore/MyListing meant back
    // landed on the map instead of the conversation.
    navigation.navigate('PropertyDetail', { propertyId: property.id })
  }

  // Search hits the backend once the box settles (300ms debounce); otherwise
  // show the live-loaded page. Both are annotated chronologically with
  // date-separator + grouping flags, then reversed for the inverted list.
  const listData = useMemo(() => {
    const visible = searchQuery.length > 0 ? searchResults : messages

    // Immutable reduce (fresh accumulator per iteration, no captured-variable
    // reassignment) instead of a `let` mutated across .map() calls.
    const { out: annotated } = visible.reduce((acc, msg, i) => {
      const msgDate = dateSeparator(msg.createdAt)
      const showDate = msgDate !== acc.lastDate
      const prev = visible[i - 1]
      const isGrouped = !showDate && !!prev && prev.senderId === msg.senderId &&
        (new Date(msg.createdAt) - new Date(prev.createdAt)) < 120000
      return {
        lastDate: msgDate,
        out: [...acc.out, { ...msg, _dateLabel: showDate ? msgDate : null, _isGrouped: isGrouped }],
      }
    }, { lastDate: null, out: [] })
    return annotated.reverse()
  }, [messages, searchResults, searchQuery])

  const resultCount = searchQuery.length > 0 ? listData.length : null

  // edges: none. ScreenHeader owns the top inset (and paints it white); the
  // visible tab bar below owns the bottom one. Claiming either here padded it
  // twice — that was the slate50 band under the input bar.
  return (
    <SafeAreaView style={styles.container} edges={[]}>
      {/* This screen was the ONE without a SafeAreaView — it leaned on React
          Navigation's native header for the top inset. Now it owns it, like
          every other screen, and the header is the shared one. */}
      <ScreenHeader
        title={otherName}
        // "Owner · replies in about an hour" — the role, plus how long they
        // actually take when we have measured it. Absent rather than optimistic
        // below three samples, and absent entirely on the host side.
        subtitle={[otherRole, otherRole === 'Owner' ? replyTimeLabel(conversation?.ownerReplyMinutes) : null]
          .filter(Boolean).join(' · ') || undefined}
        onBack={() => navigation.goBack()}
        right={(
          <View style={styles.headerActions}>
            {/* tel: hands off to the dialer — genuinely another app, the one
                use Linking stays correct for (mobile/AGENTS.md §1). */}
            {!!otherPhone && (
              <Pressable
                style={styles.headerSearchButton}
                onPress={() => Linking.openURL(`tel:${otherPhone}`)}
                accessibilityRole="button"
                accessibilityLabel={`Call ${otherName}`}
                hitSlop={8}
              >
                <Icon name="phone" size={20} color={colors.slate500} />
              </Pressable>
            )}
            <Pressable
              style={styles.headerSearchButton}
              onPress={() => { setSearchOpen((o) => !o); setMsgSearch('') }}
              accessibilityRole="button"
              accessibilityLabel={searchOpen ? 'Close message search' : 'Search messages'}
              accessibilityState={{ expanded: searchOpen }}
              hitSlop={8}
            >
              <Icon name={searchOpen ? 'close' : 'search'} size={20} color={searchOpen ? colors.brand600 : colors.slate500} />
            </Pressable>
          </View>
        )}
      />
      {/* `behavior="padding"` on BOTH platforms (mobile/AGENTS.md §7). The old
          house pattern — undefined on Android, leaning on adjustResize — died
          with SDK 57: edge-to-edge is enforced (targetSdk 36) and the window no
          longer resizes for the keyboard, so the input bar sat hidden behind
          it. KAV pads by the measured overlap of its own frame with the
          keyboard, so it cannot double-compensate even where resize works. */}
      <KeyboardAvoidingView
        style={styles.flex}
        behavior="padding"
      >
      {searchOpen && (
        <View style={styles.searchBar}>
          <Icon name="search" size={16} color={colors.slate500} />
          <TextInput
            style={styles.searchInput}
            value={msgSearch}
            onChangeText={setMsgSearch}
            placeholder="Search messages..."
            placeholderTextColor={colors.slate500}
            autoFocus
            accessibilityLabel="Search messages"
          />
          {resultCount !== null && (
            <Text style={styles.searchCount}>{resultCount} result{resultCount !== 1 ? 's' : ''}</Text>
          )}
        </View>
      )}

      {/* Pinned so the user always knows which property this chat is about —
          it used to be the inverted list's footer and scrolled out of view
          once the thread grew past a screenful. */}
      {property && (
        <View style={styles.pinnedProperty}>
          <ChatPropertyCard property={property} onPress={openProperty} pinned />
        </View>
      )}

      {/* Which listing, then what is happening about it. */}
      <VisitBanner visit={conversation?.visit} />

      {isLoading ? (
        <View style={styles.center}><ActivityIndicator color={colors.brand600} /></View>
      ) : isError ? (
        <ErrorState title="Couldn't load messages" onRetry={refetch} />
      ) : (
        <FlatList
          data={listData}
          keyExtractor={(m) => m.id}
          inverted
          // `style` is what makes this scroll, and it is NOT interchangeable
          // with contentContainerStyle. Without flex:1 on the list ITSELF, a
          // FlatList in a flex column sizes to its CONTENT: the viewport grows
          // with the thread, so there is never anything to scroll past and the
          // messages simply overflow. Short threads hid it; anything over a
          // screenful froze. `flexGrow: 1` on the content container is a
          // different job — it keeps a SHORT inverted thread pinned to the
          // bottom — and cannot substitute.
          style={styles.flex}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => {
            const isOwn = item.senderId === user?.id
            return (
              <View>
                {item._dateLabel && (
                  <View style={styles.dateRow}>
                    <Text style={styles.dateLabel}>{item._dateLabel}</Text>
                  </View>
                )}
                <View style={[styles.bubbleRow, isOwn && styles.bubbleRowOwn, item._isGrouped ? styles.bubbleRowGrouped : styles.bubbleRowFirst]}>
                  {!isOwn && (item._isGrouped
                    ? <View style={styles.senderAvatarSpacer} />
                    : <SenderAvatar sender={item.sender ?? other} />
                  )}
                  <Pressable
                    onLongPress={isOwn ? () => handleLongPressOwn(item) : undefined}
                    style={[styles.bubble, isOwn ? styles.bubbleOwn : styles.bubbleOther]}
                  >
                    {item.deletedAt ? (
                      <Text style={[styles.bubbleText, isOwn && styles.bubbleTextOwn, styles.bubbleDeletedText]}>This message was deleted</Text>
                    ) : (
                      <>
                        {isImageAttachment(item) && (
                          // Thumbnail in the bubble, full resolution on tap. It
                          // used to load the FULL image to paint it at 200pt.
                          <Pressable
                            onPress={() => setLightbox(item.attachmentUrl)}
                            accessibilityRole="imagebutton"
                            accessibilityLabel="Open photo full size"
                          >
                            <Image source={{ uri: imgUrl(item.attachmentUrl) }} style={styles.attachmentImage} contentFit="cover" cachePolicy="memory-disk" transition={200} />
                          </Pressable>
                        )}
                        {/* A document, not a photo. Rendering a PDF through
                            <Image> showed a blank square — chat has accepted
                            documents from web since 2026-07-26, so this side
                            has to be able to READ them even though it cannot
                            send one yet (that needs a native picker). */}
                        {item.attachmentUrl && !isImageAttachment(item) && (
                          <Pressable
                            style={[styles.docChip, isOwn && styles.docChipOwn]}
                            onPress={() => Linking.openURL(item.attachmentUrl)}
                            accessibilityRole="button"
                            accessibilityLabel={`Open ${item.attachmentName || 'document'}`}
                          >
                            <Icon name="document" size={18} color={isOwn ? colors.white : colors.slate700} />
                            <View style={{ flex: 1 }}>
                              <Text style={[styles.docName, isOwn && styles.docNameOwn]} numberOfLines={1}>
                                {item.attachmentName || 'Document'}
                              </Text>
                              <Text style={[styles.docHint, isOwn && styles.docHintOwn]}>PDF · tap to open</Text>
                            </View>
                          </Pressable>
                        )}
                        {!!item.body && <Text style={[styles.bubbleText, isOwn && styles.bubbleTextOwn]}>{item.body}</Text>}
                      </>
                    )}
                    <View style={styles.bubbleMeta}>
                      {item.editedAt && !item.deletedAt && (
                        <Text style={[styles.bubbleTime, isOwn && styles.bubbleTimeOwn]}>edited</Text>
                      )}
                      <Text style={[styles.bubbleTime, isOwn && styles.bubbleTimeOwn]}>{chatTime(item.createdAt)}</Text>
                      {isOwn && <ReadReceipt isRead={item.isRead} />}
                    </View>
                  </Pressable>
                </View>
              </View>
            )
          }}
          ListHeaderComponent={typing ? (
            <View style={styles.typingRow}>
              <Text style={styles.typingText}>{otherRole ?? 'They'} typing…</Text>
            </View>
          ) : null}
          ListFooterComponent={null}
          ListEmptyComponent={searchQuery.length > 0 ? (
            <View style={styles.noResults}>
              <Text style={styles.noResultsText}>No messages match &ldquo;{searchQuery}&rdquo;</Text>
            </View>
          ) : null}
        />
      )}

      {editingId && (
        <View style={styles.editingBanner}>
          <Text style={styles.editingBannerText}>Editing message</Text>
          <Pressable onPress={cancelEdit} hitSlop={8} accessibilityRole="button" accessibilityLabel="Cancel edit">
            <Icon name="close" size={16} color={colors.slate500} />
          </Pressable>
        </View>
      )}

      <View style={styles.inputBar}>
        <Pressable
          style={[styles.attachButton, busy && styles.disabled]}
          onPress={handleAttach}
          disabled={busy}
          accessibilityRole="button"
          accessibilityLabel="Attach an image"
        >
          {uploading ? <ActivityIndicator size="small" color={colors.slate500} /> : <Icon name="attach" size={18} color={colors.slate500} />}
        </Pressable>
        <TextInput
          style={styles.input}
          value={input}
          onChangeText={(v) => { setInput(v); emitTyping() }}
          placeholder="Type a message..."
          placeholderTextColor={colors.slate500}
          multiline
          accessibilityLabel="Message text"
        />
        <Pressable
          style={[styles.sendButton, (!input.trim() || busy) && styles.disabled]}
          onPress={handleSend}
          disabled={!input.trim() || busy}
          accessibilityRole="button"
          accessibilityLabel={editingId ? 'Save edit' : 'Send message'}
          accessibilityState={{ disabled: !input.trim() || busy }}
        >
          <Icon name={editingId ? 'check' : 'send'} size={16} color={colors.white} />
        </Pressable>
      </View>
      </KeyboardAvoidingView>

      {/* Full resolution, over everything. onRequestClose is what makes the
          Android hardware back button dismiss it (mobile/AGENTS.md §2) —
          without it the photo traps you. `detail` asks imgUrl for the _full
          variant; the bubble showed the _thumb. */}
      <Modal
        visible={!!lightbox}
        transparent
        animationType="fade"
        onRequestClose={() => setLightbox(null)}
        statusBarTranslucent
      >
        <Pressable
          style={styles.lightbox}
          onPress={() => setLightbox(null)}
          accessibilityRole="button"
          accessibilityLabel="Close photo"
        >
          {!!lightbox && (
            <Image
              source={{ uri: imgUrl(lightbox, 'detail') }}
              style={styles.lightboxImage}
              contentFit="contain"
              cachePolicy="memory-disk"
              transition={150}
            />
          )}
        </Pressable>
      </Modal>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.slate50 },
  flex: { flex: 1 },
  visitBanner: {
    flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm,
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
    backgroundColor: colors.brand50,
  },
  visitBannerText: { flex: 1, fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.brand900, lineHeight: 20 },
  visitBannerHeading: { fontFamily: fonts.bodySemiBold },
  // Tinted, not white: this strip is a link to the listing the whole
  // conversation is about, and as a plain white block between a white header
  // and a white message canvas it read as a slab rather than something to tap.
  pinnedProperty: {
    backgroundColor: colors.brand50, borderBottomWidth: 1, borderBottomColor: colors.brand100,
  },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  headerActions: { flexDirection: 'row', alignItems: 'center' },
  headerSearchButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  searchBar: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.xs,
    backgroundColor: colors.white, borderBottomWidth: 1, borderBottomColor: colors.slate100,
    paddingHorizontal: spacing.md, paddingVertical: spacing.xs,
  },
  searchInput: { flex: 1, minHeight: 40, fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.slate800 },
  searchCount: { fontFamily: fonts.body, fontSize: 11, color: colors.slate500 },
  list: { padding: spacing.md, flexGrow: 1 },
  typingRow: { paddingVertical: spacing.xs, paddingHorizontal: spacing.sm },
  typingText: { fontFamily: fonts.body, fontSize: fontSizes.xs, color: colors.slate500, fontStyle: 'italic' },
  noResults: { paddingVertical: spacing.xl, alignItems: 'center', transform: [{ scaleY: -1 }] },
  noResultsText: { fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.slate500 },
  dateRow: { alignItems: 'center', marginVertical: spacing.sm },
  dateLabel: {
    fontFamily: fonts.bodySemiBold, fontSize: 11, color: colors.slate500,
    backgroundColor: colors.white, borderWidth: 1, borderColor: colors.slate100,
    borderRadius: radius.full, paddingHorizontal: spacing.sm, paddingVertical: 3, overflow: 'hidden',
  },
  bubbleRow: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.xs },
  bubbleRowOwn: { justifyContent: 'flex-end' },
  bubbleRowFirst: { marginTop: spacing.sm },
  bubbleRowGrouped: { marginTop: 2 },
  senderAvatar: { width: 28, height: 28, borderRadius: 14, marginBottom: 2 },
  senderAvatarFallback: { backgroundColor: colors.brand100, alignItems: 'center', justifyContent: 'center' },
  senderAvatarInitial: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.xs, color: colors.brand700 },
  senderAvatarSpacer: { width: 28 },
  bubble: { maxWidth: '78%', borderRadius: radius.lg, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  bubbleOther: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.slate200, borderBottomLeftRadius: 4 },
  bubbleOwn: { backgroundColor: colors.brand600, borderBottomRightRadius: 4 },
  bubbleText: { fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.slate800 },
  bubbleTextOwn: { color: colors.white },
  bubbleDeletedText: { fontStyle: 'italic', opacity: 0.7 },
  attachmentImage: { width: 200, height: 200, borderRadius: radius.md, marginBottom: spacing.xs },
  // Black rather than the app's surfaces: a photo viewer wants the frame to
  // disappear, and this is the one place the light-only rule does not apply
  // because there is no chrome to be light.
  lightbox: { flex: 1, backgroundColor: 'rgba(0,0,0,0.94)', alignItems: 'center', justifyContent: 'center' },
  lightboxImage: { width: '100%', height: '100%' },
  docChip: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 48,
    backgroundColor: colors.white, borderRadius: radius.md,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm, marginBottom: spacing.xs,
  },
  docChipOwn: { backgroundColor: 'rgba(255,255,255,0.18)' },
  docName: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.sm, color: colors.slate800 },
  docNameOwn: { color: colors.white },
  docHint: { fontFamily: fonts.body, fontSize: 11, color: colors.slate500, marginTop: 1 },
  docHintOwn: { color: 'rgba(255,255,255,0.75)' },
  bubbleMeta: { flexDirection: 'row', alignItems: 'center', gap: 3, alignSelf: 'flex-end', marginTop: 4 },
  bubbleTime: { fontFamily: fonts.body, fontSize: 11, color: colors.slate500 },
  bubbleTimeOwn: { color: 'rgba(255,255,255,0.75)' },
  editingBanner: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.md, paddingVertical: spacing.xs,
    backgroundColor: colors.brand50, borderTopWidth: 1, borderTopColor: colors.brand100,
  },
  editingBannerText: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.xs, color: colors.brand700 },
  inputBar: {
    flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm,
    padding: spacing.sm, backgroundColor: colors.white, borderTopWidth: 1, borderTopColor: colors.slate200,
  },
  attachButton: { width: 40, height: 44, alignItems: 'center', justifyContent: 'center' },
  input: {
    flex: 1, borderWidth: 1, borderColor: colors.slate200, borderRadius: radius.lg,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm, maxHeight: 100, minHeight: 44,
    fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.slate800,
  },
  sendButton: { width: 44, height: 44, borderRadius: radius.full, backgroundColor: colors.brand600, alignItems: 'center', justifyContent: 'center' },
  disabled: { opacity: 0.5 },
})
