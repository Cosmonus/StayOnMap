import { View, Text, StyleSheet } from 'react-native'
import Icon from '@components/common/Icon'
import { colors } from '@theme/colors'
import { fonts, fontSizes } from '@theme/typography'
import { radius, spacing } from '@theme/spacing'

// Matches the TrustBadge enum in backend/prisma/schema.prisma exactly —
// keep in sync with backend/src/features/trust/trust.service.js badge logic.
const BADGE_CONFIG = {
  VERIFIED_OWNER:        { label: 'Verified Owner',       bg: colors.brand50, text: colors.brand700, dot: colors.brand500 },
  COMMUNITY_TRUSTED:     { label: 'Community Trusted',    bg: colors.brand100, text: colors.brand800, dot: colors.brand400 },
  HIGHLY_RECOMMENDED:    { label: 'Highly Recommended',   bg: colors.success50, text: '#15803D', dot: colors.success },
  VERIFIED_NEIGHBORHOOD: { label: 'Verified Neighborhood', bg: '#EFF6FF', text: '#1D4ED8', dot: '#3B82F6' },
  LOW_COMPLAINT:         { label: 'Low Complaint',        bg: colors.slate100, text: colors.slate600, dot: colors.slate500 },
  UNDER_REVIEW:          { label: 'Under Review',         bg: colors.warning50, text: '#B45309', dot: colors.warning },
  SUSPICIOUS:            { label: 'Suspicious',           bg: colors.danger50, text: '#991B1B', dot: colors.danger },
  NEEDS_ATTENTION:       { label: 'Needs Attention',      bg: colors.danger50, text: '#DC2626', dot: '#F87171' },
}

const BADGE_ICON = {
  VERIFIED_OWNER: 'shieldCheck',
  COMMUNITY_TRUSTED: 'shieldCheck',
  HIGHLY_RECOMMENDED: 'star',
  VERIFIED_NEIGHBORHOOD: 'shieldCheck',
  LOW_COMPLAINT: 'checkCircle',
  UNDER_REVIEW: 'clock',
  SUSPICIOUS: 'alertTriangle',
  NEEDS_ATTENTION: 'alertTriangle',
}

const SIZE_STYLES = {
  sm: { paddingHorizontal: spacing.sm, paddingVertical: 3, fontSize: 11, iconSize: 11 },
  md: { paddingHorizontal: spacing.md, paddingVertical: 5, fontSize: fontSizes.xs, iconSize: 13 },
}

export default function TrustBadge({ badge, size = 'sm' }) {
  const cfg = BADGE_CONFIG[badge]
  if (!cfg) return null
  const sizeStyle = SIZE_STYLES[size] ?? SIZE_STYLES.sm

  return (
    <View style={[styles.badge, { backgroundColor: cfg.bg, paddingHorizontal: sizeStyle.paddingHorizontal, paddingVertical: sizeStyle.paddingVertical }]}>
      <Icon name={BADGE_ICON[badge] ?? 'checkCircle'} size={sizeStyle.iconSize} color={cfg.text} />
      <Text style={[styles.label, { color: cfg.text, fontSize: sizeStyle.fontSize }]}>{cfg.label}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  badge: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: radius.full, alignSelf: 'flex-start' },
  label: { fontFamily: fonts.bodySemiBold },
})
