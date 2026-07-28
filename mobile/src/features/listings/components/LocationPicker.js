import { useEffect, useRef, useState } from 'react'
import { View, Text, TextInput, Pressable, Modal, ActivityIndicator, StyleSheet } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import NativeMapView, { PROVIDER_GOOGLE, Marker } from 'react-native-maps'
import { autocompletePlaces } from '@lib/googlePlaces'
import { geocodeAddress } from '@lib/googleGeocoding'
import Icon from '@components/common/Icon'
import { colors } from '@theme/colors'
import { fonts, fontSizes } from '@theme/typography'
import { spacing, radius } from '@theme/spacing'
import { shadows } from '@theme/shadows'

const INDIA_CENTER = { latitude: 20.5937, longitude: 78.9629 }

// Search works like the map's own search bar (MapSearchBar.js): live Places
// suggestions through the backend proxy, and picking one geocodes its full
// description. It replaced a bare geocode-on-submit whose failures were
// swallowed whole — an unhandled rejection meant "Find" could do literally
// nothing, with no way to tell why.
//
// The inline map is for orientation; the expand button opens a full-screen
// editor for the actual pin work. A 200pt map inside a scrolling wizard step
// was too small to zoom, and every drag fought the ScrollView for the gesture.

function PickerMap({ mapRef, value, onChange, style, fullscreen }) {
  // initialRegion, not region — a controlled `region` prop rebuilt as a new
  // object on every render is a known react-native-maps instability/crash
  // source on Android. Camera moves after mount go through mapRef instead.
  const initialRegion = value
    ? { latitude: value.lat, longitude: value.lng, latitudeDelta: 0.02, longitudeDelta: 0.02 }
    : { ...INDIA_CENTER, latitudeDelta: 20, longitudeDelta: 20 }

  return (
    <NativeMapView
      ref={mapRef}
      provider={PROVIDER_GOOGLE}
      style={style}
      initialRegion={initialRegion}
      showsCompass={fullscreen}
      toolbarEnabled={false}
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
  )
}

export default function LocationPicker({ value, onChange }) {
  const [query, setQuery] = useState('')
  const [suggestions, setSuggestions] = useState([])
  const [searching, setSearching] = useState(false)
  const [error, setError] = useState('')
  const [expanded, setExpanded] = useState(false)
  const mapRef = useRef(null)
  const bigMapRef = useRef(null)
  const debounceRef = useRef(null)
  const pickedRef = useRef(false)

  // Live suggestions, debounced 300ms — same cadence as MapSearchBar. A pick
  // sets the query programmatically; pickedRef stops that from re-opening the
  // list it just closed.
  useEffect(() => {
    clearTimeout(debounceRef.current)
    if (pickedRef.current) { pickedRef.current = false; return }
    if (query.trim().length < 2) { setSuggestions([]); return }
    debounceRef.current = setTimeout(() => {
      autocompletePlaces(query)
        .then(setSuggestions)
        .catch(() => setSuggestions([]))
    }, 300)
    return () => clearTimeout(debounceRef.current)
  }, [query])

  // Fit the place's own extent (the geocoder's viewport) — a city shows the
  // whole city, a street its block — and let the owner zoom in from there. A
  // fixed 0.02° delta dropped a "Bengaluru" search onto one arbitrary street.
  function regionFor({ lat, lng, viewport }) {
    if (viewport) {
      return {
        latitude: (viewport.neLat + viewport.swLat) / 2,
        longitude: (viewport.neLng + viewport.swLng) / 2,
        latitudeDelta: Math.max((viewport.neLat - viewport.swLat) * 1.2, 0.01),
        longitudeDelta: Math.max((viewport.neLng - viewport.swLng) * 1.2, 0.01),
      }
    }
    return { latitude: lat, longitude: lng, latitudeDelta: 0.02, longitudeDelta: 0.02 }
  }

  function moveTo(loc) {
    onChange({ lat: loc.lat, lng: loc.lng })
    const region = regionFor(loc)
    mapRef.current?.animateToRegion(region, 400)
    bigMapRef.current?.animateToRegion(region, 400)
  }

  async function resolve(address) {
    setError('')
    setSearching(true)
    try {
      const loc = await geocodeAddress(address)
      if (!loc) {
        setError('Couldn’t find that place — check the spelling or try a nearby landmark.')
        return
      }
      moveTo(loc)
    } catch {
      setError('Search failed — check your connection and try again.')
    } finally {
      setSearching(false)
    }
  }

  function pickSuggestion(s) {
    pickedRef.current = true
    setQuery(s.structured_formatting?.main_text ?? s.description)
    setSuggestions([])
    // Geocode the full description, not the Place Details API — that is a
    // separate Google product that can be enabled independently, and mixing
    // them once made suggestions appear but silently fail to resolve
    // (see .claude/maps.md, Mobile Search).
    resolve(s.description)
  }

  function submit() {
    setSuggestions([])
    if (!query.trim()) return
    resolve(`${query}, India`)
  }

  return (
    <View style={{ gap: spacing.sm }}>
      <View style={styles.searchRow}>
        <View style={styles.searchInputWrap}>
          <Icon name="mapPin" size={16} color={colors.slate500} />
          <TextInput
            style={styles.searchInput}
            value={query}
            onChangeText={setQuery}
            placeholder="Search area, e.g. Koramangala, Bengaluru"
            placeholderTextColor={colors.slate500}
            onSubmitEditing={submit}
            returnKeyType="search"
            accessibilityLabel="Search your area"
          />
        </View>
        <Pressable
          style={[styles.searchButton, searching && styles.disabled]}
          onPress={submit}
          disabled={searching}
          accessibilityRole="button"
          accessibilityLabel="Find this area on the map"
        >
          {searching ? <ActivityIndicator size="small" color={colors.white} /> : <Text style={styles.searchButtonText}>Find</Text>}
        </Pressable>
      </View>

      {suggestions.length > 0 && (
        <View style={styles.suggestions}>
          {suggestions.slice(0, 5).map((s) => (
            <Pressable
              key={s.place_id}
              style={styles.suggestionRow}
              onPress={() => pickSuggestion(s)}
              accessibilityRole="button"
              accessibilityLabel={s.description}
            >
              <Icon name="mapPin" size={14} color={colors.slate500} />
              <View style={styles.suggestionText}>
                <Text style={styles.suggestionMain} numberOfLines={1}>
                  {s.structured_formatting?.main_text ?? s.description}
                </Text>
                {!!s.structured_formatting?.secondary_text && (
                  <Text style={styles.suggestionSub} numberOfLines={1}>{s.structured_formatting.secondary_text}</Text>
                )}
              </View>
            </Pressable>
          ))}
        </View>
      )}

      {!!error && <Text style={styles.error}>{error}</Text>}

      <View>
        <PickerMap mapRef={mapRef} value={value} onChange={onChange} style={styles.map} />
        <Pressable
          style={styles.expandButton}
          onPress={() => setExpanded(true)}
          accessibilityRole="button"
          accessibilityLabel="Open the full-screen map to place the pin"
        >
          <Icon name="maximize" size={16} color={colors.slate700} />
          <Text style={styles.expandText}>Expand</Text>
        </Pressable>
      </View>

      <Text style={styles.hint}>
        {value
          ? `Pin at ${value.lat.toFixed(5)}, ${value.lng.toFixed(5)} — drag the marker to fine-tune`
          : 'Search your area then tap the map or drag the marker to set the exact location'}
      </Text>

      {/* Full-screen pin editor. The pin state is the SAME `value` — edits
          apply immediately, Done just closes. onRequestClose is what makes
          hardware back dismiss it (mobile/AGENTS.md §2). Covers the tab bar,
          so it claims the bottom inset (§3's modal exception). */}
      <Modal visible={expanded} animationType="slide" onRequestClose={() => setExpanded(false)}>
        <SafeAreaView style={styles.fullscreen} edges={['bottom']}>
          <View style={styles.fullscreenHeader}>
            <Text style={styles.fullscreenTitle}>Drop the pin</Text>
            <Pressable
              onPress={() => setExpanded(false)}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel="Close the full-screen map"
              style={styles.fullscreenClose}
            >
              <Icon name="close" size={20} color={colors.slate700} />
            </Pressable>
          </View>
          <PickerMap mapRef={bigMapRef} value={value} onChange={onChange} style={styles.fullscreenMap} fullscreen />
          <View style={styles.fullscreenFooter}>
            <Text style={styles.fullscreenHint} numberOfLines={2}>
              {value
                ? `Pin at ${value.lat.toFixed(5)}, ${value.lng.toFixed(5)}`
                : 'Tap the map to place the pin, then drag it to the exact spot'}
            </Text>
            <Pressable
              style={[styles.doneButton, !value && styles.disabled]}
              onPress={() => setExpanded(false)}
              disabled={!value}
              accessibilityRole="button"
              accessibilityLabel="Use this location"
              accessibilityState={{ disabled: !value }}
            >
              <Text style={styles.doneButtonText}>Use this location</Text>
            </Pressable>
          </View>
        </SafeAreaView>
      </Modal>
    </View>
  )
}

const styles = StyleSheet.create({
  searchRow: { flexDirection: 'row', gap: spacing.sm },
  searchInputWrap: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    borderWidth: 1, borderColor: colors.slate200, borderRadius: radius.md, paddingHorizontal: spacing.md,
    backgroundColor: colors.white,
  },
  searchInput: {
    flex: 1, paddingVertical: spacing.sm, minHeight: 48, fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.slate800,
  },
  searchButton: { backgroundColor: colors.brand600, borderRadius: radius.md, paddingHorizontal: spacing.lg, minWidth: 64, alignItems: 'center', justifyContent: 'center' },
  searchButtonText: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.sm, color: colors.white },
  suggestions: {
    backgroundColor: colors.white, borderWidth: 1, borderColor: colors.slate200,
    borderRadius: radius.md, overflow: 'hidden',
  },
  suggestionRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm, minHeight: 48,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.slate100,
  },
  suggestionText: { flex: 1, minWidth: 0 },
  suggestionMain: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.sm, color: colors.slate800 },
  suggestionSub: { fontFamily: fonts.body, fontSize: fontSizes.xs, color: colors.slate500, marginTop: 1 },
  error: { fontFamily: fonts.body, fontSize: fontSizes.xs, color: colors.danger },
  map: { width: '100%', height: 280, borderRadius: radius.md },
  expandButton: {
    position: 'absolute', top: spacing.sm, right: spacing.sm,
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: colors.white, borderRadius: radius.md,
    paddingHorizontal: spacing.md, minHeight: 40, ...shadows.float,
  },
  expandText: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.xs, color: colors.slate700 },
  hint: { fontFamily: fonts.body, fontSize: fontSizes.xs, color: colors.slate500 },
  fullscreen: { flex: 1, backgroundColor: colors.white },
  fullscreenHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.lg, paddingVertical: spacing.sm,
    borderBottomWidth: 1, borderBottomColor: colors.slate100,
  },
  fullscreenTitle: { fontFamily: fonts.displayBold, fontSize: fontSizes.lg, color: colors.slate800 },
  fullscreenClose: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  fullscreenMap: { flex: 1 },
  fullscreenFooter: {
    gap: spacing.sm, paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.sm,
    borderTopWidth: 1, borderTopColor: colors.slate100, backgroundColor: colors.white,
  },
  fullscreenHint: { fontFamily: fonts.body, fontSize: fontSizes.xs, color: colors.slate500, textAlign: 'center' },
  doneButton: { minHeight: 52, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.brand600, borderRadius: radius.md },
  doneButtonText: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.sm, color: colors.white },
  disabled: { opacity: 0.6 },
})
