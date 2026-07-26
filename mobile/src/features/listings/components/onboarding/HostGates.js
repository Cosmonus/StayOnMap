import { View, Text, Pressable, StyleSheet, ActivityIndicator } from 'react-native'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { authService } from '@services/auth.service'
import { colors } from '@theme/colors'
import { fonts, fontSizes } from '@theme/typography'
import { spacing, radius } from '@theme/spacing'
import { CATEGORIES } from '../../config/onboarding.js'

// The category grid, now rendered INSIDE step 1 of the wizard
// (WizardScreens.js's BasicsScreen) rather than as a page of its own —
// picking a type and answering its first question is one decision.
export function CategoryCards({ activeKey, onPick }) {
  return (
    <View style={{ gap: spacing.sm }}>
      {Object.entries(CATEGORIES).map(([key, c]) => {
        const biz = c.tier === 'biz'
        const active = key === activeKey
        return (
          <Pressable
            key={key}
            style={[styles.card, active && styles.cardActive]}
            onPress={() => onPick(key)}
            accessibilityRole="radio"
            accessibilityState={{ checked: active }}
          >
            {/* No icon tile: the same generic building glyph on all six cards
                distinguished nothing and ate a third of the row's width. */}
            <View style={{ flex: 1 }}>
              <Text style={[styles.cardTitle, active && styles.cardTitleActive]}>{c.label}</Text>
              <Text style={styles.cardBody}>{c.long}</Text>
            </View>
            {biz && (
              <View style={styles.tierBadge}>
                <Text style={styles.tierBadgeText}>BUSINESS</Text>
              </View>
            )}
          </Pressable>
        )
      })}
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
        <Pressable style={styles.gateSecondaryButton} onPress={onChooseDifferent} accessibilityRole="button">
          <Text style={styles.gateSecondaryText}>Choose a different type</Text>
        </Pressable>
        <Pressable
          style={[styles.gatePrimaryButton, mutation.isPending && styles.disabled]}
          onPress={() => mutation.mutate()}
          disabled={mutation.isPending}
          accessibilityRole="button"
          accessibilityLabel="Upgrade to Business"
          accessibilityState={{ disabled: mutation.isPending, busy: mutation.isPending }}
        >
          {mutation.isPending ? <ActivityIndicator color={colors.white} size="small" /> : <Text style={styles.gatePrimaryText}>Upgrade to Business</Text>}
        </Pressable>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 72, paddingHorizontal: spacing.md, paddingVertical: spacing.md, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.slate200, backgroundColor: colors.white },
  cardActive: { borderColor: colors.brand600, backgroundColor: colors.brand50 },
  cardTitle: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.base, color: colors.slate800 },
  cardTitleActive: { color: colors.brand700 },
  cardBody: { fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.slate500, marginTop: 2 },
  tierBadge: { backgroundColor: colors.warning50, paddingHorizontal: spacing.sm, paddingVertical: 4, borderRadius: radius.full },
  tierBadgeText: { fontFamily: fonts.bodySemiBold, fontSize: 11, color: colors.warning700, letterSpacing: 0.4 },
  gateContainer: { alignItems: 'center', paddingHorizontal: spacing.lg, paddingTop: spacing.xl },
  gateBadge: { backgroundColor: colors.slate800, borderRadius: radius.full, paddingHorizontal: spacing.md, paddingVertical: 6, marginBottom: spacing.lg },
  gateBadgeText: { fontFamily: fonts.bodySemiBold, fontSize: 11, color: colors.white, letterSpacing: 0.6 },
  gateTitle: { fontFamily: fonts.displayBold, fontSize: fontSizes.xl, color: colors.slate800, textAlign: 'center', marginBottom: spacing.sm },
  gateBody: { fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.slate500, textAlign: 'center', lineHeight: 20, marginBottom: spacing.lg },
  gateError: { fontFamily: fonts.body, fontSize: fontSizes.xs, color: colors.danger, marginBottom: spacing.md },
  gateActions: { flexDirection: 'row', gap: spacing.sm, width: '100%' },
  gateSecondaryButton: { flex: 1, borderWidth: 1, borderColor: colors.slate200, borderRadius: radius.md, paddingVertical: spacing.md, alignItems: 'center', minHeight: 48, justifyContent: 'center', },
  gateSecondaryText: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.sm, color: colors.slate700 },
  gatePrimaryButton: { flex: 1, backgroundColor: colors.slate800, borderRadius: radius.md, paddingVertical: spacing.md, alignItems: 'center', minHeight: 48, justifyContent: 'center', },
  gatePrimaryText: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.sm, color: colors.white },
  disabled: { opacity: 0.6 },
})
