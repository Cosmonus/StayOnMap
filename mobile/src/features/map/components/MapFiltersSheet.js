import { View, Text, Modal, Pressable, ScrollView, StyleSheet } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useFilterStore } from '@store/filterStore'
import { useMapStore } from '@store/mapStore'
import { CITY_NAMES } from '@config/cities'
import Icon from '@components/common/Icon'
import Dropdown from '@components/common/Dropdown'
import { colors } from '@theme/colors'
import { fonts, fontSizes } from '@theme/typography'
import { spacing, radius } from '@theme/spacing'

const BHK_OPTIONS = [0, 1, 2, 3, 4]
const BHK_LABEL = { 0: 'Studio' }
const BHK_DROPDOWN_OPTIONS = BHK_OPTIONS.map((v) => ({ value: v, label: BHK_LABEL[v] ?? `${v} BHK` }))
const FURNISHED_DROPDOWN_OPTIONS = [
  { value: null, label: 'Any' },
  { value: 'FULLY', label: 'Furnished' },
  { value: 'SEMI', label: 'Semi' },
  { value: 'UNFURNISHED', label: 'Unfurnished' },
]
const CITY_DROPDOWN_OPTIONS = [{ value: '', label: 'Any city' }, ...CITY_NAMES.map((name) => ({ value: name, label: name }))]

// Bottom sheet for the filters that aren't a location (BHK/Furnished/City) —
// the location half of search lives in MapSearchBar right above the map.
export default function MapFiltersSheet({ visible, onClose }) {
  const filters = useFilterStore((s) => s.filters)
  const setFilter = useFilterStore((s) => s.setFilter)
  const resetFilters = useFilterStore((s) => s.resetFilters)
  const setSearchedPlace = useMapStore((s) => s.setSearchedPlace)

  // MapView's city-fly effect deliberately no-ops while `area` is set (an
  // area search takes precedence) — clear any leftover searched area first,
  // otherwise picking a city here would silently fail to fly anywhere.
  function handleCityChange(val) {
    setFilter('city', val)
    if (filters.area) {
      setFilter('area', '')
      setSearchedPlace(null)
    }
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <View style={styles.header}>
            <Text style={styles.heading}>Filters</Text>
            <Pressable onPress={onClose} hitSlop={8}>
              <Icon name="close" size={20} color={colors.slate500} />
            </Pressable>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            <View style={styles.labelRow}><Icon name="building" size={13} color={colors.slate500} /><Text style={styles.label}>City</Text></View>
            <Dropdown
              label="City"
              value={filters.city}
              options={CITY_DROPDOWN_OPTIONS}
              onChange={handleCityChange}
              placeholder="Any city"
            />

            <View style={styles.labelRow}><Icon name="bed" size={13} color={colors.slate500} /><Text style={styles.label}>Bedrooms</Text></View>
            <Dropdown
              label="Bedrooms"
              multiple
              values={filters.bhk}
              options={BHK_DROPDOWN_OPTIONS}
              onChange={(next) => setFilter('bhk', next)}
              placeholder="Any"
            />

            <View style={styles.labelRow}><Icon name="sofa" size={13} color={colors.slate500} /><Text style={styles.label}>Furnishing</Text></View>
            <Dropdown
              label="Furnishing"
              value={filters.furnished}
              options={FURNISHED_DROPDOWN_OPTIONS}
              onChange={(val) => setFilter('furnished', val)}
              placeholder="Any"
            />

            <Pressable style={styles.resetButton} onPress={resetFilters}>
              <Text style={styles.resetButtonText}>Clear all filters</Text>
            </Pressable>
          </ScrollView>

          <Pressable style={styles.applyButton} onPress={onClose}>
            <Text style={styles.applyButtonText}>Show results</Text>
          </Pressable>
          <SafeAreaView edges={['bottom']} />
        </Pressable>
      </Pressable>
    </Modal>
  )
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: colors.white, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: spacing.lg, maxHeight: '85%' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.md },
  heading: { fontFamily: fonts.displayBold, fontSize: fontSizes.xl, color: colors.slate800 },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: spacing.sm, marginTop: spacing.md },
  label: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.sm, color: colors.slate600 },
  resetButton: { marginTop: spacing.xl, marginBottom: spacing.md, alignItems: 'center' },
  resetButtonText: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.sm, color: colors.slate400 },
  applyButton: { marginTop: spacing.md, backgroundColor: colors.brand600, borderRadius: radius.md, paddingVertical: spacing.md, alignItems: 'center' },
  applyButtonText: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.base, color: colors.white },
})
