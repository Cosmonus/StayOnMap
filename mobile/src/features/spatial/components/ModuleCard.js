import { View, Text, Pressable, StyleSheet } from 'react-native'
import { ChevronRight } from 'lucide-react-native'
import { colors } from '@theme/colors'
import { shadows } from '@theme/shadows'
import { fonts } from '@theme/typography'
import { spacing, radius } from '@theme/spacing'
import { MODULE_META, BAND_LABEL } from '../meta'
import { factIcon } from '../factIcons'

// One spatial intelligence module as a summary card — RN mirror of web's
// ModuleCard, same shape top to bottom: which question (quiet), the answer
// (loud), three facts of evidence, then how much to trust it.
//
// What must never be cut: the assessment, the confidence band, and the marker
// that something is unknown travel together or not at all — a finding with no
// sign of how examined it is reads as far more certain than it is.
//
// Unlike web, the detail sheet's state lives in SpatialContextPanel (one
// sheet for all cards) so the summary-strip chips can open the same report.
const PREVIEW_FACTS = 3

export default function ModuleCard({ envelope, onOpen }) {
  const meta = MODULE_META[envelope.key] ?? { title: envelope.key, Icon: null }
  const band = BAND_LABEL[envelope.confidence?.band]
  const { Icon: ModuleIcon } = meta
  const preview = envelope.facts.slice(0, PREVIEW_FACTS)
  const hasMissing = envelope.missing?.length > 0
  const hasAnswer = Boolean(envelope.assessment?.label)

  return (
    <Pressable
      onPress={() => onOpen(envelope)}
      accessibilityRole="button"
      accessibilityLabel={`View the full ${meta.title} report`}
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
    >
      <View style={styles.eyebrow}>
        {ModuleIcon && <ModuleIcon size={16} color={colors.slate400} strokeWidth={2} />}
        <Text style={styles.eyebrowText}>{meta.title}</Text>
        <ChevronRight size={16} color={colors.slate300} strokeWidth={2.5} />
      </View>

      {hasAnswer && <Text style={styles.answer}>{envelope.assessment.label}</Text>}

      {/* A module that couldn't run has no assessment — its own missing notes
          take the answer's place, which is a real answer, not a broken card. */}
      {!hasAnswer && hasMissing && (
        <View style={styles.missingList}>
          {envelope.missing.map((note, i) => (
            <View key={i} style={styles.missingRow}>
              <Text style={styles.missingBullet}>·</Text>
              <Text style={styles.missingNote}>{note}</Text>
            </View>
          ))}
        </View>
      )}

      {preview.length > 0 && (
        <View style={styles.facts}>
          {preview.map((f) => {
            const Glyph = factIcon(f.key)
            return (
              <View key={f.key} style={styles.factRow}>
                <Glyph size={13} color={colors.slate300} strokeWidth={2} />
                <Text style={styles.factLabel}>{f.label}</Text>
                <Text style={styles.factValue} numberOfLines={2}>{f.display}</Text>
              </View>
            )
          })}
        </View>
      )}

      <View style={styles.footer}>
        {band ? (
          <Text style={[styles.band, { color: band.color }]}>
            {band.text}
            {hasMissing ? ' · what we don’t know' : ''}
          </Text>
        ) : <View />}
        <Text style={styles.reportLink}>Full report</Text>
      </View>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.white, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.slate100,
    padding: spacing.md + 2, ...shadows.card,
  },
  cardPressed: { borderColor: colors.brand200 },
  eyebrow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  eyebrowText: {
    flex: 1, fontFamily: fonts.bodySemiBold, fontSize: 11, color: colors.slate400,
    textTransform: 'uppercase', letterSpacing: 1,
  },
  answer: { fontFamily: fonts.bodySemiBold, fontSize: 15, lineHeight: 20, color: colors.slate900, marginTop: spacing.sm + 2 },
  missingList: { marginTop: spacing.sm + 2, gap: 4 },
  missingRow: { flexDirection: 'row', gap: 6 },
  missingBullet: { color: colors.slate300, fontSize: 12, lineHeight: 16 },
  missingNote: { flex: 1, fontFamily: fonts.body, fontSize: 12, lineHeight: 16, color: colors.slate500 },
  facts: { marginTop: spacing.md, gap: spacing.sm },
  factRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  factLabel: { fontFamily: fonts.body, fontSize: 11, color: colors.slate400, marginTop: 1 },
  factValue: { flex: 1, fontFamily: fonts.bodySemiBold, fontSize: 11, color: colors.slate700, textAlign: 'right', marginTop: 1 },
  footer: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm,
    borderTopWidth: 1, borderTopColor: colors.slate100, paddingTop: spacing.sm + 2, marginTop: spacing.md,
  },
  band: { fontFamily: fonts.body, fontSize: 10 },
  reportLink: { fontFamily: fonts.bodySemiBold, fontSize: 11, color: colors.brand600 },
})
