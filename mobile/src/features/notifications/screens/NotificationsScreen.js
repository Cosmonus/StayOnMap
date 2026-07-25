import { useEffect, useMemo } from 'react'
import { View, Text, SectionList, Pressable, StyleSheet } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { notificationService } from '@services/notification.service'
import { getSocket } from '@lib/socket'
import Icon from '@components/common/Icon'
import ErrorState from '@components/common/ErrorState'
import { colors } from '@theme/colors'
import { fonts, fontSizes } from '@theme/typography'
import { spacing, radius } from '@theme/spacing'

const TYPE_ICON = {
  APPOINTMENT_REQUEST: 'calendar', APPOINTMENT_STATUS: 'calendar',
  APPOINTMENT_ACCEPTED: 'calendar', APPOINTMENT_REJECTED: 'calendar',
  REPORT_SUBMITTED: 'alertTriangle', REPORT_UPDATE: 'alertTriangle',
  VERIFICATION_UPDATE: 'shieldCheck', TRUST_ALERT: 'shield',
  LEASE_OFFERED: 'document', LEASE_SIGNED: 'document', LEASE_REJECTED: 'document',
  SYSTEM: 'info', MESSAGE: 'messageCircle',
}

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

// Mirrors web NotificationCenter's dateGroup()
function dateGroup(date) {
  const d = new Date(date)
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)
  if (d.toDateString() === today.toDateString()) return 'Today'
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday'
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })
}

// Owns its own socket subscription — a mobile screen can't assume another
// mounted component (like web's NotificationBell) is already listening.
export default function NotificationsScreen({ navigation }) {
  const qc = useQueryClient()

  const { data: notifications = [], isLoading, isError, refetch, isRefetching } = useQuery({
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

  // Group under Today / Yesterday / date headers — same buckets as web's
  // NotificationCenter (list already arrives newest-first).
  const sections = useMemo(() => {
    const out = []
    for (const n of notifications) {
      const label = dateGroup(n.createdAt)
      if (out.length === 0 || out[out.length - 1].title !== label) {
        out.push({ title: label, data: [n] })
      } else {
        out[out.length - 1].data.push(n)
      }
    }
    return out
  }, [notifications])

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Pressable
            onPress={() => navigation.goBack()}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <Icon name="chevronLeft" size={20} color={colors.slate800} />
          </Pressable>
          <View style={styles.headerTitleRow}>
            <Icon name="bell" size={20} color={colors.slate800} />
            <View>
              <Text style={styles.headerTitle}>Notifications</Text>
              <Text style={styles.headerSub}>{unreadCount > 0 ? `${unreadCount} unread` : 'All caught up'}</Text>
            </View>
          </View>
        </View>
        {unreadCount > 0 && (
          <Pressable
            style={styles.markAllButton}
            onPress={() => markAll()}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityLabel="Mark all notifications as read"
          >
            <Text style={styles.markAllButtonText}>Mark all read</Text>
          </Pressable>
        )}
      </View>

      {isError ? (
        <ErrorState title="Couldn't load notifications" onRetry={refetch} />
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(n) => n.id}
          contentContainerStyle={styles.list}
          stickySectionHeadersEnabled={false}
          refreshing={isRefetching}
          onRefresh={refetch}
          renderSectionHeader={({ section }) => (
            <Text style={styles.sectionHeader}>{section.title}</Text>
          )}
          ListEmptyComponent={isLoading ? null : (
            <View style={styles.empty}>
              <View style={styles.emptyIcon}>
                <Icon name="bell" size={24} color={colors.slate500} />
              </View>
              <Text style={styles.emptyTitle}>No notifications</Text>
              <Text style={styles.emptyBody}>Appointment updates and messages will show up here.</Text>
            </View>
          )}
          renderItem={({ item: n }) => (
            <Pressable
              style={[styles.row, !n.isRead && styles.rowUnread]}
              onPress={() => { if (!n.isRead) markOne(n.id) }}
              accessibilityRole="button"
              accessibilityLabel={`${n.isRead ? '' : 'Unread. '}${n.title}. ${n.body}`}
              accessibilityHint={n.isRead ? undefined : 'Marks this notification as read'}
            >
              <View style={styles.rowIcon}>
                <Icon name={TYPE_ICON[n.type] ?? 'bell'} size={16} color={colors.brand600} />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <View style={styles.rowTop}>
                  <View style={styles.titleRow}>
                    {!n.isRead && <View style={styles.unreadDot} />}
                    <Text style={[styles.title, !n.isRead && styles.titleUnread]} numberOfLines={2}>{n.title}</Text>
                  </View>
                  <Text style={styles.time}>{timeAgo(n.createdAt)}</Text>
                </View>
                <Text style={styles.body} numberOfLines={3}>{n.body}</Text>
              </View>
            </Pressable>
          )}
        />
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.slate50 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.sm },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  headerTitleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  headerTitle: { fontFamily: fonts.displayBold, fontSize: fontSizes.xl, color: colors.slate800 },
  headerSub: { fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.slate500, marginTop: 2 },
  markAllButton: { backgroundColor: colors.brand50, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  markAllButtonText: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.xs, color: colors.brand600 },
  list: { padding: spacing.lg, paddingTop: spacing.xs },
  sectionHeader: {
    fontFamily: fonts.bodySemiBold, fontSize: 11, color: colors.slate500,
    textTransform: 'uppercase', letterSpacing: 0.8,
    paddingTop: spacing.md, paddingBottom: spacing.sm, paddingHorizontal: spacing.xs,
  },
  row: { flexDirection: 'row', gap: spacing.sm, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.slate100, borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.sm },
  rowUnread: { backgroundColor: colors.brand50, borderColor: colors.brand100 },
  rowIcon: { width: 32, height: 32, borderRadius: radius.full, backgroundColor: colors.brand50, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  rowTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: spacing.sm },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1 },
  unreadDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.brand500 },
  title: { fontFamily: fonts.bodyMedium, fontSize: fontSizes.sm, color: colors.slate700, flexShrink: 1 },
  titleUnread: { fontFamily: fonts.bodySemiBold, color: colors.slate900 },
  time: { fontFamily: fonts.body, fontSize: 11, color: colors.slate500 },
  body: { fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.slate500, marginTop: spacing.xs, lineHeight: 20 },
  empty: { alignItems: 'center', paddingVertical: spacing.xxl },
  emptyIcon: { width: 52, height: 52, borderRadius: radius.full, backgroundColor: colors.slate100, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.sm },
  emptyTitle: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.base, color: colors.slate700 },
  emptyBody: { fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.slate500, marginTop: spacing.xs, textAlign: 'center', maxWidth: 260 },
})
