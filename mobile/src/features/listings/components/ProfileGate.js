import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native'
import Icon from '@components/common/Icon'
import { colors } from '@theme/colors'
import { fonts, fontSizes } from '@theme/typography'
import { spacing, radius } from '@theme/spacing'

// Mirror of backend requireCompleteProfile.middleware.js's REQUIRED list.
// WHICH rows are missing comes from the server (`missingProfileFields` on
// GET /auth/me — computed by that same middleware, so the two can't
// disagree); this list only supplies the display order and the fix hints.
const REQUIRED = [
  { field: 'name',  label: 'Your name',      hint: 'Add it in Settings → Edit profile' },
  { field: 'phone', label: 'Phone number',   hint: 'Add it in Settings → Edit profile' },
  { field: 'city',  label: 'City',           hint: 'Set when you signed up — contact support if it’s missing' },
  { field: 'email', label: 'Verified email', hint: 'Tap Verify email in Settings — check your inbox for the verification link, or sign in once with an emailed code' },
]

function ChecklistRow({ label, hint, done }) {
  return (
    <View style={styles.row} accessible accessibilityLabel={`${label}: ${done ? 'done' : 'still needed'}`}>
      <View style={[styles.tick, done ? styles.tickDone : styles.tickPending]}>
        {done && <Icon name="check" size={12} color={colors.white} />}
      </View>
      <View style={styles.rowText}>
        <Text style={[styles.rowLabel, done && styles.rowLabelDone]}>{label}</Text>
        {!done && <Text style={styles.rowHint}>{hint}</Text>}
      </View>
    </View>
  )
}

// Front door for the same rule POST /properties enforces server-side
// (requireCompleteProfile): say what's left BEFORE the wizard, never let
// someone build a whole listing that can only fail at publish.
export default function ProfileGate({ missing, onGoToSettings, onClose }) {
  const missingFields = new Set(missing.map((m) => m.field))

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.iconWrap}>
        <Icon name="profile" size={24} color={colors.brand600} />
      </View>
      <Text style={styles.title}>Finish your profile to start hosting</Text>
      <Text style={styles.body}>
        Renters need to know who they&apos;re talking to. Complete these once and
        you can list as many properties as you like.
      </Text>

      <View style={styles.checklist}>
        {REQUIRED.map((item, i) => (
          <View key={item.field} style={i > 0 && styles.rowDivider}>
            <ChecklistRow
              label={item.label}
              hint={item.hint}
              done={!missingFields.has(item.field)}
            />
          </View>
        ))}
      </View>

      <Pressable
        style={styles.primaryButton}
        onPress={onGoToSettings}
        accessibilityRole="button"
        accessibilityLabel="Complete my profile in Settings"
      >
        <Text style={styles.primaryText}>Complete my profile</Text>
        <Icon name="arrowRight" size={16} color={colors.white} />
      </Pressable>
      <Pressable
        style={styles.secondaryButton}
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel="Not now, go back"
      >
        <Text style={styles.secondaryText}>Not now</Text>
      </Pressable>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { padding: spacing.xl, alignItems: 'center' },
  iconWrap: {
    width: 56, height: 56, borderRadius: radius.lg, backgroundColor: colors.brand50,
    alignItems: 'center', justifyContent: 'center', marginBottom: spacing.md,
  },
  title: { fontFamily: fonts.displayBold, fontSize: fontSizes.xl, color: colors.slate800, textAlign: 'center' },
  body: {
    fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.slate500,
    textAlign: 'center', lineHeight: 20, marginTop: spacing.sm,
  },
  checklist: {
    alignSelf: 'stretch', marginTop: spacing.xl, backgroundColor: colors.white,
    borderWidth: 1, borderColor: colors.slate200, borderRadius: radius.lg, overflow: 'hidden',
  },
  rowDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.slate100 },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md, paddingHorizontal: spacing.md, paddingVertical: spacing.md, minHeight: 48 },
  tick: { width: 20, height: 20, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  tickDone: { backgroundColor: colors.brand600 },
  tickPending: { borderWidth: 2, borderColor: colors.slate300 },
  rowText: { flex: 1, minWidth: 0 },
  rowLabel: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.sm, color: colors.slate800 },
  rowLabelDone: { color: colors.slate400, textDecorationLine: 'line-through' },
  rowHint: { fontFamily: fonts.body, fontSize: fontSizes.xs, color: colors.slate400, marginTop: 2, lineHeight: 16 },
  primaryButton: {
    alignSelf: 'stretch', marginTop: spacing.xl, minHeight: 48, borderRadius: radius.lg,
    backgroundColor: colors.slate900, flexDirection: 'row',
    alignItems: 'center', justifyContent: 'center', gap: spacing.xs,
  },
  primaryText: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.sm, color: colors.white },
  secondaryButton: { alignSelf: 'stretch', marginTop: spacing.sm, minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  secondaryText: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.sm, color: colors.slate500 },
})
