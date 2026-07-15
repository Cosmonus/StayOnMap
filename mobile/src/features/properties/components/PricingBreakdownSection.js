import { View, Text, StyleSheet } from 'react-native'
import { formatCurrency } from '@utils/format'
import { colors } from '@theme/colors'
import { fonts, fontSizes } from '@theme/typography'
import { spacing, radius } from '@theme/spacing'

export default function PricingBreakdownSection({ property }) {
  const rows = [
    { label: 'Monthly Rent', value: formatCurrency(Number(property.rent)), accent: true },
    { label: 'Security Deposit', value: formatCurrency(Number(property.deposit ?? 0)) },
    { label: 'Brokerage', value: property.brokerage ? formatCurrency(Number(property.brokerage)) : 'None' },
    { label: 'Maintenance', value: property.maintenance ? `${formatCurrency(Number(property.maintenance))}/mo` : 'Not included' },
    { label: 'Electricity (est.)', value: property.electricityCharges ? `${formatCurrency(Number(property.electricityCharges))}/mo` : null },
    { label: 'Water (est.)', value: property.waterCharges ? `${formatCurrency(Number(property.waterCharges))}/mo` : null },
  ].filter((r) => r.value)

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Pricing breakdown</Text>
      <View style={styles.card}>
        {rows.map((r, i) => (
          <View key={r.label} style={[styles.row, i === rows.length - 1 && styles.rowLast]}>
            <Text style={styles.rowLabel}>{r.label}</Text>
            <Text style={[styles.rowValue, r.accent && styles.rowValueAccent]}>{r.value}</Text>
          </View>
        ))}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  section: { marginTop: spacing.lg },
  sectionTitle: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.base, color: colors.slate800, marginBottom: spacing.sm },
  card: {
    backgroundColor: colors.slate50, borderRadius: radius.lg, paddingHorizontal: spacing.md,
    borderWidth: 1, borderColor: colors.slate100,
  },
  row: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm,
    paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.slate100,
  },
  rowLast: { borderBottomWidth: 0 },
  rowLabel: { fontFamily: fonts.body, fontSize: fontSizes.xs, color: colors.slate500 },
  rowValue: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.xs, color: colors.slate800 },
  rowValueAccent: { color: colors.brand700, fontSize: fontSizes.sm },
})
