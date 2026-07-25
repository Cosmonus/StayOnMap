import { View, Text, StyleSheet } from 'react-native'
import { formatDate } from '@utils/format'
import { colors } from '@theme/colors'
import { fonts, fontSizes } from '@theme/typography'
import { spacing, radius } from '@theme/spacing'

function availabilityTag(status, availableFrom) {
  if (status === 'INACTIVE' || status === 'SUSPENDED')
    return { label: 'Not Available', dot: colors.slate500, text: colors.slate500, bg: colors.slate50 }
  if (status === 'PENDING')
    return { label: 'Awaiting Approval', dot: colors.warning, text: '#B45309', bg: colors.warning50 }
  if (status === 'DRAFT')
    return { label: 'Draft', dot: colors.slate200, text: colors.slate500, bg: colors.slate50 }
  if (availableFrom && new Date(availableFrom) > new Date())
    return { label: `Available from ${formatDate(availableFrom)}`, dot: '#3B82F6', text: '#2563EB', bg: '#EFF6FF' }
  return { label: 'Available Now', dot: colors.success, text: colors.brand700, bg: colors.success50 }
}

export default function AvailabilityBadge({ status, availableFrom }) {
  const tag = availabilityTag(status, availableFrom)
  return (
    <View style={[styles.badge, { backgroundColor: tag.bg }]}>
      <View style={[styles.dot, { backgroundColor: tag.dot }]} />
      <Text style={[styles.label, { color: tag.text }]}>{tag.label}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6,
    borderRadius: radius.full, paddingHorizontal: spacing.md, paddingVertical: 6, marginBottom: spacing.sm,
  },
  dot: { width: 8, height: 8, borderRadius: radius.full },
  label: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.xs },
})
