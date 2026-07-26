import { useEffect, useState } from 'react'
import { View, Text, FlatList, Pressable, ActivityIndicator, StyleSheet } from 'react-native'
import { Image } from 'expo-image'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useQuery } from '@tanstack/react-query'
import { chatService } from '@services/chat.service'
import { useAuth } from '@features/auth/hooks/useAuth'
import { useUiStore } from '@store/uiStore'
import { getSocket } from '@lib/socket'
import { imgUrl } from '@utils/format'
import Icon from '@components/common/Icon'
import ErrorState from '@components/common/ErrorState'
import ScreenHeader from '@components/common/ScreenHeader'
import { colors } from '@theme/colors'
import { fonts, fontSizes } from '@theme/typography'
import { spacing, radius } from '@theme/spacing'

function displayName(user) {
  return user?.name || user?.email?.split('@')[0] || 'Unknown'
}

function timeLabel(date) {
  const diff = Math.floor((Date.now() - new Date(date).getTime()) / 1000)
  if (diff < 60) return 'now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m`
  if (diff < 86400) return new Date(date).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
  const days = Math.floor(diff / 86400)
  return days === 1 ? 'Yesterday' : `${days}d`
}

export default function ConversationListScreen({ navigation }) {
  const { user } = useAuth()
  const hostMode = useUiStore((s) => s.hostMode)
  const [onlineUsers, setOnlineUsers] = useState(new Set())

  const { data: allConversations = [], isLoading, isError, refetch } = useQuery({
    queryKey: ['conversations'],
    queryFn: () => chatService.conversations().then((r) => r.data),
    refetchInterval: 15000,
  })

  // The inbox follows the renter/host mode toggle: host mode shows threads
  // where you're the owner (renters contacting you); renter mode shows threads
  // where you're the tenant (you contacting owners). Mirrors the web ChatPanel.
  const conversations = allConversations.filter((c) =>
    hostMode ? c.ownerId === user?.id : c.tenantId === user?.id,
  )

  useEffect(() => {
    const socket = getSocket()
    if (!socket) return
    function onOnline({ userId }) { setOnlineUsers((prev) => new Set([...prev, userId])) }
    function onOffline({ userId }) { setOnlineUsers((prev) => { const next = new Set(prev); next.delete(userId); return next }) }
    socket.on('user:online', onOnline)
    socket.on('user:offline', onOffline)
    return () => { socket.off('user:online', onOnline); socket.off('user:offline', onOffline) }
  }, [])

  // The tab is called "Inbox" in host mode and "Messages" in renter mode; the
  // native header this replaced said "Chat" in both, matching neither.
  const title = hostMode ? 'Inbox' : 'Messages'

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container} edges={[]}>
        <ScreenHeader title={title} />
        <View style={styles.centered}><ActivityIndicator color={colors.brand600} /></View>
      </SafeAreaView>
    )
  }

  if (isError) {
    return (
      <SafeAreaView style={styles.container} edges={[]}>
        <ScreenHeader title={title} />
        <ErrorState title="Couldn't load conversations" onRetry={refetch} />
      </SafeAreaView>
    )
  }

  if (!conversations.length) {
    return (
      <SafeAreaView style={styles.container} edges={[]}>
        <ScreenHeader title={title} />
        <View style={styles.centered}>
        <View style={styles.emptyIcon}>
          <Icon name="messageCircle" size={26} color={colors.brand600} />
        </View>
        <Text style={styles.emptyTitle}>
          {hostMode ? 'No messages from renters yet' : 'No conversations yet'}
        </Text>
        <Text style={styles.emptyBody}>
          {hostMode
            ? 'When a renter messages you about one of your listings, it will appear here.'
            : 'Start a chat from a property’s detail page.'}
        </Text>
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.container} edges={[]}>
      <ScreenHeader title={title} />
      <FlatList
        data={conversations}
        keyExtractor={(c) => c.id}
        renderItem={({ item: c }) => {
          const other = c.tenantId === user?.id ? c.owner : c.tenant
          const otherRole = c.tenantId === user?.id ? 'Owner' : 'Tenant'
          const lastMsg = c.messages?.[0]
          const unread = c._count?.messages ?? 0
          const isOnline = onlineUsers.has(other?.id)

          return (
            <Pressable
              style={styles.row}
              onPress={() => navigation.navigate('Conversation', { conversationId: c.id, other, otherRole })}
              accessibilityRole="button"
              accessibilityLabel={`Conversation with ${displayName(other)} about ${c.property?.title ?? 'a property'}${unread > 0 ? `, ${unread} unread` : ''}`}
            >
              <View>
                {other?.avatarUrl ? (
                  <Image source={{ uri: imgUrl(other?.avatarUrl) }} style={styles.avatar} contentFit="cover" cachePolicy="memory-disk" transition={200} />
                ) : (
                  <View style={[styles.avatar, styles.avatarFallback]}>
                    <Text style={styles.avatarInitial}>{displayName(other)[0]?.toUpperCase()}</Text>
                  </View>
                )}
                {isOnline && <View style={styles.onlineDot} />}
              </View>

              <View style={styles.rowBody}>
                <View style={styles.rowTop}>
                  <View style={styles.nameRow}>
                    <Text style={[styles.name, unread > 0 && styles.nameBold]} numberOfLines={1}>{displayName(other)}</Text>
                    <View style={[styles.roleBadge, otherRole === 'Owner' ? styles.roleBadgeOwner : styles.roleBadgeTenant]}>
                      <Text style={[styles.roleBadgeText, otherRole === 'Owner' ? styles.roleBadgeTextOwner : styles.roleBadgeTextTenant]}>{otherRole}</Text>
                    </View>
                  </View>
                  {lastMsg && <Text style={styles.time}>{timeLabel(lastMsg.createdAt)}</Text>}
                </View>
                <Text style={styles.propertyTitle} numberOfLines={1}>{c.property?.title}</Text>
                {lastMsg && (
                  <Text style={[styles.preview, unread > 0 && styles.previewUnread]} numberOfLines={1}>
                    {lastMsg.senderId === user?.id ? 'You: ' : ''}{lastMsg.body}
                  </Text>
                )}
              </View>

              {unread > 0 && (
                <View style={styles.unreadBadge}>
                  <Text style={styles.unreadBadgeText}>{unread > 9 ? '9+' : unread}</Text>
                </View>
              )}
            </Pressable>
          )
        }}
      />
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.slate50 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  emptyIcon: { width: 52, height: 52, borderRadius: radius.full, backgroundColor: colors.brand50, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.sm },
  emptyTitle: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.base, color: colors.slate700 },
  emptyBody: { fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.slate500, marginTop: spacing.xs, textAlign: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.slate100 },
  avatar: { width: 44, height: 44, borderRadius: radius.full },
  avatarFallback: { backgroundColor: colors.brand100, alignItems: 'center', justifyContent: 'center' },
  avatarInitial: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.base, color: colors.brand700 },
  onlineDot: { position: 'absolute', bottom: 0, right: 0, width: 12, height: 12, borderRadius: 6, backgroundColor: colors.success, borderWidth: 2, borderColor: colors.white },
  rowBody: { flex: 1, minWidth: 0 },
  rowTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1 },
  name: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.sm, color: colors.slate700, flexShrink: 1 },
  nameBold: { color: colors.slate900 },
  roleBadge: { paddingHorizontal: 5, paddingVertical: 1, borderRadius: 4 },
  roleBadgeOwner: { backgroundColor: colors.warning50 },
  roleBadgeTenant: { backgroundColor: '#EFF6FF' },
  roleBadgeText: { fontSize: 11, fontFamily: fonts.bodySemiBold },
  roleBadgeTextOwner: { color: '#D97706' },
  roleBadgeTextTenant: { color: '#2563EB' },
  time: { fontFamily: fonts.body, fontSize: 11, color: colors.slate500 },
  propertyTitle: { fontFamily: fonts.body, fontSize: fontSizes.xs, color: colors.slate500, marginTop: 1 },
  preview: { fontFamily: fonts.body, fontSize: fontSizes.xs, color: colors.slate500, marginTop: 2 },
  previewUnread: { color: colors.slate700, fontFamily: fonts.bodyMedium },
  unreadBadge: { minWidth: 20, height: 20, borderRadius: 10, backgroundColor: colors.brand500, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5 },
  unreadBadgeText: { fontFamily: fonts.bodySemiBold, fontSize: 11, color: colors.white },
})
