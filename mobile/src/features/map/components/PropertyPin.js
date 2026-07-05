import { Marker } from 'react-native-maps'
import { View, Text, StyleSheet } from 'react-native'
import { colors } from '@theme/colors'
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

export default function PropertyPin({ pin, selected, onPress }) {
  // tracksViewChanges must stay true until the pill view actually reports its
  // own layout, or react-native-maps can freeze the marker on the default red
  // pin (see useMarkerRedraw). Key on selection + label so both trigger a
  // recapture when the pill's content changes.
  const { tracksViewChanges, onLayout } = useMarkerRedraw(`${selected}:${pin.rent}:${pin.bhk}:${pin.sharing}`)

  return (
    <Marker
      coordinate={{ latitude: +pin.lat, longitude: +pin.lng }}
      onPress={onPress}
      tracksViewChanges={tracksViewChanges}
      anchor={{ x: 0.5, y: 1 }}
    >
      <View style={[styles.pill, selected && styles.pillSelected]} onLayout={onLayout}>
        <Text style={[styles.pillText, selected && styles.pillTextSelected]} numberOfLines={1}>
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
    borderColor: colors.brand600,
    borderRadius: radius.full,
    paddingHorizontal: 10,
    paddingVertical: 5,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  pillSelected: { backgroundColor: colors.brand600 },
  pillText: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.xs, color: colors.brand700 },
  pillTextSelected: { color: colors.white },
})
