import { Pressable, StyleSheet } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import { useQuery } from '@tanstack/react-query'
import { notificationService } from '@services/notification.service'
import { useAuth } from '@features/auth/hooks/useAuth'
import { useUiStore } from '@store/uiStore'
import Icon from './Icon'
import CountBadge from './CountBadge'
import { colors } from '@theme/colors'
import { radius } from '@theme/spacing'

// The bell, for the header of whichever screen is home in the current mode.
// Web has had one in its Header since P1.1; mobile's notifications were
// reachable only by opening the account tab and scrolling to a menu row, so a
// real-time notification arrived with nothing on screen to show for it.
//
// Shares the `['notifications', audience]` query key with NotificationsScreen,
// so the badge costs no extra request once that screen has been opened, and
// marking something read there updates the badge without a refetch. The
// audience is part of the key because the count has to match the list it opens
// — a bell that counts both hats over a list that shows one is the same lie the
// chat badge told.
export default function NotificationBell({ style }) {
  const navigation = useNavigation()
  const { user } = useAuth()
  const hostMode = useUiStore((s) => s.hostMode)
  const audience = hostMode ? 'OWNER' : 'TENANT'

  const { data: notifications = [] } = useQuery({
    queryKey: ['notifications', audience],
    queryFn: () => notificationService.list(audience).then((r) => r.data),
    enabled: !!user,
    // No interval: useRealtimeUpdates (RootNavigator) invalidates this key off
    // `notification:new` and on socket reconnect, and App.js re-invalidates on
    // foreground. A timer here was always both too slow and too often.
  })

  const unread = notifications.filter((n) => !n.isRead).length

  // Push it onto the CURRENT tab's stack, never cross-tab into the account
  // stack. It used to do the latter, with the account screen slipped in
  // underneath — so back from the map's bell went map → account → map, landing
  // on a screen the reader had never opened. Notifications belongs to wherever
  // you asked for it (AppTabs.js's NOTIFICATIONS_SCREEN is in every stack that
  // renders this button — add it there before putting a bell on a new screen).
  function open() {
    navigation.navigate('Notifications')
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
      <CountBadge count={unread} size="sm" max={9} tone={colors.danger} style={styles.badge} />
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
  // would crowd the glyph it is annotating. Size and shape belong to
  // CountBadge — this only says where it sits and that it is cut out of the
  // icon behind it.
  badge: {
    position: 'absolute', top: -3, right: -3,
    borderWidth: 2, borderColor: colors.white,
  },
})
