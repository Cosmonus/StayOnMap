import { Marker } from 'react-native-maps'
import { View, Text, StyleSheet } from 'react-native'
import { colors } from '@theme/colors'
import { shadows } from '@theme/shadows'
import { fonts, fontSizes } from '@theme/typography'
import { radius } from '@theme/spacing'
import { formatCompact } from '@utils/format'
import { useMarkerRedraw } from '../hooks/useMarkerRedraw'

function bhkLabel(pin) {
  if (pin.bhk === 0) return 'Studio'
  if (pin.bhk) return `${pin.bhk}BHK`
  if (pin.sharing) return `${pin.sharing} Sharing`
  return null
}

// One color per wizard category (HOUSE/VILLA/INDEPENDENT_HOUSE share the
// "house" color since they're one category in the listing wizard) — mirrors
// frontend/src/features/map/hooks/useMapPins.js's TYPE_COLORS exactly, the
// only place on the map itself that shows which of the 6 types a pin is.
const TYPE_COLORS = {
  APARTMENT: '#0284C7',
  HOUSE: '#16A34A',
  VILLA: '#16A34A',
  INDEPENDENT_HOUSE: '#16A34A',
  LAND: '#B45309',
  PG: '#7C3AED',
  COMMERCIAL: '#EA580C',
  SHORT_STAY: '#DB2777',
}

function typeColor(pin) {
  return TYPE_COLORS[pin.type] ?? colors.brand600
}

export default function PropertyPin({ pin, selected, onPress }) {
  // tracksViewChanges must stay true until the pill view actually reports its
  // own layout, or react-native-maps can freeze the marker on the default red
  // pin (see useMarkerRedraw). Key on selection + label so both trigger a
  // recapture when the pill's content changes.
  const { tracksViewChanges, onLayout } = useMarkerRedraw(`${selected}:${pin.rent}:${pin.bhk}:${pin.sharing}`)
  const color = typeColor(pin)

  return (
    <Marker
      coordinate={{ latitude: +pin.lat, longitude: +pin.lng }}
      onPress={onPress}
      tracksViewChanges={tracksViewChanges}
      anchor={{ x: 0.5, y: 1 }}
    >
      <View
        style={[styles.pill, { borderColor: color }, selected && { backgroundColor: color }]}
        onLayout={onLayout}
      >
        <Text style={[styles.pillText, { color: selected ? colors.white : color }]} numberOfLines={1}>
          {bhkLabel(pin) ? `${bhkLabel(pin)} : ${formatCompact(pin.rent)}` : formatCompact(pin.rent)}
        </Text>
      </View>
    </Marker>
  )
}

const styles = StyleSheet.create({
  pill: {
    backgroundColor: colors.white,
    borderWidth: 1.5,
    borderRadius: radius.full,
    paddingHorizontal: 10,
    paddingVertical: 5,
    ...shadows.md,
  },
  pillText: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.xs },
})
