import { View, Text, StyleSheet } from 'react-native'
import Icon from '@components/common/Icon'
import { formatTime } from '@utils/time'
import { colors } from '@theme/colors'
import { fonts, fontSizes } from '@theme/typography'
import { spacing, radius } from '@theme/spacing'

const RULE_DEFS = [
  { key: 'nonVegAllowed', label: 'Non-veg Cooking' },
  { key: 'bachelorAllowed', label: 'Bachelors' },
  { key: 'visitorsAllowed', label: 'Visitors' },
  { key: 'petsAllowed', label: 'Pets' },
  { key: 'smokingAllowed', label: 'Smoking' },
  { key: 'alcoholAllowed', label: 'Alcohol' },
]

const GENDER_LABELS = { MALE: 'Male tenants only', FEMALE: 'Female tenants only', FAMILY: 'Families preferred' }

export default function HouseRulesSection({ rules }) {
  if (!rules) return null
  const genderLabel = rules.genderPreference !== 'ANY' ? GENDER_LABELS[rules.genderPreference] : null

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>House rules</Text>
      <View style={styles.grid}>
        {RULE_DEFS.map(({ key, label }) => {
          const allowed = !!rules[key]
          return (
            <View key={key} style={[styles.ruleCard, allowed ? styles.ruleAllowed : styles.ruleDenied]}>
              {/* A disallowed rule is still information a renter has to read —
                  slate500, matching web's DetailSheet, not a greyed-out 2.5:1. */}
              <Text style={[styles.ruleLabel, { color: allowed ? colors.slate800 : colors.slate500 }]}>{label}</Text>
              <View style={[styles.ruleDot, { backgroundColor: allowed ? colors.brand600 : colors.slate400 }]}>
                <Icon name={allowed ? 'check' : 'close'} size={10} color={colors.white} />
              </View>
            </View>
          )
        })}
      </View>

      {!!genderLabel && (
        <View style={styles.calloutBrand}>
          <View style={styles.calloutBang}><Text style={styles.calloutBangText}>!</Text></View>
          <Text style={styles.calloutBrandText}>{genderLabel}</Text>
        </View>
      )}
      {!!rules.curfewTime && (
        <View style={styles.calloutAmber}>
          <Icon name="clock" size={14} color="#D97706" />
          <Text style={styles.calloutAmberText}>Curfew at {formatTime(rules.curfewTime)}</Text>
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  section: { marginTop: spacing.lg },
  sectionTitle: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.base, color: colors.slate800, marginBottom: spacing.sm },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  ruleCard: {
    flexGrow: 1, flexBasis: '45%', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    gap: spacing.sm, borderRadius: radius.lg, borderWidth: 1, paddingHorizontal: spacing.md, paddingVertical: spacing.sm + 2,
  },
  ruleAllowed: { backgroundColor: colors.brand50, borderColor: colors.brand200 },
  ruleDenied: { backgroundColor: colors.slate50, borderColor: colors.slate100 },
  ruleLabel: { flexShrink: 1, fontFamily: fonts.bodyMedium, fontSize: fontSizes.xs },
  ruleDot: { width: 18, height: 18, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center' },
  calloutBrand: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.sm,
    backgroundColor: colors.brand50, borderWidth: 1, borderColor: colors.brand100,
    borderRadius: radius.lg, paddingHorizontal: spacing.md, paddingVertical: spacing.sm + 2,
  },
  calloutBang: { width: 18, height: 18, borderRadius: radius.full, backgroundColor: colors.brand600, alignItems: 'center', justifyContent: 'center' },
  calloutBangText: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.xs, color: colors.white },
  calloutBrandText: { fontFamily: fonts.bodyMedium, fontSize: fontSizes.xs, color: colors.brand700 },
  calloutAmber: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.sm,
    backgroundColor: colors.warning50, borderWidth: 1, borderColor: '#FDE68A',
    borderRadius: radius.lg, paddingHorizontal: spacing.md, paddingVertical: spacing.sm + 2,
  },
  calloutAmberText: { fontFamily: fonts.bodyMedium, fontSize: fontSizes.xs, color: '#92400E' },
})
