import { useEffect, useRef, useState } from 'react'
import { View, Text, TextInput, Pressable, FlatList, KeyboardAvoidingView, Platform, StyleSheet } from 'react-native'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { chatService } from '@services/chat.service'
import { useAuth } from '@features/auth/hooks/useAuth'
import { getSocket } from '@lib/socket'
import { colors } from '@theme/colors'
import { fonts, fontSizes } from '@theme/typography'
import { spacing, radius } from '@theme/spacing'

function chatTime(date) {
  return new Date(date).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
}

export default function ConversationScreen({ route, navigation }) {
  const { conversationId, other, otherRole } = route.params
  const { user } = useAuth()
  const qc = useQueryClient()
  const [input, setInput] = useState('')
  const [typing, setTyping] = useState(false)
  const typingTimer = useRef(null)
  const typingDebounce = useRef(null)

  useEffect(() => {
    navigation.setOptions({ title: other?.name || other?.email?.split('@')[0] || 'Chat' })
  }, [navigation, other])

  const { data: messages = [] } = useQuery({
    queryKey: ['chat-messages', conversationId],
    queryFn: () => chatService.messages(conversationId).then((r) => r.data),
    enabled: !!conversationId,
    refetchInterval: 10000,
  })

  const { mutate: send, isPending } = useMutation({
    mutationFn: (body) => chatService.sendMessage(conversationId, body),
    onSuccess: (res) => {
      qc.setQueryData(['chat-messages', conversationId], (old = []) => [...old, res.data])
      qc.invalidateQueries({ queryKey: ['conversations'] })
    },
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

    socket.on('message:new', onNewMessage)
    socket.on('typing', onTypingEvent)

    return () => {
      socket.emit('leave:conversation', conversationId)
      socket.off('message:new', onNewMessage)
      socket.off('typing', onTypingEvent)
    }
  }, [conversationId, user?.id, qc])

  function emitTyping() {
    if (typingDebounce.current) return
    getSocket()?.emit('typing', { conversationId })
    typingDebounce.current = setTimeout(() => { typingDebounce.current = null }, 2000)
  }

  function handleSend() {
    const body = input.trim()
    if (!body || isPending) return
    send(body)
    setInput('')
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
      <FlatList
        data={[...messages].reverse()}
        keyExtractor={(m) => m.id}
        inverted
        contentContainerStyle={styles.list}
        renderItem={({ item }) => {
          const isOwn = item.senderId === user?.id
          return (
            <View style={[styles.bubbleRow, isOwn && styles.bubbleRowOwn]}>
              <View style={[styles.bubble, isOwn ? styles.bubbleOwn : styles.bubbleOther]}>
                <Text style={[styles.bubbleText, isOwn && styles.bubbleTextOwn]}>{item.body}</Text>
                <Text style={[styles.bubbleTime, isOwn && styles.bubbleTimeOwn]}>{chatTime(item.createdAt)}</Text>
              </View>
            </View>
          )
        }}
        ListHeaderComponent={typing ? (
          <View style={styles.typingRow}>
            <Text style={styles.typingText}>{otherRole ?? 'They'} typing…</Text>
          </View>
        ) : null}
      />

      <View style={styles.inputBar}>
        <TextInput
          style={styles.input}
          value={input}
          onChangeText={(v) => { setInput(v); emitTyping() }}
          placeholder="Type a message..."
          placeholderTextColor={colors.slate400}
          multiline
        />
        <Pressable style={[styles.sendButton, (!input.trim() || isPending) && styles.disabled]} onPress={handleSend} disabled={!input.trim() || isPending}>
          <Text style={styles.sendButtonText}>Send</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.slate50 },
  list: { padding: spacing.md, flexGrow: 1 },
  typingRow: { paddingVertical: spacing.xs, paddingHorizontal: spacing.sm },
  typingText: { fontFamily: fonts.body, fontSize: fontSizes.xs, color: colors.slate400, fontStyle: 'italic' },
  bubbleRow: { flexDirection: 'row', marginVertical: 3 },
  bubbleRowOwn: { justifyContent: 'flex-end' },
  bubble: { maxWidth: '78%', borderRadius: radius.lg, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  bubbleOther: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.slate200, borderBottomLeftRadius: 4 },
  bubbleOwn: { backgroundColor: colors.brand600, borderBottomRightRadius: 4 },
  bubbleText: { fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.slate800 },
  bubbleTextOwn: { color: colors.white },
  bubbleTime: { fontFamily: fonts.body, fontSize: 10, color: colors.slate400, marginTop: 4, alignSelf: 'flex-end' },
  bubbleTimeOwn: { color: 'rgba(255,255,255,0.75)' },
  inputBar: {
    flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm,
    padding: spacing.sm, backgroundColor: colors.white, borderTopWidth: 1, borderTopColor: colors.slate200,
  },
  input: {
    flex: 1, borderWidth: 1, borderColor: colors.slate200, borderRadius: radius.lg,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm, maxHeight: 100,
    fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.slate800,
  },
  sendButton: { backgroundColor: colors.brand600, borderRadius: radius.full, paddingHorizontal: spacing.md, paddingVertical: spacing.sm + 2 },
  disabled: { opacity: 0.5 },
  sendButtonText: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.xs, color: colors.white },
})
