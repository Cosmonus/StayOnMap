import { useEffect, useMemo, useRef, useState } from 'react'
import { View, Text, TextInput, Image, Pressable, FlatList, KeyboardAvoidingView, Platform, ActivityIndicator, Alert, StyleSheet } from 'react-native'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import * as ImagePicker from 'expo-image-picker'
import { chatService } from '@services/chat.service'
import { uploadService } from '@services/upload.service'
import { useAuth } from '@features/auth/hooks/useAuth'
import { useUiStore } from '@store/uiStore'
import { getSocket } from '@lib/socket'
import { imgUrl } from '@utils/format'
import Icon from '@components/common/Icon'
import ErrorState from '@components/common/ErrorState'
import ReadReceipt from '../components/ReadReceipt'
import ChatPropertyCard from '../components/ChatPropertyCard'
import { colors } from '@theme/colors'
import { fonts, fontSizes } from '@theme/typography'
import { spacing, radius } from '@theme/spacing'

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
    return <Image source={{ uri: imgUrl(sender.avatarUrl) }} style={styles.senderAvatar} />
  }
  return (
    <View style={[styles.senderAvatar, styles.senderAvatarFallback]}>
      <Text style={styles.senderAvatarInitial}>{displayName(sender)[0]?.toUpperCase()}</Text>
    </View>
  )
}

export default function ConversationScreen({ route, navigation }) {
  const { conversationId, other: otherParam, otherRole } = route.params
  const { user } = useAuth()
  const hostMode = useUiStore((s) => s.hostMode)
  const qc = useQueryClient()
  const [input, setInput] = useState('')
  const [typing, setTyping] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [msgSearch, setMsgSearch] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [editingId, setEditingId] = useState(null)
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
  const other = otherParam ?? (conversation ? (conversation.tenantId === user?.id ? conversation.owner : conversation.tenant) : null)
  const property = conversation?.property

  useEffect(() => {
    navigation.setOptions({
      title: other?.name || other?.email?.split('@')[0] || 'Chat',
      headerRight: () => (
        <Pressable
          style={styles.headerSearchButton}
          onPress={() => { setSearchOpen((o) => !o); setMsgSearch('') }}
          accessibilityRole="button"
          accessibilityLabel={searchOpen ? 'Close message search' : 'Search messages'}
          accessibilityState={{ expanded: searchOpen }}
          hitSlop={6}
        >
          <Icon name={searchOpen ? 'close' : 'search'} size={20} color={searchOpen ? colors.brand600 : colors.slate500} />
        </Pressable>
      ),
    })
  }, [navigation, other, searchOpen])

  // Debounce the search box 300ms before hitting the backend search endpoint
  useEffect(() => {
    const t = setTimeout(() => setSearchQuery(msgSearch.trim()), 300)
    return () => clearTimeout(t)
  }, [msgSearch])

  const { data: messages = [], isLoading, isError, refetch } = useQuery({
    queryKey: ['chat-messages', conversationId],
    queryFn: () => chatService.messages(conversationId).then((r) => r.data),
    enabled: !!conversationId,
  })

  const { data: searchResults = [] } = useQuery({
    queryKey: ['chat-search', conversationId, searchQuery],
    queryFn: () => chatService.searchMessages(conversationId, searchQuery).then((r) => r.data.slice().reverse()),
    enabled: !!conversationId && searchQuery.length > 0,
  })

  const { mutate: send, isPending } = useMutation({
    mutationFn: ({ body, attachmentUrl }) => chatService.sendMessage(conversationId, body, attachmentUrl),
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
      if (msg.senderId !== user?.id) {
        qc.setQueryData(['chat-messages', conversationId], (old = []) => {
          if (old.some((m) => m.id === msg.id)) return old
          return [...old, msg]
        })
      }
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
  }, [conversationId, user?.id, qc])

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

  function handleLongPressOwn(item) {
    if (item.deletedAt) return
    Alert.alert('Message options', undefined, [
      { text: 'Edit', onPress: () => { setEditingId(item.id); setInput(item.body) } },
      { text: 'Delete', style: 'destructive', onPress: () => confirmDelete(item.id) },
      { text: 'Cancel', style: 'cancel' },
    ])
  }

  function openProperty() {
    if (!property?.id) return
    // ChatStack has no PropertyDetail screen — hop to a tab stack that does
    // (host mode's Chat tab is 'Inbox' and has no 'Explore' sibling).
    navigation.getParent()?.navigate(hostMode ? 'MyListing' : 'Explore', {
      screen: 'PropertyDetail',
      params: { propertyId: property.id },
    })
  }

  // Search hits the backend once the box settles (300ms debounce); otherwise
  // show the live-loaded page. Both are annotated chronologically with
  // date-separator + grouping flags, then reversed for the inverted list.
  const listData = useMemo(() => {
    const visible = searchQuery.length > 0 ? searchResults : messages

    let lastDate = null
    const annotated = visible.map((msg, i) => {
      const msgDate = dateSeparator(msg.createdAt)
      const showDate = msgDate !== lastDate
      lastDate = msgDate
      const prev = visible[i - 1]
      const isGrouped = !showDate && !!prev && prev.senderId === msg.senderId &&
        (new Date(msg.createdAt) - new Date(prev.createdAt)) < 120000
      return { ...msg, _dateLabel: showDate ? msgDate : null, _isGrouped: isGrouped }
    })
    return annotated.reverse()
  }, [messages, searchResults, searchQuery])

  const resultCount = searchQuery.length > 0 ? listData.length : null

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
      {searchOpen && (
        <View style={styles.searchBar}>
          <Icon name="search" size={16} color={colors.slate400} />
          <TextInput
            style={styles.searchInput}
            value={msgSearch}
            onChangeText={setMsgSearch}
            placeholder="Search messages..."
            placeholderTextColor={colors.slate400}
            autoFocus
            accessibilityLabel="Search messages"
          />
          {resultCount !== null && (
            <Text style={styles.searchCount}>{resultCount} result{resultCount !== 1 ? 's' : ''}</Text>
          )}
        </View>
      )}

      {isLoading ? (
        <View style={styles.center}><ActivityIndicator color={colors.brand600} /></View>
      ) : isError ? (
        <ErrorState title="Couldn't load messages" onRetry={refetch} />
      ) : (
        <FlatList
          data={listData}
          keyExtractor={(m) => m.id}
          inverted
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
                        {item.attachmentUrl && (
                          <Image source={{ uri: item.attachmentUrl }} style={styles.attachmentImage} resizeMode="cover" />
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
          ListFooterComponent={
            // Inverted list: the footer renders at the visual top of the chat.
            <ChatPropertyCard property={property} onPress={openProperty} />
          }
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
          placeholderTextColor={colors.slate400}
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
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.slate50 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  headerSearchButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  searchBar: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.xs,
    backgroundColor: colors.white, borderBottomWidth: 1, borderBottomColor: colors.slate100,
    paddingHorizontal: spacing.md, paddingVertical: spacing.xs,
  },
  searchInput: { flex: 1, minHeight: 40, fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.slate800 },
  searchCount: { fontFamily: fonts.body, fontSize: 11, color: colors.slate400 },
  list: { padding: spacing.md, flexGrow: 1 },
  typingRow: { paddingVertical: spacing.xs, paddingHorizontal: spacing.sm },
  typingText: { fontFamily: fonts.body, fontSize: fontSizes.xs, color: colors.slate400, fontStyle: 'italic' },
  noResults: { paddingVertical: spacing.xl, alignItems: 'center', transform: [{ scaleY: -1 }] },
  noResultsText: { fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.slate400 },
  dateRow: { alignItems: 'center', marginVertical: spacing.sm },
  dateLabel: {
    fontFamily: fonts.bodySemiBold, fontSize: 11, color: colors.slate400,
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
  bubbleMeta: { flexDirection: 'row', alignItems: 'center', gap: 3, alignSelf: 'flex-end', marginTop: 4 },
  bubbleTime: { fontFamily: fonts.body, fontSize: 10, color: colors.slate400 },
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
