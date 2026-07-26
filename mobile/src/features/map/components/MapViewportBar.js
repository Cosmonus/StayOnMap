import { View, Text, Pressable, StyleSheet } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import Icon from '@components/common/Icon'
import { useMapStore } from '@store/mapStore'
import { useFilterStore } from '@store/filterStore'
import { colors } from '@theme/colors'
import { shadows } from '@theme/shadows'
import { fonts, fontSizes } from '@theme/typography'
import { spacing, radius } from '@theme/spacing'

// What the current viewport holds — the same count web shows at the bottom of
// its map (MapViewportBar.jsx), in the same words. Mobile had no equivalent at
// all: you could pan the map and never learn whether it was showing three homes
// or three hundred, and an empty area was indistinguishable from a failed fetch.
//
// Deliberately NOT a second results panel: the map keeps the whole surface and
// this reports, then hands off. Tapping the count opens the same homes as a
// list (PropertyListScreen), which is web's "See them as a list" — mobile had
// the count and no destination until 2026-07-27, so forty pins could only be
// read one tap at a time.
export default function MapViewportBar() {
  const navigation = useNavigation()
  const pins = useMapStore((s) => s.pins)
  const bounds = useMapStore((s) => s.bounds)
  const filters = useFilterStore((s) => s.filters)

  // GET /properties/pins returns at most 200 rows (the backend's `take: 200`),
  // so on a dense viewport this is a floor, not a total — hence the "+".
  const PIN_LIMIT = 200
  const count = pins.length
  const capped = count >= PIN_LIMIT

  // "2 places for sale in this view" over a pair of plots. `rent` is the primary
  // price in all pricing modes, and so is the map — only the noun changes.
  const noun = filters.pricingModel === 'SALE'
    ? { one: 'place for sale', plural: 'places for sale' }
    : { one: 'home', plural: 'homes' }

  // No bounds yet means the map has not reported a viewport, so no pin fetch has
  // happened. Claiming "no homes in this view" then is a false negative during
  // loading — the loudest possible way to make someone think listings failed.
  const label = !bounds
    ? `Loading ${noun.plural}…`
    : count === 0
      ? `No ${noun.plural} in this view — try zooming out`
      : null

  // The muted states report and nothing more — there is no list to open when
  // the count is zero or unknown, so they stay untappable.
  if (label) {
    return (
      <View style={styles.wrap} pointerEvents="none">
        <View style={styles.pillMuted}>
          <Text style={styles.mutedText}>{label}</Text>
        </View>
      </View>
    )
  }

  return (
    <View style={styles.wrap}>
      <Pressable
        style={styles.pill}
        onPress={() => navigation.navigate('PropertyList')}
        accessibilityRole="button"
        accessibilityLabel={`See ${count}${capped ? ' or more' : ''} ${count === 1 ? noun.one : noun.plural} in this view as a list`}
      >
        <Text style={styles.count}>{count}{capped ? '+' : ''}</Text>
        <Text style={styles.suffix}>
          {count === 1 ? `${noun.one} in this view` : `${noun.plural} in this view`}
        </Text>
        <Icon name="chevronRight" size={16} color="rgba(255,255,255,0.7)" />
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center' },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.slate900,
    borderRadius: radius.full,
    paddingHorizontal: spacing.md,
    minHeight: 44,
    ...shadows.float,
  },
  pillMuted: {
    backgroundColor: colors.slate900,
    opacity: 0.9,
    borderRadius: radius.full,
    paddingHorizontal: spacing.md,
    minHeight: 36,
    justifyContent: 'center',
    ...shadows.float,
  },
  count: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.sm, color: colors.white },
  suffix: { fontFamily: fonts.body, fontSize: fontSizes.sm, color: 'rgba(255,255,255,0.7)' },
  mutedText: { fontFamily: fonts.body, fontSize: fontSizes.sm, color: 'rgba(255,255,255,0.9)' },
})
