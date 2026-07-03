import { useEffect, useState } from 'react'
import { Marker } from 'react-native-maps'
import { View, Text, StyleSheet } from 'react-native'
import { colors } from '@theme/colors'
import { fonts, fontSizes } from '@theme/typography'
import { radius } from '@theme/spacing'
import { formatCompact } from '@utils/format'

function bhkLabel(pin) {
  if (pin.bhk === 0) return 'Studio'
  if (pin.bhk) return `${pin.bhk}BHK`
  if (pin.sharing) return `${pin.sharing} Sharing`
  return null
}

export default function PropertyPin({ pin, selected, onPress }) {
  // tracksViewChanges must stay true for a beat after `selected` flips so
  // react-native-maps captures a fresh snapshot of the new look — turning
  // it off in the same render as the flip freezes the marker on its last
  // (stale) snapshot, e.g. staying green after deselecting.
  const [tracksViewChanges, setTracksViewChanges] = useState(true)
  useEffect(() => {
    setTracksViewChanges(true)
    const timer = setTimeout(() => setTracksViewChanges(false), 150)
    return () => clearTimeout(timer)
  }, [selected])

  return (
    <Marker
      coordinate={{ latitude: +pin.lat, longitude: +pin.lng }}
      onPress={onPress}
      tracksViewChanges={tracksViewChanges}
      anchor={{ x: 0.5, y: 1 }}
    >
      <View style={[styles.pill, selected && styles.pillSelected]}>
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
