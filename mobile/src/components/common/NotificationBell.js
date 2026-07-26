import { View, Text, Pressable, StyleSheet } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import { useQuery } from '@tanstack/react-query'
import { notificationService } from '@services/notification.service'
import { useAuth } from '@features/auth/hooks/useAuth'
import { useUiStore } from '@store/uiStore'
import Icon from './Icon'
import { colors } from '@theme/colors'
import { fonts } from '@theme/typography'
import { radius } from '@theme/spacing'

// The bell, for the header of whichever screen is home in the current mode.
// Web has had one in its Header since P1.1; mobile's notifications were
// reachable only by opening the account tab and scrolling to a menu row, so a
// real-time notification arrived with nothing on screen to show for it.
//
// Shares the `['notifications']` query key with NotificationsScreen, so the
// badge costs no extra request once that screen has been opened, and marking
// something read there updates the badge without a refetch.
export default function NotificationBell({ style }) {
  const navigation = useNavigation()
  const { user } = useAuth()
  const hostMode = useUiStore((s) => s.hostMode)

  const { data: notifications = [] } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => notificationService.list().then((r) => r.data),
    enabled: !!user,
    // Same cadence as the tab badges — often enough to feel live, rare enough
    // that a backgrounded app isn't polling every few seconds.
    refetchInterval: 60000,
  })

  const unread = notifications.filter((n) => !n.isRead).length

  // Notifications live in the ACCOUNT stack of each mode, so this is a
  // cross-tab jump. The tab names differ per mode ('Profile' vs 'HostProfile')
  // — hardcoding either breaks in the other, the same trap as Inbox/Chat.
  function open() {
    navigation.getParent()?.navigate(hostMode ? 'HostProfile' : 'Profile', { screen: 'Notifications' })
  }

  return (
    <Pressable
      style={[styles.button, style]}
      onPress={open}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={unread > 0 ? `Notifications, ${unread} unread` : 'Notifications'}
    >
      <Icon name="bell" size={18} color={colors.slate700} />
      {unread > 0 && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{unread > 9 ? '9+' : unread}</Text>
        </View>
      )}
    </Pressable>
  )
}

const styles = StyleSheet.create({
  button: {
    width: 40, height: 40, borderRadius: radius.full,
    borderWidth: 1, borderColor: colors.slate200, backgroundColor: colors.white,
    alignItems: 'center', justifyContent: 'center',
  },
  // Sits on the rim rather than inside: a count in the middle of a 40dp circle
  // would crowd the glyph it is annotating.
  badge: {
    position: 'absolute', top: -3, right: -3,
    minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 4,
    backgroundColor: colors.danger, borderWidth: 2, borderColor: colors.white,
    alignItems: 'center', justifyContent: 'center',
  },
  badgeText: { fontFamily: fonts.bodySemiBold, fontSize: 11, color: colors.white },
})
