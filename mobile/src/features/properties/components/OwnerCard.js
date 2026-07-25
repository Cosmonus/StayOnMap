import { View, Text, Image, StyleSheet } from 'react-native'
import Icon from '@components/common/Icon'
import { colors } from '@theme/colors'
import { fonts, fontSizes } from '@theme/typography'
import { spacing, radius } from '@theme/spacing'

const TRUST_COLORS = {
  EXCELLENT: { fg: colors.brand700, bg: colors.brand50, bar: colors.brand500 },
  HIGH: { fg: '#15803D', bg: colors.success50, bar: colors.success },
  MEDIUM: { fg: '#A16207', bg: colors.warning50, bar: '#EAB308' },
  LOW: { fg: '#C2410C', bg: '#FFF7ED', bar: '#FB923C' },
}

export default function OwnerCard({ owner }) {
  if (!owner) return null
  const trust = owner.ownerTrustScore && owner.ownerTrustScore.level !== 'UNRATED' ? owner.ownerTrustScore : null
  const trustCfg = trust ? (TRUST_COLORS[trust.level] ?? TRUST_COLORS.MEDIUM) : null
  const memberSince = owner.createdAt
    ? new Date(owner.createdAt).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })
    : null

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Posted by</Text>
      <View style={styles.card}>
        <View style={styles.topRow}>
          {owner.avatarUrl ? (
            <Image source={{ uri: owner.avatarUrl }} style={styles.avatarImage} />
          ) : (
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{(owner.name || '?')[0].toUpperCase()}</Text>
            </View>
          )}
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.name} numberOfLines={1}>{owner.name || 'Property owner'}</Text>
            {!!memberSince && <Text style={styles.memberSince}>Member since {memberSince}</Text>}
          </View>
        </View>

        <View style={styles.badgeRow}>
          <View style={styles.directBadge}>
            <Icon name="check" size={11} color={colors.brand700} />
            <Text style={styles.directBadgeText}>Direct owner — no brokerage</Text>
          </View>
          {trust && (
            <View style={[styles.trustPill, { backgroundColor: trustCfg.bg }]}>
              <Text style={[styles.trustPillText, { color: trustCfg.fg }]}>OwnerTrust: {trust.score}/100</Text>
            </View>
          )}
        </View>

        {trust && (
          <View style={styles.trustBlock}>
            <View style={styles.trustHeader}>
              <Text style={styles.trustLabel}>OwnerTrust™</Text>
              <Text style={styles.trustLevel}>{trust.level[0] + trust.level.slice(1).toLowerCase()} · {trust.score}/100</Text>
            </View>
            <View style={styles.trustTrack}>
              <View style={[styles.trustFill, { backgroundColor: trustCfg.bar, width: `${Math.min(100, Number(trust.score))}%` }]} />
            </View>
            {Number(trust.responseRate) > 0 && (
              <Text style={styles.responseRate}>{Math.round(Number(trust.responseRate))}% response rate</Text>
            )}
          </View>
        )}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  section: { marginTop: spacing.lg },
  sectionTitle: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.base, color: colors.slate800, marginBottom: spacing.sm },
  card: { backgroundColor: colors.slate50, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.slate100, padding: spacing.md },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  avatar: { width: 44, height: 44, borderRadius: radius.full, backgroundColor: colors.brand100, alignItems: 'center', justifyContent: 'center' },
  avatarImage: { width: 44, height: 44, borderRadius: radius.full, backgroundColor: colors.slate100 },
  avatarText: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.base, color: colors.brand700 },
  name: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.sm, color: colors.slate800 },
  memberSince: { fontFamily: fonts.body, fontSize: fontSizes.xs, color: colors.slate500, marginTop: 1 },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.xs, marginTop: spacing.sm },
  directBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.brand50,
    borderWidth: 1, borderColor: colors.brand200, borderRadius: radius.full, paddingHorizontal: spacing.sm, paddingVertical: 3,
  },
  directBadgeText: { fontFamily: fonts.bodySemiBold, fontSize: 11, color: colors.brand700 },
  trustPill: { borderRadius: radius.full, paddingHorizontal: spacing.sm, paddingVertical: 3 },
  trustPillText: { fontFamily: fonts.bodySemiBold, fontSize: 11 },
  trustBlock: { marginTop: spacing.sm, gap: 4 },
  trustHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  trustLabel: { fontFamily: fonts.bodyMedium, fontSize: 11, color: colors.slate500 },
  trustLevel: { fontFamily: fonts.body, fontSize: 11, color: colors.slate500 },
  trustTrack: { height: 4, backgroundColor: colors.slate100, borderRadius: radius.full, overflow: 'hidden' },
  trustFill: { height: '100%', borderRadius: radius.full },
  responseRate: { fontFamily: fonts.body, fontSize: 11, color: colors.slate500 },
})
