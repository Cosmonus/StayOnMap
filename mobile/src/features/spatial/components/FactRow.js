import { createElement } from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { colors } from '@theme/colors'
import { fonts } from '@theme/typography'
import { spacing, radius } from '@theme/spacing'
import { factIcon } from '../factIcons'
import ProvenanceChip from './ProvenanceChip'

// One fact: what it is, what it says, and where it came from. The icon is the
// scanning aid — these lists run to ten rows, and "nearest pharmacy" vs
// "nearest hospital" is quicker to find by symbol than by reading labels.
export default function FactRow({ fact, isLast }) {
  return (
    <View style={[styles.row, isLast && styles.rowLast]}>
      <View style={styles.iconWrap}>
        {/* createElement, not `const Glyph = factIcon(...)` + <Glyph />: the
            icon is looked up from a static map, but assigning a component to a
            capitalised local reads to react-hooks/static-components as a
            component DEFINED during render (which would reset its state every
            render). Rendering the looked-up component explicitly says what
            this actually is. */}
        {createElement(factIcon(fact.key), { size: 14, color: colors.slate500, strokeWidth: 2 })}
      </View>
      <View style={styles.body}>
        <Text style={styles.label}>{fact.label}</Text>
        <Text style={styles.display}>{fact.display}</Text>
        {/* The method is shown inline, not behind a tap — an estimate whose
            basis is hidden is an estimate most people read as a measurement. */}
        {!!fact.method && <Text style={styles.method}>{fact.method}</Text>}
      </View>
      <ProvenanceChip provenance={fact.provenance} />
    </View>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm + 2,
    paddingVertical: spacing.sm + 2, borderBottomWidth: 1, borderBottomColor: colors.slate50,
  },
  rowLast: { borderBottomWidth: 0 },
  iconWrap: {
    width: 28, height: 28, borderRadius: radius.md, backgroundColor: colors.slate50,
    alignItems: 'center', justifyContent: 'center', marginTop: 2,
  },
  body: { flex: 1, minWidth: 0 },
  label: { fontFamily: fonts.body, fontSize: 11, color: colors.slate500 },
  display: { fontFamily: fonts.bodySemiBold, fontSize: 13, lineHeight: 18, color: colors.slate800, marginTop: 2 },
  method: { fontFamily: fonts.body, fontSize: 10, lineHeight: 14, color: colors.slate400, marginTop: 2 },
})
