// Collapsible filter section card — closed cards sit on a muted background,
// the open card lifts to white with a divider under its header (mirrors
// web's FilterSection).
import { useState } from 'react'
import { View, Text, Pressable, StyleSheet } from 'react-native'
import Icon from '@components/common/Icon'
import { colors } from '@theme/colors'
import { fonts, fontSizes } from '@theme/typography'
import { spacing, radius } from '@theme/spacing'

export default function FilterSection({ label, activeCount, defaultOpen = false, onClear, children }) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <View style={[styles.card, open ? styles.cardOpen : styles.cardClosed]}>
      <Pressable style={styles.header} onPress={() => setOpen((v) => !v)} accessibilityRole="button" accessibilityState={{ expanded: open }}>
        <View style={styles.titleWrap}>
          <Text style={styles.title}>{label}</Text>
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
            <Icon name="chevronDown" size={14} color={colors.slate500} />
          </View>
        </View>
      </Pressable>

      {open && <View style={styles.body}>{children}</View>}
    </View>
  )
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.lg, borderWidth: 1 },
  cardOpen: { borderColor: colors.slate400, backgroundColor: colors.white },
  cardClosed: { borderColor: colors.slate200, backgroundColor: colors.slate50 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.md, paddingVertical: spacing.md - 2,
  },
  titleWrap: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  title: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.sm + 1, color: colors.slate800 },
  badge: {
    minWidth: 20, height: 20, borderRadius: 10, backgroundColor: colors.brand600,
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5,
  },
  badgeText: { fontFamily: fonts.bodySemiBold, fontSize: 11, color: colors.white },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: spacing.md - 4 },
  clear: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.xs, color: colors.slate400, textDecorationLine: 'underline' },
  chevron: {
    width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center',
  },
  chevronOpen: { backgroundColor: colors.slate100, transform: [{ rotate: '180deg' }] },
  body: {
    borderTopWidth: 1, borderTopColor: colors.slate100,
    paddingHorizontal: spacing.md, paddingTop: spacing.md, paddingBottom: spacing.md + 4,
    gap: spacing.md + 4,
  },
})
