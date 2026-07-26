// Collapsible filter section. Deliberately borderless — structure is carried
// by whitespace and a single hairline between sections, so the only boxes in
// the sheet are the interactive elements themselves (chips, inputs). Mirrors
// web's FilterSection.
import { useState } from 'react'
import { View, Text, Pressable, StyleSheet } from 'react-native'
import Icon from '@components/common/Icon'
import { colors } from '@theme/colors'
import { fonts, fontSizes } from '@theme/typography'
import { spacing } from '@theme/spacing'

export default function FilterSection({ label, activeCount, defaultOpen = false, onClear, last = false, children }) {
  const [open, setOpen] = useState(defaultOpen)

  // RN has no :last-child — the footer supplies its own hairline, so the
  // final section skips its divider to avoid a doubled line.
  return (
    <View style={last ? null : styles.section}>
      <Pressable style={styles.header} onPress={() => setOpen((v) => !v)} accessibilityRole="button" accessibilityState={{ expanded: open }}>
        <View style={styles.titleWrap}>
          <Text style={[styles.title, open && styles.titleOpen]}>{label}</Text>
          {activeCount > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{activeCount}</Text>
            </View>
          )}
        </View>
        <View style={styles.headerRight}>
          {activeCount > 0 && (
            <Text style={styles.clear} onPress={onClear} suppressHighlighting>
              Clear
            </Text>
          )}
          <View style={[styles.chevron, open && styles.chevronOpen]}>
            <Icon name="chevronDown" size={15} color={colors.slate500} />
          </View>
        </View>
      </Pressable>

      {open && <View style={styles.body}>{children}</View>}
    </View>
  )
}

const styles = StyleSheet.create({
  section: { borderBottomWidth: 1, borderBottomColor: colors.slate100 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: spacing.md,
  },
  titleWrap: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm + 2 },
  title: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.sm + 1, color: colors.slate600 },
  titleOpen: { color: colors.slate800 },
  badge: {
    minWidth: 20, height: 20, borderRadius: 10, backgroundColor: colors.slate800,
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5,
  },
  badgeText: { fontFamily: fonts.bodySemiBold, fontSize: 11, color: colors.white },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: spacing.md - 4 },
  clear: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.xs, color: colors.slate500, textDecorationLine: 'underline' },
  chevron: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  chevronOpen: { backgroundColor: colors.slate100, transform: [{ rotate: '180deg' }] },
  body: { paddingBottom: spacing.lg, gap: spacing.md + 4 },
})
