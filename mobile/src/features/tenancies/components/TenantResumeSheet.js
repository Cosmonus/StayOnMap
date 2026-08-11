import { View, Text, Modal, Pressable, ScrollView, ActivityIndicator, StyleSheet } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useQuery } from '@tanstack/react-query'
import { tenancyService } from '@services/tenancy.service'
import Icon from '@components/common/Icon'
import { typeLabel } from '@config/propertyTypes'
import { tapSlop } from '@theme/touchTargets'
import { shadows } from '@theme/shadows'
import { colors } from '@theme/colors'
import { fonts, fontSizes } from '@theme/typography'
import { spacing, radius } from '@theme/spacing'

// A renter's rental résumé, opened by a HOST from a visit request — the RN
// mirror of web's TenantResumeModal. The backend answers only when a
// conversation or visit request connects the two people; a 404 here is "no
// history yet", the normal state, never a red error.

function span(e) {
  const fmt = (d) => new Date(d).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })
  return `${fmt(e.startedAt)} – ${e.endedAt ? fmt(e.endedAt) : 'now'}`
}

function Stars({ value, size = 12 }) {
  return (
    <View style={styles.starRow} accessible accessibilityRole="image" accessibilityLabel={`Rated ${value} out of 5`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Icon key={n} name={n <= value ? 'star' : 'starOutline'} size={size} color={n <= value ? colors.warning : colors.slate200} />
      ))}
    </View>
  )
}

export default function TenantResumeSheet({ userId, name, visible, onClose }) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['tenant-resume', userId],
    queryFn: () => tenancyService.resume(userId).then((r) => r.data),
    enabled: visible && !!userId,
    retry: false, // 404 is an answer — no history — not a flake
  })

  const firstName = (name ?? '').split(' ')[0] || 'Renter'

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <View style={styles.handle} />
          <View style={styles.header}>
            <Text style={styles.heading}>{firstName}&rsquo;s rental history</Text>
            <Pressable onPress={onClose} hitSlop={tapSlop(18)} accessibilityRole="button" accessibilityLabel="Close rental history">
              <Icon name="close" size={18} color={colors.slate500} />
            </Pressable>
          </View>

          {isLoading ? (
            <ActivityIndicator color={colors.brand600} style={{ marginVertical: spacing.xl }} />
          ) : isError || !data?.count ? (
            <Text style={styles.empty}>
              No confirmed rental history on StayOnMap yet. That&rsquo;s the normal state for most
              renters — history builds one tenancy at a time.
            </Text>
          ) : (
            <ScrollView style={styles.list} contentContainerStyle={{ gap: spacing.sm, paddingBottom: spacing.lg }}>
              <View style={styles.summaryRow}>
                <Icon name="key" size={14} color={colors.brand600} />
                <Text style={styles.summary}>
                  {data.count} confirmed tenanc{data.count === 1 ? 'y' : 'ies'}
                  {data.averageRating != null ? ` · ${data.averageRating}★ average` : ''}
                </Text>
              </View>
              {data.tenancies.map((e, i) => (
                <View key={i} style={styles.entry}>
                  <Text style={styles.entryTitle}>{typeLabel(e.propertyType) ?? e.propertyType} in {e.city}</Text>
                  <Text style={styles.entryMeta}>{span(e)}</Text>
                  {e.review && (
                    <View style={styles.reviewWell}>
                      <Stars value={e.review.rating} />
                      <Text style={styles.reviewBody}>{e.review.content}</Text>
                    </View>
                  )}
                </View>
              ))}
              <Text style={styles.footnote}>
                Reviews are written by previous owners and shown only after the double-blind window.
              </Text>
            </ScrollView>
          )}
          <SafeAreaView edges={['bottom']} />
        </Pressable>
      </Pressable>
    </Modal>
  )
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.white, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl,
    paddingHorizontal: spacing.lg, maxHeight: '80%', ...shadows.sheet,
  },
  handle: { alignSelf: 'center', width: 40, height: 5, borderRadius: 3, backgroundColor: colors.slate200, marginTop: spacing.sm + 2 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: spacing.md },
  heading: { fontFamily: fonts.displayBold, fontSize: fontSizes.lg, color: colors.slate800 },
  empty: { fontFamily: fonts.body, fontSize: fontSizes.sm, lineHeight: 20, color: colors.slate600, paddingBottom: spacing.xl },
  list: { flexGrow: 0 },
  summaryRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  summary: { fontFamily: fonts.bodyMedium, fontSize: fontSizes.sm, color: colors.slate700 },
  entry: { borderWidth: 1, borderColor: colors.slate200, borderRadius: radius.md, padding: spacing.sm + 4, gap: 2 },
  entryTitle: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.sm, color: colors.slate800 },
  entryMeta: { fontFamily: fonts.body, fontSize: fontSizes.xs, color: colors.slate500 },
  reviewWell: { backgroundColor: colors.slate50, borderRadius: radius.sm, padding: spacing.sm, gap: 4, marginTop: 4 },
  reviewBody: { fontFamily: fonts.body, fontSize: fontSizes.sm, lineHeight: 20, color: colors.slate700 },
  starRow: { flexDirection: 'row', gap: 1 },
  footnote: { fontFamily: fonts.body, fontSize: fontSizes.xs, color: colors.slate500 },
})
