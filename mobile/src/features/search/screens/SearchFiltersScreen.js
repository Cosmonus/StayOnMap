import { useState } from 'react'
import { View, Text, TextInput, Pressable, ScrollView, StyleSheet } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useFilterStore } from '@store/filterStore'
import { useMapStore } from '@store/mapStore'
import { geocodeAddress } from '@lib/googleGeocoding'
import { CITY_NAMES } from '@config/cities'
import { colors } from '@theme/colors'
import { fonts, fontSizes } from '@theme/typography'
import { spacing, radius } from '@theme/spacing'

const BHK_OPTIONS = [0, 1, 2, 3, 4]
const BHK_LABEL = { 0: 'Studio' }
const FURNISHED_OPTIONS = [
  ['FULLY', 'Furnished'],
  ['SEMI', 'Semi'],
  ['UNFURNISHED', 'Unfurnished'],
]

function Chip({ label, active, onPress }) {
  return (
    <Pressable style={[styles.chip, active && styles.chipActive]} onPress={onPress}>
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </Pressable>
  )
}

export default function SearchFiltersScreen({ navigation }) {
  const filters = useFilterStore((s) => s.filters)
  const setFilter = useFilterStore((s) => s.setFilter)
  const resetFilters = useFilterStore((s) => s.resetFilters)
  const setSearchedPlace = useMapStore((s) => s.setSearchedPlace)
  const flyTo = useMapStore((s) => s.flyTo)
  const [areaInput, setAreaInput] = useState(filters.area)
  const [searching, setSearching] = useState(false)

  function toggleBhk(value) {
    const next = filters.bhk.includes(value) ? filters.bhk.filter((v) => v !== value) : [...filters.bhk, value]
    setFilter('bhk', next)
  }

  async function handleSearch() {
    if (!areaInput.trim()) return
    setSearching(true)
    const cityLabel = filters.city ? `${filters.city}, ` : ''
    const loc = await geocodeAddress(`${areaInput}, ${cityLabel}India`)
    setSearching(false)
    if (!loc) return
    setFilter('area', areaInput.trim())
    setSearchedPlace(loc)
    flyTo?.({ latitude: loc.lat, longitude: loc.lng, zoom: 15 })
    navigation.getParent()?.navigate('Explore')
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.heading}>Search & filters</Text>

        <Text style={styles.label}>Area or landmark</Text>
        <View style={styles.searchRow}>
          <TextInput
            style={styles.searchInput}
            value={areaInput}
            onChangeText={setAreaInput}
            placeholder="e.g. Koramangala"
            placeholderTextColor={colors.slate400}
            onSubmitEditing={handleSearch}
            returnKeyType="search"
          />
          <Pressable style={[styles.searchButton, searching && styles.disabled]} onPress={handleSearch} disabled={searching}>
            <Text style={styles.searchButtonText}>{searching ? '…' : 'Go'}</Text>
          </Pressable>
        </View>

        <Text style={styles.label}>City</Text>
        <View style={styles.chipRow}>
          {CITY_NAMES.map((name) => (
            <Chip key={name} label={name} active={filters.city === name} onPress={() => setFilter('city', filters.city === name ? '' : name)} />
          ))}
        </View>

        <Text style={styles.label}>Bedrooms</Text>
        <View style={styles.chipRow}>
          {BHK_OPTIONS.map((v) => (
            <Chip key={v} label={BHK_LABEL[v] ?? `${v} BHK`} active={filters.bhk.includes(v)} onPress={() => toggleBhk(v)} />
          ))}
        </View>

        <Text style={styles.label}>Furnishing</Text>
        <View style={styles.chipRow}>
          {FURNISHED_OPTIONS.map(([value, label]) => (
            <Chip key={value} label={label} active={filters.furnished === value} onPress={() => setFilter('furnished', filters.furnished === value ? null : value)} />
          ))}
        </View>

        <Pressable style={styles.resetButton} onPress={resetFilters}>
          <Text style={styles.resetButtonText}>Clear all filters</Text>
        </Pressable>

        <Pressable style={styles.applyButton} onPress={() => navigation.getParent()?.navigate('Explore')}>
          <Text style={styles.applyButtonText}>View on map</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.white },
  scroll: { padding: spacing.lg },
  heading: { fontFamily: fonts.displayBold, fontSize: fontSizes.xl, color: colors.slate800, marginBottom: spacing.lg },
  label: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.sm, color: colors.slate600, marginBottom: spacing.sm, marginTop: spacing.md },
  searchRow: { flexDirection: 'row', gap: spacing.sm },
  searchInput: {
    flex: 1, borderWidth: 1, borderColor: colors.slate200, backgroundColor: colors.slate50,
    borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm + 2,
    fontFamily: fonts.body, fontSize: fontSizes.base, color: colors.slate800,
  },
  searchButton: { backgroundColor: colors.brand600, borderRadius: radius.md, paddingHorizontal: spacing.lg, alignItems: 'center', justifyContent: 'center' },
  disabled: { opacity: 0.6 },
  searchButtonText: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.sm, color: colors.white },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: { borderWidth: 1, borderColor: colors.slate200, borderRadius: radius.full, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  chipActive: { backgroundColor: colors.brand600, borderColor: colors.brand600 },
  chipText: { fontFamily: fonts.bodyMedium, fontSize: fontSizes.sm, color: colors.slate600 },
  chipTextActive: { color: colors.white },
  resetButton: { marginTop: spacing.xl, alignItems: 'center' },
  resetButtonText: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.sm, color: colors.slate400 },
  applyButton: { marginTop: spacing.md, backgroundColor: colors.brand600, borderRadius: radius.md, paddingVertical: spacing.md, alignItems: 'center' },
  applyButtonText: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.base, color: colors.white },
})
