import { View, Text, Pressable, Linking, StyleSheet } from 'react-native'
import NativeMapView, { PROVIDER_GOOGLE, Marker } from 'react-native-maps'
import Icon from '@components/common/Icon'
import { colors } from '@theme/colors'
import { fonts, fontSizes } from '@theme/typography'
import { spacing, radius } from '@theme/spacing'

// Mirrors frontend/src/features/listings/components/ListingDetailContent.jsx's
// map card — non-interactive preview + a Directions button that hands off to
// the device's own maps app (Google Maps app if installed, else browser),
// rather than trying to render turn-by-turn directions ourselves. Doesn't
// repeat the address text — PropertyDetailScreen already shows it under the
// title, right above this card.
export default function LocationMapCard({ lat, lng, approximate = false }) {
  if (lat == null || lng == null) return null

  function openDirections() {
    Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`).catch(() => {})
  }

  return (
    <View style={styles.section}>
      <View style={styles.header}>
        <Text style={styles.sectionTitle}>Location</Text>
        <Pressable style={styles.directionsButton} onPress={openDirections} hitSlop={{ top: 8, bottom: 8 }} accessibilityRole="button" accessibilityLabel="Get directions">
          <Icon name="arrowRight" size={14} color={colors.white} />
          <Text style={styles.directionsText}>Directions</Text>
        </Pressable>
      </View>

      <Pressable style={styles.mapWrap} onPress={openDirections} accessibilityRole="button" accessibilityLabel="Open location in maps app">
        <NativeMapView
          provider={PROVIDER_GOOGLE}
          style={StyleSheet.absoluteFill}
          initialRegion={{ latitude: lat, longitude: lng, latitudeDelta: 0.012, longitudeDelta: 0.012 }}
          scrollEnabled={false}
          zoomEnabled={false}
          rotateEnabled={false}
          pitchEnabled={false}
          pointerEvents="none"
        >
          <Marker coordinate={{ latitude: lat, longitude: lng }} />
        </NativeMapView>
      </Pressable>

      {/* The owner chose to hide their exact address, so the pin is snapped to a
          ~150m cell. Say so: a precise-looking marker at a place we deliberately
          made imprecise is the same "confidently wrong" failure as the assumed
          walk times, and it explains why Directions stops at the corner. */}
      {approximate && (
        <Text style={styles.approximateNote}>
          Approximate location — this owner shares the area rather than the exact
          address. You&apos;ll get directions to the door once you arrange a visit.
        </Text>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  approximateNote: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.sm,
    color: colors.slate500,
    lineHeight: 21,
    marginTop: spacing.sm,
  },
  section: { marginTop: spacing.lg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm },
  sectionTitle: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.base, color: colors.slate800 },
  directionsButton: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: colors.brand600, borderRadius: radius.md, paddingHorizontal: spacing.sm + 2, paddingVertical: 6,
  },
  directionsText: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.xs, color: colors.white },
  mapWrap: { height: 160, borderRadius: radius.lg, overflow: 'hidden', backgroundColor: colors.slate100 },
})
