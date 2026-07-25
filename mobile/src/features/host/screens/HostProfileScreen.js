import { View, Text, Pressable, StyleSheet, ActivityIndicator } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@features/auth/hooks/useAuth'
import { authService } from '@services/auth.service'
import { useUiStore } from '@store/uiStore'
import MenuItem from '@features/profile/components/MenuItem'
import Icon from '@components/common/Icon'
import ScreenHeader from '@components/common/ScreenHeader'
import { colors } from '@theme/colors'
import { fonts, fontSizes } from '@theme/typography'
import { spacing, radius } from '@theme/spacing'

export default function HostProfileScreen({ navigation }) {
  const { user, signOut } = useAuth()
  const setHostMode = useUiStore((s) => s.setHostMode)

  const { data: profile, isLoading } = useQuery({
    queryKey: ['me'],
    queryFn: () => authService.getMe().then((r) => r.data),
    enabled: !!user,
    staleTime: 0,
  })

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScreenHeader title="Profile" />

      {/* The screen's padding moved off the container and onto this wrapper so
          ScreenHeader spans the full width like every other screen's header,
          instead of being double-indented by the container's own padding. */}
      <View style={styles.body}>
        <View style={styles.card}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{(profile?.name || user?.email || '?')[0].toUpperCase()}</Text>
          </View>
          {isLoading ? (
            <ActivityIndicator color={colors.brand600} style={{ marginTop: spacing.sm }} />
          ) : (
            <>
              <Text style={styles.name}>{profile?.name || 'StayOnMap host'}</Text>
              <Text style={styles.email}>{user?.email}</Text>
              <View style={styles.roleBadge}>
                <Icon name="home" size={11} color={colors.brand700} />
                <Text style={styles.roleBadgeText}>HOST</Text>
              </View>
            </>
          )}
        </View>

        <View style={styles.menu}>
          <MenuItem icon="bell" label="Notifications" onPress={() => navigation.navigate('Notifications')} />
          <MenuItem icon="settings" label="Settings" onPress={() => navigation.navigate('Settings')} />
          <MenuItem icon="info" label="Support" onPress={() => navigation.navigate('Support')} />
          <MenuItem icon="map" label="Switch to renter" onPress={() => setHostMode(false)} />
        </View>

        <Pressable style={styles.signOutButton} onPress={signOut} accessibilityRole="button">
          <Icon name="logout" size={16} color={colors.danger} />
          <Text style={styles.signOutText}>Sign out</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.slate50 },
  body: { flex: 1, paddingHorizontal: spacing.lg, paddingBottom: spacing.lg },
  card: { alignItems: 'center', paddingVertical: spacing.xl },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: radius.full,
    backgroundColor: colors.brand100,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  avatarText: { fontFamily: fonts.displayBold, fontSize: fontSizes.xxl, color: colors.brand700 },
  name: { fontFamily: fonts.displayBold, fontSize: fontSizes.xl, color: colors.slate800 },
  email: { fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.slate500, marginTop: spacing.xs },
  roleBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    marginTop: spacing.sm,
    backgroundColor: colors.brand50,
    borderRadius: radius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
  },
  roleBadgeText: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.xs, color: colors.brand700 },
  menu: { borderTopWidth: 1, borderTopColor: colors.slate100 },
  signOutButton: {
    flexDirection: 'row', gap: 6, justifyContent: 'center',
    marginTop: 'auto',
    borderWidth: 1,
    borderColor: colors.slate200,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  signOutText: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.base, color: colors.danger },
})
