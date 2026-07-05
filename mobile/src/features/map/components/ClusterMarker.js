import { Marker } from 'react-native-maps'
import { View, Text, StyleSheet } from 'react-native'
import { colors } from '@theme/colors'
import { fonts, fontSizes } from '@theme/typography'
import { radius } from '@theme/spacing'
import { useMarkerRedraw } from '../hooks/useMarkerRedraw'

export default function ClusterMarker({ coordinate, count, onPress }) {
  // Track view changes until Android paints the bubble, otherwise the custom
  // view is never snapshotted and the marker shows as the default red pin.
  const { tracksViewChanges, onLayout } = useMarkerRedraw(count)

  return (
    <Marker coordinate={coordinate} onPress={onPress} tracksViewChanges={tracksViewChanges}>
      <View style={styles.bubble} onLayout={onLayout}>
        <Text style={styles.bubbleText}>{count}</Text>
      </View>
    </Marker>
  )
}

const styles = StyleSheet.create({
  bubble: {
    width: 36,
    height: 36,
    borderRadius: radius.full,
    backgroundColor: colors.brand600,
    borderWidth: 2,
    borderColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  bubbleText: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.sm, color: colors.white },
})
