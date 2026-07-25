import { View, Text, Image, Pressable, StyleSheet, ActivityIndicator } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@features/auth/hooks/useAuth'
import { authService } from '@services/auth.service'
import { useUiStore } from '@store/uiStore'
import MenuItem from '@features/profile/components/MenuItem'
import Icon from '@components/common/Icon'
import { colors } from '@theme/colors'
import { fonts, fontSizes } from '@theme/typography'
import { spacing, radius } from '@theme/spacing'

const MENU_ITEMS = [
  ['Appointments', 'calendar', 'Appointments'],
  ['Leases', 'document', 'Rented'],
  ['Notifications', 'bell', 'Notifications'],
  ['Settings', 'settings', 'Settings'],
  ['Support', 'info', 'Support'],
]

export default function ProfileScreen({ navigation }) {
  const { user, signOut } = useAuth()
  const setHostMode = useUiStore((s) => s.setHostMode)

  const { data: profile, isLoading, isError, refetch } = useQuery({
    queryKey: ['me'],
    queryFn: () => authService.getMe().then((r) => r.data),
    enabled: !!user,
    staleTime: 0,
  })

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.card}>
        {profile?.avatarUrl ? (
          <Image source={{ uri: profile.avatarUrl }} style={styles.avatarImage} resizeMode="cover" />
        ) : (
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{(profile?.name || user?.email || '?')[0].toUpperCase()}</Text>
          </View>
        )}
        {isLoading ? (
          <ActivityIndicator color={colors.brand600} style={{ marginTop: spacing.sm }} />
        ) : isError ? (
          <>
            <Text style={styles.errorText}>Could not load your profile.</Text>
            <Pressable
              style={styles.retryButton}
              onPress={() => refetch()}
              accessibilityRole="button"
              accessibilityLabel="Retry loading profile"
            >
              <Text style={styles.retryText}>Retry</Text>
            </Pressable>
          </>
        ) : (
          <>
            <Text style={styles.name}>{profile?.name || 'StayOnMap user'}</Text>
            <Text style={styles.email}>{user?.email}</Text>
            <View style={styles.roleBadge}>
              <Icon name={profile?.role === 'OWNER' ? 'home' : 'key'} size={11} color={colors.brand700} />
              <Text style={styles.roleBadgeText}>{profile?.role ?? 'TENANT'}</Text>
            </View>
          </>
        )}
      </View>

      <View style={styles.menu}>
        {MENU_ITEMS.map(([route, icon, label]) => (
          <MenuItem key={route} icon={icon} label={label} onPress={() => navigation.navigate(route)} />
        ))}
        <MenuItem
          icon="home"
          label="Switch to host"
          onPress={() => setHostMode(true)}
        />
      </View>

      <Pressable
        style={styles.signOutButton}
        onPress={signOut}
        accessibilityRole="button"
        accessibilityLabel="Sign out"
      >
        <Icon name="logout" size={16} color={colors.danger} />
        <Text style={styles.signOutText}>Sign out</Text>
      </Pressable>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.slate50, padding: spacing.lg },
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
  avatarImage: {
    width: 72,
    height: 72,
    borderRadius: radius.full,
    backgroundColor: colors.slate100,
    marginBottom: spacing.md,
  },
  avatarText: { fontFamily: fonts.displayBold, fontSize: fontSizes.xxl, color: colors.brand700 },
  name: { fontFamily: fonts.displayBold, fontSize: fontSizes.xl, color: colors.slate800 },
  email: { fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.slate500, marginTop: spacing.xs },
  errorText: { fontFamily: fonts.bodyMedium, fontSize: fontSizes.sm, color: colors.slate600, marginTop: spacing.sm },
  retryButton: {
    minHeight: 44, borderRadius: radius.md, backgroundColor: colors.brand600,
    alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: spacing.lg, marginTop: spacing.sm,
  },
  retryText: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.sm, color: colors.white },
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
