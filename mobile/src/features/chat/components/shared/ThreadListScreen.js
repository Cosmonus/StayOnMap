import { useEffect, useState } from 'react'
import { View, Text, FlatList, Pressable, ActivityIndicator, StyleSheet } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { chatService } from '@services/chat.service'
import { notificationService } from '@services/notification.service'
import { useAuth } from '@features/auth/hooks/useAuth'
import { getSocket } from '@lib/socket'
import Icon from '@components/common/Icon'
import ErrorState from '@components/common/ErrorState'
import ScreenHeader from '@components/common/ScreenHeader'
import { colors } from '@theme/colors'
import { fonts, fontSizes } from '@theme/typography'
import { spacing, radius } from '@theme/spacing'
import ConversationRow from './ConversationRow'

// The shell both thread lists share: one conversations query, presence, and
// the loading / error / empty / list states. Mirrors web's ChatSurface.
//
// It does not know which hat it is serving. `side` is the only place the
// partition lives, and every word on screen comes from the caller — that is
// what makes TenantMessagesScreen and OwnerInboxScreen two screens rather than
// one screen with a flag.
export default function ThreadListScreen({ navigation, side, title, counterpartRole, empty }) {
  const { user } = useAuth()
  const qc = useQueryClient()
  const [onlineUsers, setOnlineUsers] = useState(new Set())

  const { data: allConversations = [], isLoading, isError, refetch } = useQuery({
    queryKey: ['conversations'],
    queryFn: () => chatService.conversations().then((r) => r.data),
    refetchInterval: 15000,
  })

  // Opening the inbox is seeing that these messages exist, so the notification
  // that announced them has done its job — the list itself now says which
  // threads are unread, per row, which the bell cannot. Web has cleared them at
  // this point since the audience split (DashboardPage's messages section) and
  // mobile never did, so a chat notification sat unread on the bell long after
  // the thread had been read.
  //
  // Only THIS hat's: the list you opened shows one side's threads, so it cannot
  // have caught you up on the other's.
  useEffect(() => {
    notificationService.markAllByType('MESSAGE', side === 'owner' ? 'OWNER' : 'TENANT')
      .then(() => {
        qc.invalidateQueries({ queryKey: ['notifications'] })
        qc.invalidateQueries({ queryKey: ['notification-unread'] })
      })
      .catch(() => {})
  }, [side, qc])

  const conversations = allConversations.filter((c) =>
    side === 'owner' ? c.ownerId === user?.id : c.tenantId === user?.id,
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
          <Text style={styles.emptyTitle}>{empty.title}</Text>
          <Text style={styles.emptyBody}>{empty.body}</Text>
          {empty.actionLabel && (
            <Pressable
              style={styles.emptyButton}
              onPress={empty.onAction}
              accessibilityRole="button"
              accessibilityLabel={empty.actionLabel}
            >
              <Text style={styles.emptyButtonText}>{empty.actionLabel}</Text>
            </Pressable>
          )}
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
          const other = side === 'owner' ? c.tenant : c.owner
          return (
            <ConversationRow
              conversation={c}
              other={other}
              userId={user?.id}
              isOnline={onlineUsers.has(other?.id)}
              onPress={() => navigation.navigate('Conversation', {
                conversationId: c.id,
                other,
                otherRole: counterpartRole,
              })}
            />
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
  emptyButton: {
    marginTop: spacing.lg, minHeight: 48, justifyContent: 'center',
    paddingHorizontal: spacing.xl, borderRadius: radius.md, backgroundColor: colors.brand600,
  },
  emptyButtonText: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.sm, color: colors.white },
})
