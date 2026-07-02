import { Marker } from 'react-native-maps'
import { View, Text, StyleSheet } from 'react-native'
import { colors } from '@theme/colors'
import { fonts, fontSizes } from '@theme/typography'
import { radius } from '@theme/spacing'
import { formatCompact } from '@utils/format'

export default function PropertyPin({ pin, selected, onPress }) {
  return (
    <Marker
      coordinate={{ latitude: +pin.lat, longitude: +pin.lng }}
      onPress={onPress}
      tracksViewChanges={selected}
      anchor={{ x: 0.5, y: 1 }}
    >
      <View style={[styles.pill, selected && styles.pillSelected]}>
        <Text style={[styles.pillText, selected && styles.pillTextSelected]}>{formatCompact(pin.rent)}</Text>
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
