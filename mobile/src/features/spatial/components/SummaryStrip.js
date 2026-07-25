import { View, Text, Pressable, StyleSheet } from 'react-native'
import { colors } from '@theme/colors'
import { fonts } from '@theme/typography'
import { spacing, radius } from '@theme/spacing'
import { factIcon } from '../factIcons'

// "Around this location" at a glance — one chip per thing that exists nearby,
// with its real count, before any card is opened. RN mirror of web's
// SummaryStrip with one deliberate difference: a chip tap opens the owning
// module's full report directly (there's no reliable scroll-to-element on a
// ScrollView screen, and the sheet is the better destination on a phone).
//
// Chips are built ONLY from facts that carry a `count` — real data the
// backend measured, never parsed out of display prose. The sparse-mapping
// note is load-bearing: in a lightly-mapped OSM area a low count is absence
// of data, not absence of shops.
const MAX_CHIPS = 8

// "Bus stops within 800 m" → "Bus stops" — the radius shows in the report.
const shortLabel = (label) => label.replace(/ within .*$/i, '')

export default function SummaryStrip({ envelopes, onOpenModule }) {
  const seen = new Set()
  const chips = []

  for (const envelope of envelopes) {
    for (const fact of envelope.facts) {
      if (!(fact.count > 0) || seen.has(fact.key)) continue
      seen.add(fact.key)
      chips.push({
        factKey: fact.key,
        envelope,
        label: shortLabel(fact.label),
        count: fact.count,
      })
    }
  }

  if (chips.length === 0) return null

  const sparse = envelopes.some((e) => e.sparselyMapped === true)

  return (
    <View style={styles.wrap}>
      <Text style={styles.heading}>Around this location</Text>
      <View style={styles.chips}>
        {chips.slice(0, MAX_CHIPS).map((chip) => {
          const Glyph = factIcon(chip.factKey)
          return (
            <Pressable
              key={chip.factKey}
              onPress={() => onOpenModule(chip.envelope)}
              accessibilityRole="button"
              accessibilityLabel={`${chip.count} ${chip.label} nearby — open details`}
              style={styles.chip}
            >
              <Glyph size={13} color={colors.slate500} strokeWidth={2} />
              <Text style={styles.count}>{chip.count}</Text>
              <Text style={styles.label}>{chip.label}</Text>
            </Pressable>
          )
        })}
      </View>
      {sparse && (
        <Text style={styles.sparseNote}>
          This area looks lightly mapped in OpenStreetMap — counts are a floor,
          not a total.
        </Text>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { marginTop: spacing.sm },
  heading: {
    fontFamily: fonts.bodySemiBold, fontSize: 11, color: colors.slate500,
    textTransform: 'uppercase', letterSpacing: 0.5,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    minHeight: 34, paddingHorizontal: 11, paddingVertical: 6,
    borderRadius: radius.full, borderWidth: 1, borderColor: colors.slate200, backgroundColor: colors.white,
  },
  count: { fontFamily: fonts.bodySemiBold, fontSize: 12, color: colors.slate800 },
  label: { fontFamily: fonts.body, fontSize: 11, color: colors.slate600 },
  sparseNote: { fontFamily: fonts.body, fontSize: 11, lineHeight: 14, color: colors.slate500, marginTop: 6 },
})
