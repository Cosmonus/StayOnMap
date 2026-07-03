import { View, Text, StyleSheet } from 'react-native'
import Icon from '@components/common/Icon'
import { fonts, fontSizes } from '@theme/typography'
import { radius, spacing } from '@theme/spacing'

// Matches the TrustBadge enum in backend/prisma/schema.prisma exactly —
// keep in sync with backend/src/features/trust/trust.service.js badge logic.
const BADGE_CONFIG = {
  VERIFIED_OWNER:        { label: 'Verified Owner',       bg: '#E9F9F1', text: '#0B7D52', dot: '#0E9D66' },
  COMMUNITY_TRUSTED:     { label: 'Community Trusted',    bg: '#CDF1E0', text: '#054A32', dot: '#12B579' },
  HIGHLY_RECOMMENDED:    { label: 'Highly Recommended',   bg: '#F0FDF4', text: '#15803D', dot: '#22C55E' },
  VERIFIED_NEIGHBORHOOD: { label: 'Verified Neighborhood', bg: '#EFF6FF', text: '#1D4ED8', dot: '#3B82F6' },
  LOW_COMPLAINT:         { label: 'Low Complaint',        bg: '#F1F5F9', text: '#475569', dot: '#94A3B8' },
  UNDER_REVIEW:          { label: 'Under Review',         bg: '#FFFBEB', text: '#B45309', dot: '#F59E0B' },
  SUSPICIOUS:            { label: 'Suspicious',           bg: '#FEF2F2', text: '#991B1B', dot: '#EF4444' },
  NEEDS_ATTENTION:       { label: 'Needs Attention',      bg: '#FEF2F2', text: '#DC2626', dot: '#F87171' },
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
