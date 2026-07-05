import { View, Text, Pressable, StyleSheet, ActivityIndicator } from 'react-native'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { authService } from '@services/auth.service'
import Icon from '@components/common/Icon'
import { colors } from '@theme/colors'
import { fonts, fontSizes } from '@theme/typography'
import { spacing, radius } from '@theme/spacing'
import { CATEGORIES } from '../../config/onboarding.js'

export default function TypePicker({ onPick }) {
  return (
    <View style={styles.container}>
      <Text style={styles.kicker}>Host onboarding</Text>
      <Text style={styles.title}>Pick what you&apos;re listing</Text>
      <Text style={styles.subtitle}>
        Each type has its own guided onboarding — same three phases, different questions and verification.
      </Text>

      <View style={{ gap: spacing.md }}>
        {Object.entries(CATEGORIES).map(([key, c]) => {
          const biz = c.tier === 'biz'
          return (
            <Pressable key={key} style={styles.card} onPress={() => onPick(key)}>
              <View style={[styles.cardIcon, biz && styles.cardIconBiz]}>
                <Icon name="building" size={22} color={biz ? colors.white : colors.brand600} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>{c.label}</Text>
                <Text style={styles.cardBody}>{c.long}</Text>
              </View>
              <View style={[styles.tierBadge, biz ? styles.tierBadgeBiz : styles.tierBadgeFree]}>
                <Text style={[styles.tierBadgeText, biz && styles.tierBadgeTextBiz]}>{biz ? 'BUSINESS' : 'FREE'}</Text>
              </View>
            </Pressable>
          )
        })}
      </View>
    </View>
  )
}

export function BusinessGate({ onUpgraded, onChooseDifferent }) {
  const qc = useQueryClient()
  const mutation = useMutation({
    mutationFn: () => authService.upgradeBusiness(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['me'] })
      onUpgraded()
    },
  })

  return (
    <View style={styles.gateContainer}>
      <View style={styles.gateBadge}>
        <Text style={styles.gateBadgeText}>BUSINESS</Text>
      </View>
      <Text style={styles.gateTitle}>This property type needs a Business account</Text>
      <Text style={styles.gateBody}>
        PG, shop/commercial and short-stay listings run through StayOnMap Business — ₹999/mo, cancel anytime.
        (Billing isn&apos;t live yet — this upgrades your account for free while we finish that.)
      </Text>
      {mutation.isError && <Text style={styles.gateError}>{mutation.error?.message ?? 'Something went wrong'}</Text>}
      <View style={styles.gateActions}>
        <Pressable style={styles.gateSecondaryButton} onPress={onChooseDifferent}>
          <Text style={styles.gateSecondaryText}>Choose a different type</Text>
        </Pressable>
        <Pressable style={[styles.gatePrimaryButton, mutation.isPending && styles.disabled]} onPress={() => mutation.mutate()} disabled={mutation.isPending}>
          {mutation.isPending ? <ActivityIndicator color={colors.white} size="small" /> : <Text style={styles.gatePrimaryText}>Upgrade to Business</Text>}
        </Pressable>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg },
  kicker: { fontFamily: fonts.bodySemiBold, fontSize: 11, color: colors.brand600, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: spacing.sm },
  title: { fontFamily: fonts.displayBold, fontSize: fontSizes.xl, color: colors.slate800, marginBottom: spacing.xs },
  subtitle: { fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.slate500, marginBottom: spacing.lg, lineHeight: 20 },
  card: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.slate200, backgroundColor: colors.white },
  cardIcon: { width: 44, height: 44, borderRadius: radius.md, backgroundColor: colors.brand50, alignItems: 'center', justifyContent: 'center' },
  cardIconBiz: { backgroundColor: colors.slate800 },
  cardTitle: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.base, color: colors.slate800 },
  cardBody: { fontFamily: fonts.body, fontSize: fontSizes.xs, color: colors.slate400, marginTop: 2 },
  tierBadge: { paddingHorizontal: spacing.sm, paddingVertical: 4, borderRadius: radius.full },
  tierBadgeFree: { backgroundColor: colors.brand50 },
  tierBadgeBiz: { backgroundColor: colors.slate800 },
  tierBadgeText: { fontFamily: fonts.bodySemiBold, fontSize: 9, color: colors.brand700, letterSpacing: 0.4 },
  tierBadgeTextBiz: { color: colors.white },
  gateContainer: { alignItems: 'center', paddingHorizontal: spacing.lg, paddingTop: spacing.xl },
  gateBadge: { backgroundColor: colors.slate800, borderRadius: radius.full, paddingHorizontal: spacing.md, paddingVertical: 6, marginBottom: spacing.lg },
  gateBadgeText: { fontFamily: fonts.bodySemiBold, fontSize: 11, color: colors.white, letterSpacing: 0.6 },
  gateTitle: { fontFamily: fonts.displayBold, fontSize: fontSizes.xl, color: colors.slate800, textAlign: 'center', marginBottom: spacing.sm },
  gateBody: { fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.slate500, textAlign: 'center', lineHeight: 20, marginBottom: spacing.lg },
  gateError: { fontFamily: fonts.body, fontSize: fontSizes.xs, color: colors.danger, marginBottom: spacing.md },
  gateActions: { flexDirection: 'row', gap: spacing.sm, width: '100%' },
  gateSecondaryButton: { flex: 1, borderWidth: 1, borderColor: colors.slate200, borderRadius: radius.md, paddingVertical: spacing.md, alignItems: 'center' },
  gateSecondaryText: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.sm, color: colors.slate700 },
  gatePrimaryButton: { flex: 1, backgroundColor: colors.slate800, borderRadius: radius.md, paddingVertical: spacing.md, alignItems: 'center' },
  gatePrimaryText: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.sm, color: colors.white },
  disabled: { opacity: 0.6 },
})
