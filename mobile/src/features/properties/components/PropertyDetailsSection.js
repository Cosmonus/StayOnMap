import { View, Text, StyleSheet } from 'react-native'
import Icon from '@components/common/Icon'
import { formatDate } from '@utils/format'
import { colors } from '@theme/colors'
import { fonts, fontSizes } from '@theme/typography'
import { spacing, radius } from '@theme/spacing'

function ordinal(n) {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return n + (s[(v - 20) % 10] || s[v] || s[0])
}

function floorLabel(floor, totalFloors) {
  if (floor && totalFloors) return `${ordinal(floor)} floor of ${totalFloors}`
  if (floor) return `${ordinal(floor)} floor`
  if (totalFloors) return `${totalFloors}-floor building`
  return null
}

export default function PropertyDetailsSection({ property }) {
  const rows = [
    { icon: 'area', label: 'Built-up Area', value: property.area ? `${Number(property.area).toLocaleString('en-IN')} sq.ft` : null },
    { icon: 'building', label: 'Floor', value: floorLabel(property.floor, property.totalFloors) },
    { icon: 'explore', label: 'Facing Direction', value: property.facingDirection ? property.facingDirection[0] + property.facingDirection.slice(1).toLowerCase() : null },
    { icon: 'calendar', label: 'Available From', value: property.availableFrom ? formatDate(property.availableFrom) : null },
    { icon: 'clock', label: 'Minimum Lease', value: property.leaseDuration ? `${property.leaseDuration} months` : null },
    { icon: 'users', label: 'Max Occupancy', value: property.occupancyLimit ? `${property.occupancyLimit} persons` : null },
  ].filter((r) => r.value)

  if (!rows.length) return null

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Property details</Text>
      <View style={styles.card}>
        {rows.map((r, i) => (
          <View key={r.label} style={[styles.row, i === rows.length - 1 && styles.rowLast]}>
            <Icon name={r.icon} size={14} color={colors.slate500} />
            <Text style={styles.rowLabel}>{r.label}</Text>
            <Text style={styles.rowValue}>{r.value}</Text>
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
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.slate100,
  },
  rowLast: { borderBottomWidth: 0 },
  rowLabel: { flex: 1, fontFamily: fonts.body, fontSize: fontSizes.xs, color: colors.slate500 },
  rowValue: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.xs, color: colors.slate800 },
})
