import { View, Text, Pressable, ActivityIndicator, StyleSheet } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { userService } from '@services/user.service'
import Icon from '@components/common/Icon'
import { colors } from '@theme/colors'
import { fonts, fontSizes } from '@theme/typography'
import { spacing, radius } from '@theme/spacing'

export default function SettingsScreen({ navigation }) {
  const qc = useQueryClient()

  const { data: settings, isLoading } = useQuery({
    queryKey: ['user-settings'],
    queryFn: () => userService.getSettings().then((r) => r.data),
  })

  const mutation = useMutation({
    mutationFn: (pushNotifs) => userService.updateProfile({ pushNotifs }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['user-settings'] }),
  })

  if (isLoading) {
    return (
      <SafeAreaView style={styles.center} edges={['top']}>
        <ActivityIndicator color={colors.brand600} />
      </SafeAreaView>
    )
  }

  const pushNotifs = settings?.pushNotifs ?? true

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.headerRow}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={8}>
          <Icon name="chevronLeft" size={22} color={colors.slate800} />
        </Pressable>
        <Text style={styles.heading}>Settings</Text>
        <View style={{ width: 22 }} />
      </View>

      <View style={styles.row}>
        <View style={styles.rowIconLabel}>
          <View style={styles.rowIcon}>
            <Icon name="bell" size={16} color={colors.brand600} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.rowLabel}>Push notifications</Text>
            <Text style={styles.rowHint}>Appointment updates and new messages</Text>
          </View>
        </View>
        <Pressable
          style={[styles.switchTrack, pushNotifs && styles.switchTrackActive]}
          onPress={() => mutation.mutate(!pushNotifs)}
          disabled={mutation.isPending}
        >
          <View style={[styles.switchThumb, pushNotifs && styles.switchThumbActive]} />
        </Pressable>
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.white, padding: spacing.lg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.white },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.lg },
  heading: { fontFamily: fonts.displayBold, fontSize: fontSizes.xl, color: colors.slate800 },
  row: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.slate100,
  },
  rowIconLabel: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flex: 1 },
  rowIcon: { width: 36, height: 36, borderRadius: radius.full, backgroundColor: colors.brand50, alignItems: 'center', justifyContent: 'center' },
  rowLabel: { fontFamily: fonts.bodyMedium, fontSize: fontSizes.base, color: colors.slate800 },
  rowHint: { fontFamily: fonts.body, fontSize: fontSizes.xs, color: colors.slate400, marginTop: 2 },
  switchTrack: { width: 44, height: 26, borderRadius: 13, backgroundColor: colors.slate200, padding: 3 },
  switchTrackActive: { backgroundColor: colors.brand600 },
  switchThumb: { width: 20, height: 20, borderRadius: 10, backgroundColor: colors.white },
  switchThumbActive: { transform: [{ translateX: 18 }] },
})
