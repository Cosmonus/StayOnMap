import { useEffect } from 'react'
import { View, Text, FlatList, Pressable, StyleSheet } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { notificationService } from '@services/notification.service'
import { getSocket } from '@lib/socket'
import { colors } from '@theme/colors'
import { fonts, fontSizes } from '@theme/typography'
import { spacing, radius } from '@theme/spacing'

function timeAgo(date) {
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000)
  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days === 1) return 'Yesterday'
  if (days < 7) return `${days}d ago`
  return new Date(date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
}

// Owns its own socket subscription — a mobile screen can't assume another
// mounted component (like web's NotificationBell) is already listening.
export default function NotificationsScreen() {
  const qc = useQueryClient()

  const { data: notifications = [], isLoading } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => notificationService.list().then((r) => r.data),
    refetchInterval: 60000,
  })

  useEffect(() => {
    const socket = getSocket()
    if (!socket) return
    function onNew(notif) {
      qc.setQueryData(['notifications'], (old = []) => [notif, ...(old ?? [])])
    }
    socket.on('notification:new', onNew)
    return () => socket.off('notification:new', onNew)
  }, [qc])

  const { mutate: markOne } = useMutation({
    mutationFn: (id) => notificationService.markOne(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  })

  const { mutate: markAll } = useMutation({
    mutationFn: () => notificationService.markAll(),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  })

  const unreadCount = notifications.filter((n) => !n.isRead).length

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Notifications</Text>
          <Text style={styles.headerSub}>{unreadCount > 0 ? `${unreadCount} unread` : 'All caught up'}</Text>
        </View>
        {unreadCount > 0 && (
          <Pressable style={styles.markAllButton} onPress={() => markAll()}>
            <Text style={styles.markAllButtonText}>Mark all read</Text>
          </Pressable>
        )}
      </View>

      <FlatList
        data={notifications}
        keyExtractor={(n) => n.id}
        contentContainerStyle={styles.list}
        refreshing={isLoading}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>No notifications</Text>
            <Text style={styles.emptyBody}>Appointment updates and messages will show up here.</Text>
          </View>
        }
        renderItem={({ item: n }) => (
          <Pressable
            style={[styles.row, !n.isRead && styles.rowUnread]}
            onPress={() => { if (!n.isRead) markOne(n.id) }}
          >
            <View style={styles.rowTop}>
              <View style={styles.titleRow}>
                {!n.isRead && <View style={styles.unreadDot} />}
                <Text style={[styles.title, !n.isRead && styles.titleUnread]} numberOfLines={2}>{n.title}</Text>
              </View>
              <Text style={styles.time}>{timeAgo(n.createdAt)}</Text>
            </View>
            <Text style={styles.body} numberOfLines={3}>{n.body}</Text>
          </Pressable>
        )}
      />
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.slate50 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.sm },
  headerTitle: { fontFamily: fonts.displayBold, fontSize: fontSizes.xl, color: colors.slate800 },
  headerSub: { fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.slate400, marginTop: 2 },
  markAllButton: { backgroundColor: '#ECFDF5', borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  markAllButtonText: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.xs, color: '#059669' },
  list: { padding: spacing.lg, gap: spacing.sm },
  row: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.slate100, borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.sm },
  rowUnread: { backgroundColor: colors.brand50, borderColor: colors.brand100 },
  rowTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: spacing.sm },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1 },
  unreadDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.brand500 },
  title: { fontFamily: fonts.bodyMedium, fontSize: fontSizes.sm, color: colors.slate700, flexShrink: 1 },
  titleUnread: { fontFamily: fonts.bodySemiBold, color: colors.slate900 },
  time: { fontFamily: fonts.body, fontSize: 11, color: colors.slate400 },
  body: { fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.slate500, marginTop: spacing.xs, lineHeight: 20 },
  empty: { alignItems: 'center', paddingVertical: spacing.xxl },
  emptyTitle: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.base, color: colors.slate700 },
  emptyBody: { fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.slate400, marginTop: spacing.xs, textAlign: 'center', maxWidth: 260 },
})
