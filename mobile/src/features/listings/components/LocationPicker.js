import { useState } from 'react'
import { View, Text, TextInput, Pressable, StyleSheet } from 'react-native'
import NativeMapView, { PROVIDER_GOOGLE, Marker } from 'react-native-maps'
import { geocodeAddress } from '@lib/googleGeocoding'
import { colors } from '@theme/colors'
import { fonts, fontSizes } from '@theme/typography'
import { spacing, radius } from '@theme/spacing'

const INDIA_CENTER = { latitude: 20.5937, longitude: 78.9629 }

export default function LocationPicker({ value, onChange }) {
  const [query, setQuery] = useState('')

  async function handleSearch() {
    if (!query.trim()) return
    const loc = await geocodeAddress(`${query}, India`)
    if (loc) onChange({ lat: loc.lat, lng: loc.lng })
  }

  const region = value
    ? { latitude: value.lat, longitude: value.lng, latitudeDelta: 0.05, longitudeDelta: 0.05 }
    : { ...INDIA_CENTER, latitudeDelta: 20, longitudeDelta: 20 }

  return (
    <View style={{ gap: spacing.sm }}>
      <View style={styles.searchRow}>
        <TextInput
          style={styles.searchInput}
          value={query}
          onChangeText={setQuery}
          placeholder="Search area, e.g. Koramangala, Bengaluru"
          placeholderTextColor={colors.slate400}
          onSubmitEditing={handleSearch}
          returnKeyType="search"
        />
        <Pressable style={styles.searchButton} onPress={handleSearch}>
          <Text style={styles.searchButtonText}>Find</Text>
        </Pressable>
      </View>

      <NativeMapView
        provider={PROVIDER_GOOGLE}
        style={styles.map}
        region={region}
        onPress={(e) => onChange({ lat: e.nativeEvent.coordinate.latitude, lng: e.nativeEvent.coordinate.longitude })}
      >
        {value && (
          <Marker
            coordinate={{ latitude: value.lat, longitude: value.lng }}
            draggable
            onDragEnd={(e) => onChange({ lat: e.nativeEvent.coordinate.latitude, lng: e.nativeEvent.coordinate.longitude })}
          />
        )}
      </NativeMapView>

      <Text style={styles.hint}>
        {value
          ? `Pin at ${value.lat.toFixed(5)}, ${value.lng.toFixed(5)} — drag the marker to fine-tune`
          : 'Search your area then tap the map or drag the marker to set the exact location'}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  searchRow: { flexDirection: 'row', gap: spacing.sm },
  searchInput: {
    flex: 1, borderWidth: 1, borderColor: colors.slate200, borderRadius: radius.md,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm, fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.slate800,
  },
  searchButton: { backgroundColor: colors.brand600, borderRadius: radius.md, paddingHorizontal: spacing.lg, alignItems: 'center', justifyContent: 'center' },
  searchButtonText: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.sm, color: colors.white },
  map: { width: '100%', height: 200, borderRadius: radius.md },
  hint: { fontFamily: fonts.body, fontSize: fontSizes.xs, color: colors.slate400 },
})
