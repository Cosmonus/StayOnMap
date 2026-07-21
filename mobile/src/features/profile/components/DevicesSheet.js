import { View, Text, Pressable, StyleSheet, Alert, ActivityIndicator } from 'react-native'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { authService } from '@services/auth.service'
import { useAuth } from '@features/auth/hooks/useAuth'
import FormSheet from './FormSheet'
import Icon from '@components/common/Icon'
import { colors } from '@theme/colors'
import { fonts, fontSizes } from '@theme/typography'
import { spacing, radius } from '@theme/spacing'

function since(date) {
  const mins = Math.floor((Date.now() - new Date(date).getTime()) / 60_000)
  if (mins < 2) return 'Active now'
  if (mins < 60) return `${mins} min ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  return new Date(date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
}

/** Settings → Devices (mirrors web's DevicesCard): active sessions, revocable individually or all at once. */
export default function DevicesSheet({ visible, onClose }) {
  const qc = useQueryClient()
  const { signOut } = useAuth()

  const { data: sessions, isLoading, isError, refetch } = useQuery({
    queryKey: ['auth-sessions'],
    queryFn: () => authService.getSessions().then((r) => r.data),
    enabled: visible,
  })

  const { mutate: revoke, isPending: revoking } = useMutation({
    mutationFn: (id) => authService.revokeSession(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['auth-sessions'] }),
    onError: (err) => Alert.alert('Error', err?.message ?? 'Could not revoke the session'),
  })

  const { mutate: logoutAll, isPending: loggingOutAll } = useMutation({
    mutationFn: () => authService.logoutAll(),
    onSuccess: () => signOut(), // every session died, including this one
    onError: (err) => Alert.alert('Error', err?.message ?? 'Could not log out everywhere'),
  })

  function confirmLogoutAll() {
    Alert.alert(
      'Log out of all devices?',
      'Every signed-in device — including this one — will need to sign in again.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Log out everywhere', style: 'destructive', onPress: () => logoutAll() },
      ],
    )
  }

  return (
    <FormSheet visible={visible} onClose={onClose} title="Devices">
      {isLoading ? (
        <View style={styles.center}><ActivityIndicator color={colors.brand600} /></View>
      ) : isError ? (
        <View style={styles.center}>
          <Text style={styles.empty}>Could not load your devices.</Text>
          <Pressable style={styles.retryButton} onPress={() => refetch()} accessibilityRole="button" accessibilityLabel="Retry loading devices">
            <Text style={styles.retryText}>Retry</Text>
          </Pressable>
        </View>
      ) : !sessions?.length ? (
        <Text style={styles.empty}>No active sessions listed yet — they appear from your next sign-in.</Text>
      ) : (
        <>
          {sessions.map((s) => (
            <View key={s.id} style={styles.row}>
              <View style={styles.rowIcon}>
                <Icon name="phone" size={16} color={colors.slate500} />
              </View>
              <View style={styles.rowLabels}>
                <Text style={styles.rowLabel} numberOfLines={1}>{s.deviceLabel ?? 'Unknown device'}</Text>
                <Text style={styles.rowHint}>{since(s.lastUsedAt)}{s.ip ? ` · ${s.ip}` : ''}</Text>
              </View>
              <Pressable
                style={[styles.outlineButton, revoking && styles.disabled]}
                disabled={revoking}
                onPress={() => revoke(s.id)}
                accessibilityRole="button"
                accessibilityLabel={`Log out ${s.deviceLabel ?? 'this device'}`}
                accessibilityState={{ disabled: revoking }}
              >
                <Text style={styles.outlineButtonText}>Log out</Text>
              </Pressable>
            </View>
          ))}
          <Pressable
            style={[styles.dangerButton, loggingOutAll && styles.disabled]}
            disabled={loggingOutAll}
            onPress={confirmLogoutAll}
            accessibilityRole="button"
            accessibilityLabel="Log out of all devices"
            accessibilityState={{ disabled: loggingOutAll }}
          >
            <Text style={styles.dangerButtonText}>
              {loggingOutAll ? 'Signing out…' : 'Log out of all devices'}
            </Text>
          </Pressable>
        </>
      )}
    </FormSheet>
  )
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', paddingVertical: spacing.xl, gap: spacing.sm },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 56,
    borderBottomWidth: 1, borderBottomColor: colors.slate100, paddingVertical: spacing.sm,
  },
  rowIcon: {
    width: 34, height: 34, borderRadius: radius.full, backgroundColor: colors.slate100,
    alignItems: 'center', justifyContent: 'center',
  },
  rowLabels: { flex: 1, minWidth: 0 },
  rowLabel: { fontFamily: fonts.bodyMedium, fontSize: fontSizes.base, color: colors.slate800 },
  rowHint: { fontFamily: fonts.body, fontSize: fontSizes.xs, color: colors.slate400, marginTop: 2 },
  outlineButton: {
    minHeight: 40, paddingHorizontal: spacing.md, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.slate200, alignItems: 'center', justifyContent: 'center',
  },
  outlineButtonText: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.sm, color: colors.slate700 },
  dangerButton: {
    minHeight: 48, borderRadius: radius.md, borderWidth: 1, borderColor: colors.danger,
    alignItems: 'center', justifyContent: 'center', marginTop: spacing.md,
  },
  dangerButtonText: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.sm, color: colors.danger },
  disabled: { opacity: 0.5 },
  empty: { fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.slate400, paddingVertical: spacing.md },
  retryButton: {
    minHeight: 44, minWidth: 110, borderRadius: radius.md, backgroundColor: colors.brand600,
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.md,
  },
  retryText: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.sm, color: colors.white },
})
