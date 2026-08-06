import { View, Text, Pressable, StyleSheet, Linking, Alert } from 'react-native'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { authService } from '@services/auth.service'
import FormSheet from '@components/common/FormSheet'
import Icon from '@components/common/Icon'
import { colors } from '@theme/colors'
import { fonts, fontSizes } from '@theme/typography'
import { spacing, radius } from '@theme/spacing'

const PROVIDER_LABELS = { GOOGLE: 'Google' }
const KEY_TO_ENUM = { google: 'GOOGLE' }

/**
 * Settings → Linked accounts (mirrors web's LinkedAccountsCard). Connecting
 * walks the same system-browser OAuth flow as sign-in — the backend signs
 * "this is a link for user X" into the state, and the deep link comes back to
 * OAuthRedirectHandler. Disconnecting is guarded server-side: the last way
 * into the account can never be removed.
 */
export default function LinkedAccountsSheet({ visible, onClose }) {
  const qc = useQueryClient()

  const { data } = useQuery({
    queryKey: ['linked-accounts'],
    queryFn: () => authService.getLinkedAccounts().then((r) => r.data),
    enabled: visible,
  })
  const { data: available } = useQuery({
    queryKey: ['oauth-providers'],
    queryFn: () => authService.getOAuthProviders().then((r) => r.data),
    staleTime: 60 * 60 * 1000,
  })

  const { mutate: startLink, isPending: linking } = useMutation({
    mutationFn: (provider) => authService.startLinkProvider(provider),
    onSuccess: (res) => { Linking.openURL(res.data.redirectUrl).catch(() => {}) },
    onError: (err) => Alert.alert('Error', err?.message ?? 'Could not start linking'),
  })

  const { mutate: unlink, isPending: unlinking } = useMutation({
    mutationFn: (provider) => authService.unlinkProvider(provider),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['linked-accounts'] }),
    onError: (err) => Alert.alert('Cannot disconnect', err?.message ?? 'Something went wrong'),
  })

  const linked = new Map((data?.accounts ?? []).map((a) => [a.provider, a]))

  return (
    <FormSheet visible={visible} onClose={onClose} title="Linked accounts">
      <View style={styles.row}>
        <View style={styles.rowIcon}>
          <Icon name="mail" size={16} color={colors.slate500} />
        </View>
        <View style={styles.rowLabels}>
          <Text style={styles.rowLabel}>Email &amp; password</Text>
          <Text style={styles.rowHint}>
            {data?.hasPassword ? 'A password is set on this account' : 'No password — use "Reset password" to set one'}
          </Text>
        </View>
        {data?.hasPassword && (
          <View style={styles.pill}><Text style={styles.pillText}>Active</Text></View>
        )}
      </View>

      {!available?.length ? (
        <Text style={styles.empty}>Social sign-in is not enabled on this server yet.</Text>
      ) : (
        available.map(({ key, label }) => {
          const account = linked.get(KEY_TO_ENUM[key])
          return (
            <View key={key} style={styles.row}>
              <View style={styles.rowIcon}>
                <Icon name="link" size={16} color={colors.slate500} />
              </View>
              <View style={styles.rowLabels}>
                <Text style={styles.rowLabel}>{PROVIDER_LABELS[KEY_TO_ENUM[key]] ?? label}</Text>
                <Text style={styles.rowHint} numberOfLines={1}>
                  {account ? (account.providerEmail ?? 'Connected') : 'Not connected'}
                </Text>
              </View>
              <Pressable
                style={[account ? styles.outlineButton : styles.darkButton, (linking || unlinking) && styles.disabled]}
                disabled={linking || unlinking}
                onPress={() => (account ? unlink(key) : startLink(key))}
                accessibilityRole="button"
                accessibilityLabel={account ? `Disconnect ${label}` : `Connect ${label}`}
                accessibilityState={{ disabled: linking || unlinking }}
              >
                <Text style={account ? styles.outlineButtonText : styles.darkButtonText}>
                  {account ? 'Disconnect' : 'Connect'}
                </Text>
              </Pressable>
            </View>
          )
        })
      )}
    </FormSheet>
  )
}

const styles = StyleSheet.create({
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
  rowHint: { fontFamily: fonts.body, fontSize: fontSizes.xs, color: colors.slate500, marginTop: 2 },
  pill: { backgroundColor: colors.brand50, borderRadius: radius.full, paddingHorizontal: spacing.sm + 2, paddingVertical: 4 },
  pillText: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.xs, color: colors.brand700 },
  outlineButton: {
    minHeight: 40, paddingHorizontal: spacing.md, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.slate200, alignItems: 'center', justifyContent: 'center',
  },
  outlineButtonText: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.sm, color: colors.slate700 },
  darkButton: {
    minHeight: 40, paddingHorizontal: spacing.md, borderRadius: radius.md,
    backgroundColor: colors.slate900, alignItems: 'center', justifyContent: 'center',
  },
  darkButtonText: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.sm, color: colors.white },
  disabled: { opacity: 0.5 },
  empty: { fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.slate500, paddingVertical: spacing.md },
})
