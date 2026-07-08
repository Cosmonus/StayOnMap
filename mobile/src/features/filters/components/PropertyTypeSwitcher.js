// Single-select property-type category cards (same 6 categories, colors and
// icons as the listing wizard and the map pins). Tap the active card again
// to clear back to "all types". Selection drives which filter sections
// render below — the core of the dynamic filter system.
import { View, Text, Pressable, StyleSheet } from 'react-native'
import { TYPE_CATEGORIES } from '@config/filters'
import { colors } from '@theme/colors'
import { fonts } from '@theme/typography'
import { spacing, radius } from '@theme/spacing'

const intersects = (a, b) => a.some((v) => b.includes(v))

export default function PropertyTypeSwitcher({ selectedTypes, onChange }) {
  return (
    <View style={styles.grid}>
      {TYPE_CATEGORIES.map((category) => {
        const IconCmp = category.icon
        const active = intersects(selectedTypes, category.types)
        return (
          <Pressable
            key={category.id}
            onPress={() => onChange(active ? [] : [...category.types])}
            // Active = the type's own color as a soft tint + border (hex8 alpha)
            style={[styles.card, active && { borderColor: category.color, backgroundColor: `${category.color}14` }]}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
          >
            <IconCmp size={20} color={active ? category.color : colors.slate500} strokeWidth={2} />
            <Text style={[styles.label, active && { color: category.color, fontFamily: fonts.bodySemiBold }]}>
              {category.label}
            </Text>
          </Pressable>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  card: {
    width: '31%', flexGrow: 1,
    alignItems: 'center', gap: 6,
    paddingVertical: spacing.md - 4, paddingHorizontal: 4,
    borderRadius: radius.lg, borderWidth: 1, borderColor: colors.slate200,
    backgroundColor: colors.white,
  },
  label: { fontFamily: fonts.bodyMedium, fontSize: 12, color: colors.slate500 },
})
