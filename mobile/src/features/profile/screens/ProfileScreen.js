import { View, Text, Pressable, StyleSheet, ActivityIndicator } from 'react-native'
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

  const { data: profile, isLoading } = useQuery({
    queryKey: ['me'],
    queryFn: async () => {
      try {
        return await authService.getMe().then((r) => r.data)
      } catch (err) {
        if (err?.error === 'PROFILE_NOT_FOUND') {
          await authService.syncProfile({})
          return authService.getMe().then((r) => r.data)
        }
        throw err
      }
    },
    enabled: !!user,
    staleTime: 0,
  })

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.card}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{(profile?.name || user?.email || '?')[0].toUpperCase()}</Text>
        </View>
        {isLoading ? (
          <ActivityIndicator color={colors.brand600} style={{ marginTop: spacing.sm }} />
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

      <Pressable style={styles.signOutButton} onPress={signOut}>
        <Icon name="logout" size={16} color={colors.danger} />
        <Text style={styles.signOutText}>Sign out</Text>
      </Pressable>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.white, padding: spacing.lg },
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
  email: { fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.slate400, marginTop: spacing.xs },
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
