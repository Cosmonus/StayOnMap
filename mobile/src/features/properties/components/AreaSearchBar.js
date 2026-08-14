import { useEffect, useRef, useState } from 'react'
import { View, Text, TextInput, Pressable, ActivityIndicator, Keyboard, StyleSheet } from 'react-native'
import { usePlaceSuggestions } from '@/hooks/usePlaceSuggestions'
import { geocodeAddress } from '@lib/googleGeocoding'
import { useFilterStore } from '@store/filterStore'
import Icon from '@components/common/Icon'
import { colors } from '@theme/colors'
import { tapSlop } from '@theme/touchTargets'
import { fonts, fontSizes } from '@theme/typography'
import { spacing, radius } from '@theme/spacing'

// The Properties tab's own place search. Same engine as the map's search bar —
// usePlaceSuggestions for predictions, geocodeAddress to resolve the one that
// was tapped (predictions carry no lat/lng of their own) — but the OUTCOME
// differs, which is why this is not MapSearchBar reused: the map flies its
// viewport somewhere; this hands `{ label, lat, lng }` back to the LIST, which
// constrains its query to a box around that point. Searching a place should
// never yank someone off the list they are reading (user-reported 2026-08-14 —
// the first cut navigated to the map).
export default function AreaSearchBar({ onSelect, onClose }) {
  const city = useFilterStore((s) => s.filters.city)
  const [query, setQuery] = useState('')
  const [resolving, setResolving] = useState(false)
  const inputRef = useRef(null)
  const { suggestions, loading } = usePlaceSuggestions(query, city)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  async function choose(item) {
    if (resolving) return
    setResolving(true)
    try {
      const loc = await geocodeAddress(item.description)
      if (loc) {
        Keyboard.dismiss()
        onSelect({
          label: item.structured_formatting?.main_text || item.description,
          lat: loc.lat,
          lng: loc.lng,
        })
      }
    } finally {
      setResolving(false)
    }
  }

  return (
    <View style={styles.wrap}>
      <View style={styles.inputRow}>
        <Icon name="search" size={16} color={colors.slate500} />
        <TextInput
          ref={inputRef}
          style={styles.input}
          value={query}
          onChangeText={setQuery}
          placeholder="Search an area or landmark"
          placeholderTextColor={colors.slate500}
          returnKeyType="search"
          onSubmitEditing={() => suggestions[0] && choose(suggestions[0])}
          accessibilityLabel="Search an area or landmark"
        />
        {(loading || resolving) && <ActivityIndicator size="small" color={colors.brand600} />}
        <Pressable
          onPress={onClose}
          hitSlop={tapSlop(16)}
          accessibilityRole="button"
          accessibilityLabel="Close search"
        >
          <Icon name="close" size={16} color={colors.slate600} />
        </Pressable>
      </View>
      {suggestions.length > 0 && (
        <View style={styles.suggestions}>
          {suggestions.slice(0, 5).map((item) => (
            <Pressable
              key={item.place_id ?? item.description}
              style={styles.suggestionRow}
              onPress={() => choose(item)}
              accessibilityRole="button"
              accessibilityLabel={item.description}
            >
              <Icon name="mapPin" size={14} color={colors.slate500} />
              <Text style={styles.suggestionText} numberOfLines={1}>
                {item.description}
              </Text>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.slate200,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 48,
    backgroundColor: colors.slate50,
    borderWidth: 1,
    borderColor: colors.slate200,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
  },
  input: {
    flex: 1,
    fontFamily: fonts.body,
    fontSize: fontSizes.sm,
    color: colors.slate800,
    paddingVertical: 0,
    minHeight: 48,
  },
  suggestions: { paddingTop: spacing.xs },
  suggestionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 48,
    paddingHorizontal: spacing.xs,
  },
  suggestionText: {
    flex: 1,
    fontFamily: fonts.body,
    fontSize: fontSizes.sm,
    color: colors.slate700,
  },
})
