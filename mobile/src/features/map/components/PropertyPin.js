import { Marker } from 'react-native-maps'
import { View, Text, StyleSheet } from 'react-native'
import Icon from '@components/common/Icon'
import { colors } from '@theme/colors'
import { shadows } from '@theme/shadows'
import { fonts, fontSizes } from '@theme/typography'
import { radius } from '@theme/spacing'
import { formatCompact } from '@utils/format'
import { typeColor, typeIcon, darkenHex } from '@config/propertyTypes'
import { useMarkerRedraw } from '../hooks/useMarkerRedraw'

function bhkLabel(pin) {
  if (pin.bhk === 0) return 'Studio'
  if (pin.bhk) return `${pin.bhk}BHK`
  if (pin.sharing) return `${pin.sharing} Sharing`
  return null
}

// A price pill says nothing about WHAT is being priced, and colour alone
// couldn't answer it: there is no type legend on the map, so a brown pin next
// to an orange one was two prices and a guess. Web's pins have carried a type
// glyph since they were built (useMapPins.js inlines the same six lucide
// icons); mobile's carried only the colour until 2026-07-30.
//
// The icon is the answer for a plot and a shop especially — they have no BHK,
// so their pill was a bare number. The full word is on the preview card a tap
// away (PinPreviewCard's TYPE_LABEL, the same table this reads).
export default function PropertyPin({ pin, selected, onPress }) {
  // tracksViewChanges must stay true until the pill view actually reports its
  // own layout, or react-native-maps can freeze the marker on the default red
  // pin (see useMarkerRedraw). Key on selection + label so both trigger a
  // recapture when the pill's content changes.
  //
  // This is the first marker on the map whose child contains an SVG (Icon is
  // react-native-svg). Android snapshots a custom marker view to a bitmap, so
  // if the glyph is MISSING on device while the price still renders, the cause
  // is that snapshot firing before the SVG painted — the lever is the settle
  // delay in useMarkerRedraw's onLayout, not this file.
  const { tracksViewChanges, onLayout } = useMarkerRedraw(`${selected}:${pin.rent}:${pin.bhk}:${pin.sharing}:${pin.type}`)
  const color = typeColor(pin.type)
  const label = bhkLabel(pin)

  // Unselected the pill stays white — the icon and border carry the colour, and
  // an icon only needs 3:1 where text needs 4.5:1, which is what lets the
  // lighter type colours (the green is 3.1:1 on white) be used at all. The
  // price itself is slate800 for the same reason: it used to be drawn IN the
  // type colour, so a house pin's price sat at 3.1:1. Selected fills with the
  // DEEPER shade so the white label on it clears 4.5:1 too.
  return (
    <Marker
      coordinate={{ latitude: +pin.lat, longitude: +pin.lng }}
      onPress={onPress}
      tracksViewChanges={tracksViewChanges}
      anchor={{ x: 0.5, y: 1 }}
    >
      <View
        style={[styles.pill, { borderColor: color }, selected && { backgroundColor: darkenHex(color) }]}
        onLayout={onLayout}
      >
        <Icon name={typeIcon(pin.type)} size={16} color={selected ? colors.white : color} />
        <Text style={[styles.pillText, selected && styles.pillTextSelected]} numberOfLines={1}>
          {label ? `${formatCompact(pin.rent)} · ${label}` : formatCompact(pin.rent)}
        </Text>
      </View>
    </Marker>
  )
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.white,
    borderWidth: 1.5,
    borderRadius: radius.full,
    paddingLeft: 7,
    paddingRight: 10,
    paddingVertical: 4,
    ...shadows.md,
  },
  pillText: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.xs, color: colors.slate800 },
  pillTextSelected: { color: colors.white },
})
