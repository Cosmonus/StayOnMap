import { View, Text, Pressable, StyleSheet } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import Icon from './Icon'
import { useUnreadNotifications } from '@features/notifications/useUnreadNotifications'
import { useUiStore } from '@store/uiStore'
import { colors } from '@theme/colors'
import { fonts } from '@theme/typography'
import { radius } from '@theme/spacing'

// Notifications live inside the Profile stack in BOTH tab sets, but under a
// different tab name per mode — the same branch navigationRef.js makes for
// push taps. Getting this wrong navigates to a route that doesn't exist in the
// current tab set and silently does nothing.
const NOTIFICATIONS_ROUTE = { renter: 'Profile', host: 'HostProfile' }

export default function NotificationBell({ color = colors.slate700, size = 18 }) {
  const navigation = useNavigation()
  const hostMode = useUiStore((s) => s.hostMode)
  const unread = useUnreadNotifications()

  return (
    <Pressable
      style={styles.button}
      hitSlop={8}
      onPress={() =>
        navigation.navigate(NOTIFICATIONS_ROUTE[hostMode ? 'host' : 'renter'], { screen: 'Notifications' })
      }
      accessibilityRole="button"
      accessibilityLabel={unread > 0 ? `Notifications, ${unread} unread` : 'Notifications'}
    >
      <Icon name="bell" size={size} color={color} />
      {unread > 0 && (
        <View style={styles.badge}>
          <Text style={styles.badgeText} numberOfLines={1}>{unread > 99 ? '99+' : unread}</Text>
        </View>
      )}
    </Pressable>
  )
}

const styles = StyleSheet.create({
  // 36x36 with hitSlop 8 clears the 48dp Android target minimum.
  button: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  badge: {
    position: 'absolute', top: 2, right: 2,
    minWidth: 16, height: 16, paddingHorizontal: 4,
    borderRadius: radius.full, backgroundColor: colors.danger,
    alignItems: 'center', justifyContent: 'center',
  },
  badgeText: { fontFamily: fonts.bodySemiBold, fontSize: 11, color: colors.white },
})
