// The map's filter bottom sheet — mirrors web's FilterModal. Edits a local
// DRAFT (with a live viewport result count); nothing hits the store — or the
// map — until Apply. Sections and controls are generated from
// config/filters.js; location search lives in MapSearchBar, not here.
import { useState } from 'react'
import { View, Text, Modal, Pressable, ScrollView, StyleSheet } from 'react-native'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useResetOnOpen } from '@/hooks/useResetOnOpen'
import { useFilterStore } from '@store/filterStore'
import { DEFAULT_FILTERS, SEARCH_KEYS, countActiveFilters, staleFilterPatch } from '@config/filters'
import Icon from '@components/common/Icon'
import PropertyTypeSwitcher from '@features/filters/components/PropertyTypeSwitcher'
import DynamicFilterRenderer from '@features/filters/components/DynamicFilterRenderer'
import { useFilterCount } from '@features/filters/hooks/useFilterCount'
import { colors } from '@theme/colors'
import { shadows } from '@theme/shadows'
import { fonts, fontSizes } from '@theme/typography'
import { spacing, radius } from '@theme/spacing'

export default function MapFiltersSheet({ visible, onClose }) {
  const setFilters = useFilterStore((s) => s.setFilters)
  const [draft, setDraft] = useState(DEFAULT_FILTERS)

  // Re-seed the draft from the store each time the sheet opens
  useResetOnOpen(visible, () => setDraft(useFilterStore.getState().filters))

  const { count, isFetching } = useFilterCount(draft, visible)
  const activeCount = countActiveFilters(draft)

  const patch = (p) => setDraft((d) => ({ ...d, ...p }))

  function handleReset() {
    setDraft((d) => ({
      ...DEFAULT_FILTERS,
      ...Object.fromEntries(SEARCH_KEYS.map((k) => [k, d[k]])),
    }))
  }

  function handleApply() {
    setFilters(draft)
    onClose()
  }

  const applyLabel = count === null
    ? 'Show results'
    : `Show ${count} ${count === 1 ? 'place' : 'places'}`

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      {/* RN <Modal> hosts a separate native root — RangeSlider's Pan gestures
          need their own GestureHandlerRootView inside it (App.js's root
          doesn't reach across the modal boundary on Android). */}
      <GestureHandlerRootView style={styles.gestureRoot}>
        <Pressable style={styles.backdrop} onPress={onClose}>
          <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
            <View style={styles.handle} />
            <View style={styles.header}>
              <Text style={styles.heading}>Filters</Text>
              <Pressable onPress={onClose} hitSlop={14} accessibilityRole="button" accessibilityLabel="Close filters">
                <Icon name="close" size={20} color={colors.slate500} />
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <Text style={styles.groupLabel}>Property type</Text>
              <View style={styles.typeSwitcher}>
                <PropertyTypeSwitcher
                  selectedTypes={draft.types ?? []}
                  onChange={(types) => patch({ types, ...staleFilterPatch(types) })}
                />
              </View>
              <DynamicFilterRenderer draft={draft} patch={patch} />
            </ScrollView>

            <View style={styles.footer}>
              <Pressable
                onPress={handleReset}
                disabled={activeCount === 0}
                hitSlop={12}
                accessibilityRole="button"
                accessibilityLabel="Clear all filters"
                accessibilityState={{ disabled: activeCount === 0 }}
              >
                <Text style={[styles.resetText, activeCount === 0 && styles.resetDisabled]}>Clear all</Text>
              </Pressable>
              <Pressable style={[styles.applyButton, isFetching && styles.applyFetching]} onPress={handleApply} accessibilityRole="button">
                <Text style={styles.applyButtonText}>{applyLabel}</Text>
              </Pressable>
            </View>
            <SafeAreaView edges={['bottom']} />
          </Pressable>
        </Pressable>
      </GestureHandlerRootView>
    </Modal>
  )
}

const styles = StyleSheet.create({
  gestureRoot: { flex: 1 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.white, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl,
    paddingHorizontal: spacing.lg, maxHeight: '90%',
    ...shadows.sheet,
  },
  handle: { alignSelf: 'center', width: 40, height: 5, borderRadius: 3, backgroundColor: colors.slate200, marginTop: spacing.sm + 2 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: spacing.md - 2 },
  heading: { fontFamily: fonts.displayBold, fontSize: fontSizes.xl, color: colors.slate800 },
  groupLabel: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.sm + 1, color: colors.slate800, marginBottom: spacing.sm + 4 },
  typeSwitcher: { paddingBottom: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.slate100 },
  footer: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: spacing.md - 4, borderTopWidth: 1, borderTopColor: colors.slate100,
  },
  resetText: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.sm, color: colors.slate600, textDecorationLine: 'underline' },
  resetDisabled: { color: colors.slate200, textDecorationLine: 'none' },
  applyButton: { minHeight: 44, justifyContent: 'center', backgroundColor: colors.slate800, borderRadius: radius.md, paddingVertical: spacing.md - 4, paddingHorizontal: spacing.lg, alignItems: 'center' },
  applyFetching: { opacity: 0.8 },
  applyButtonText: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.sm, color: colors.white },
})
