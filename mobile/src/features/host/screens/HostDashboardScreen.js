import { View, Text, Pressable, ScrollView, ActivityIndicator, StyleSheet } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@features/auth/hooks/useAuth'
import { authService } from '@services/auth.service'
import { propertyService } from '@services/property.service'
import Icon from '@components/common/Icon'
import NotificationBell from '@components/common/NotificationBell'
import { colors } from '@theme/colors'
import { fonts, fontSizes } from '@theme/typography'
import { spacing, radius } from '@theme/spacing'

function StatTile({ label, value }) {
  return (
    <View style={styles.statTile}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  )
}

export default function HostDashboardScreen({ navigation }) {
  const { user } = useAuth()

  const { isLoading: loadingProfile } = useQuery({
    queryKey: ['me'],
    queryFn: () => authService.getMe().then((r) => r.data),
    enabled: !!user,
    staleTime: 0,
  })

  const { data: listings = [], isLoading: loadingListings } = useQuery({
    queryKey: ['my-listings'],
    queryFn: () => propertyService.getMyListings().then((r) => r.data),
    enabled: !!user,
  })

  const stats = [
    { label: 'My listings', value: listings.length },
    { label: 'Active', value: listings.filter((l) => l.status === 'ACTIVE').length },
    { label: 'Pending review', value: listings.filter((l) => l.status === 'PENDING').length },
    { label: 'Drafts', value: listings.filter((l) => l.status === 'DRAFT').length },
  ]

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.titleRow}>
          <Text style={styles.title}>Dashboard</Text>
          <NotificationBell />
        </View>
        <Text style={styles.subtitle}>Welcome back — here&apos;s your overview.</Text>

        {loadingProfile || loadingListings ? (
          <ActivityIndicator color={colors.brand600} style={{ marginTop: spacing.xl }} />
        ) : (
          <View style={styles.statsGrid}>
            {stats.map((s) => (
              <StatTile key={s.label} label={s.label} value={s.value} />
            ))}
          </View>
        )}

        <Pressable
          style={styles.quickAction}
          onPress={() => navigation.getParent()?.navigate('MyListing')}
          accessibilityRole="button"
        >
          <View style={styles.quickActionIcon}>
            <Icon name="plus" size={16} color={colors.white} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.quickActionTitle}>List a property</Text>
            <Text style={styles.quickActionBody}>Add a new rental to StayOnMap</Text>
          </View>
        </Pressable>

        <Pressable style={styles.quickAction} onPress={() => navigation.navigate('Calendar')} accessibilityRole="button">
          <View style={[styles.quickActionIcon, styles.quickActionIconAlt]}>
            <Icon name="calendar" size={16} color={colors.white} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.quickActionTitle}>View calendar</Text>
            <Text style={styles.quickActionBody}>Appointment and lease dates at a glance</Text>
          </View>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.slate50 },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontFamily: fonts.displayBold, fontSize: fontSizes.xl, color: colors.slate800 },
  subtitle: { fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.slate500, marginTop: 2, marginBottom: spacing.lg },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  statTile: {
    width: '47%', backgroundColor: colors.white, borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.slate100, padding: spacing.md,
  },
  statLabel: { fontFamily: fonts.bodyMedium, fontSize: fontSizes.xs, color: colors.slate500, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: spacing.xs },
  statValue: { fontFamily: fonts.displayBold, fontSize: fontSizes.xxl, color: colors.slate800 },
  quickAction: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    backgroundColor: colors.white, borderWidth: 1, borderColor: colors.slate200, borderRadius: radius.lg,
    padding: spacing.md, marginTop: spacing.lg,
  },
  quickActionIcon: { width: 40, height: 40, borderRadius: radius.md, backgroundColor: colors.black, alignItems: 'center', justifyContent: 'center' },
  quickActionIconAlt: { backgroundColor: colors.brand600 },
  quickActionTitle: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.sm, color: colors.slate800 },
  quickActionBody: { fontFamily: fonts.body, fontSize: fontSizes.xs, color: colors.slate500, marginTop: 1 },
})
