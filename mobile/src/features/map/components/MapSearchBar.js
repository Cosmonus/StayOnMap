import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { View, Text, TextInput, Pressable, FlatList, Keyboard, ActivityIndicator, Alert, StyleSheet } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { useFilterStore } from '@store/filterStore'
import { useMapStore } from '@store/mapStore'
import { usePlaceSuggestions } from '../hooks/usePlaceSuggestions'
import { geocodeAddress } from '@lib/googleGeocoding'
import Icon from '@components/common/Icon'
import { colors } from '@theme/colors'
import { shadows } from '@theme/shadows'
import { fonts, fontSizes } from '@theme/typography'
import { spacing, radius } from '@theme/spacing'

const RECENTS_KEY = 'stayonmap_recent_areas'
const MAX_RECENTS = 5

async function getRecents() {
  try {
    const raw = await AsyncStorage.getItem(RECENTS_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

async function saveRecent(label) {
  if (!label?.trim()) return
  const prev = await getRecents()
  const next = [label, ...prev.filter((r) => r !== label)].slice(0, MAX_RECENTS)
  try {
    await AsyncStorage.setItem(RECENTS_KEY, JSON.stringify(next))
  } catch {
    // best-effort — losing recent-search history isn't worth surfacing an error for
  }
}

// Floating search bar over the map (ExploreScreen) — live Google Places
// suggestions as you type, tap one and the map flies there immediately.
// Replaces the old separate full-screen "Search & filters" tab: no tab
// switch between typing a search and seeing it fly.
const MapSearchBar = forwardRef(function MapSearchBar(_props, ref) {
  const filters = useFilterStore((s) => s.filters)
  const setFilter = useFilterStore((s) => s.setFilter)
  const setSearchedPlace = useMapStore((s) => s.setSearchedPlace)
  const [query, setQuery] = useState(filters.area)
  const [focused, setFocused] = useState(false)
  const [recents, setRecents] = useState([])
  const [resolving, setResolving] = useState(false)
  const { suggestions, loading, error } = usePlaceSuggestions(query, filters.city)
  const inputRef = useRef(null)

  // Lets ExploreScreen's header search icon jump focus into this field
  // instead of duplicating the input itself up there.
  useImperativeHandle(ref, () => ({ focus: () => inputRef.current?.focus() }))

  // Keep the input in sync when `area` changes from elsewhere (e.g. "Clear
  // all filters" in the filters sheet) — typing itself never touches
  // `filters.area`, so this can't loop back on every keystroke.
  useEffect(() => {
    setQuery(filters.area)
  }, [filters.area])

  // Autocomplete predictions have no lat/lng of their own — resolve via
  // geocodeAddress() (the same proven endpoint the "Go"/Enter fallback
  // below uses) rather than the separate Place Details API, which can be
  // enabled/billed independently of Geocoding+Autocomplete on a Google
  // Cloud project. That mismatch previously meant suggestions could appear
  // but silently fail to resolve to a location when tapped.
  async function resolveAndFly(address, label) {
    setResolving(true)
    let loc = null
    let failureMessage = null
    try {
      loc = await geocodeAddress(address)
    } catch (err) {
      // Distinguish a genuine "place not found" (loc stays null, no error
      // thrown) from an actual API failure — otherwise a bad key/quota/
      // enablement issue on the backend looks identical to a typo.
      failureMessage = err?.message
    }
    setResolving(false)
    if (!loc) {
      Alert.alert(
        'Location not found',
        failureMessage ? `Search is unavailable right now (${failureMessage}).` : "We couldn't find that place. Try a different search term."
      )
      return
    }
    setFilter('area', label)
    setSearchedPlace(loc)
    saveRecent(label)
    setFocused(false)
    Keyboard.dismiss()
  }

  function selectPlace(item) {
    const label = item.structured_formatting?.main_text || item.description
    resolveAndFly(item.description, label)
  }

  function handleSubmit() {
    if (!query.trim()) return
    if (suggestions.length > 0) {
      selectPlace(suggestions[0])
      return
    }
    // Submitted before autocomplete resolved anything (e.g. a very fast
    // Enter press) — geocode the typed text directly.
    const cityLabel = filters.city ? `${filters.city}, ` : ''
    resolveAndFly(`${query}, ${cityLabel}India`, query.trim())
  }

  function clear() {
    setFilter('area', '')
    setSearchedPlace(null)
  }

  async function onFocus() {
    setFocused(true)
    setRecents(await getRecents())
  }

  // Belt-and-suspenders alongside onFocus: on some devices/timings the
  // TextInput can end up with native focus (the user is actively typing)
  // without onFocus having fired `focused` true first, which would hide the
  // suggestions dropdown entirely no matter what the API returns. Typing is
  // itself unambiguous proof the user is interacting with the field.
  function onChangeText(text) {
    setQuery(text)
    setFocused(true)
  }

  const trimmedQuery = query.trim()
  const showSuggestions = trimmedQuery.length >= 2 // mirrors usePlaceSuggestions' own search threshold
  const showRecents = !trimmedQuery && recents.length > 0
  const showDropdown = focused && (showSuggestions || showRecents)

  return (
    <View style={styles.wrap}>
      <View style={styles.barRow}>
        <View style={styles.inputWrap}>
          <Icon name="search" size={16} color={colors.slate500} />
          <TextInput
            ref={inputRef}
            style={styles.input}
            value={query}
            onChangeText={onChangeText}
            onFocus={onFocus}
            onBlur={() => setTimeout(() => setFocused(false), 150)}
            onSubmitEditing={handleSubmit}
            placeholder={filters.city ? `Search in ${filters.city}…` : 'Search area, e.g. Koramangala'}
            placeholderTextColor={colors.slate500}
            returnKeyType="search"
          />
          {(resolving || loading) && <ActivityIndicator size="small" color={colors.brand600} />}
          {!!query && !resolving && !loading && (
            <Pressable onPress={clear} hitSlop={16} accessibilityRole="button" accessibilityLabel="Clear search">
              <Icon name="close" size={14} color={colors.slate500} />
            </Pressable>
          )}
        </View>

        <Pressable
          style={[styles.goButton, resolving && styles.goButtonDisabled]}
          onPress={handleSubmit}
          disabled={resolving}
          accessibilityRole="button"
          accessibilityLabel="Search"
          accessibilityState={{ disabled: resolving, busy: resolving }}
        >
          <Text style={styles.goButtonText}>{resolving ? '…' : 'Go'}</Text>
        </Pressable>
      </View>

      {showDropdown && (
        <View style={styles.dropdown}>
          <FlatList
            data={showRecents ? recents.map((label) => ({ recent: true, label })) : suggestions}
            keyExtractor={(item, i) => item.place_id ?? item.label ?? String(i)}
            keyboardShouldPersistTaps="handled"
            ItemSeparatorComponent={() => <View style={styles.separator} />}
            ListEmptyComponent={
              showSuggestions && !loading
                ? <Text style={styles.emptyText}>{error ? `Search unavailable — ${error}` : 'No results'}</Text>
                : null
            }
            renderItem={({ item }) =>
              item.recent ? (
                <Pressable style={styles.option} onPress={() => setQuery(item.label)} accessibilityRole="button" accessibilityLabel={`Recent search ${item.label}`}>
                  <Icon name="clock" size={14} color={colors.slate500} />
                  <Text style={styles.optionText} numberOfLines={1}>{item.label}</Text>
                </Pressable>
              ) : (
                <Pressable
                  style={styles.option}
                  onPress={() => selectPlace(item)}
                  accessibilityRole="button"
                >
                  <Icon name="mapPin" size={14} color={colors.brand600} />
                  <View style={styles.optionTextWrap}>
                    <Text style={styles.optionText} numberOfLines={1}>
                      {item.structured_formatting?.main_text || item.description}
                    </Text>
                    {!!item.structured_formatting?.secondary_text && (
                      <Text style={styles.optionSubtext} numberOfLines={1}>{item.structured_formatting.secondary_text}</Text>
                    )}
                  </View>
                </Pressable>
              )
            }
          />
        </View>
      )}
    </View>
  )
})

export default MapSearchBar

const BAR_HEIGHT = 48

const styles = StyleSheet.create({
  wrap: { width: '100%' },
  barRow: { flexDirection: 'row', gap: spacing.sm },
  inputWrap: {
    flex: 1, height: BAR_HEIGHT, flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    backgroundColor: colors.white, borderRadius: radius.full,
    paddingHorizontal: spacing.md,
    ...shadows.md,
  },
  input: { flex: 1, fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.slate800 },
  goButton: {
    height: BAR_HEIGHT, paddingHorizontal: spacing.lg, borderRadius: radius.full, backgroundColor: colors.brand600,
    alignItems: 'center', justifyContent: 'center',
    ...shadows.md,
  },
  goButtonDisabled: { opacity: 0.6 },
  goButtonText: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.sm, color: colors.white },
  dropdown: {
    marginTop: spacing.sm, backgroundColor: colors.white, borderRadius: radius.lg, maxHeight: 260,
    ...shadows.float,
  },
  option: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.sm + 2 },
  optionTextWrap: { flex: 1, minWidth: 0 },
  optionText: { fontFamily: fonts.bodyMedium, fontSize: fontSizes.sm, color: colors.slate700 },
  optionSubtext: { fontFamily: fonts.body, fontSize: fontSizes.xs, color: colors.slate500, marginTop: 1 },
  separator: { height: 1, backgroundColor: colors.slate100, marginHorizontal: spacing.md },
  emptyText: { fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.slate500, textAlign: 'center', paddingVertical: spacing.lg },
})
