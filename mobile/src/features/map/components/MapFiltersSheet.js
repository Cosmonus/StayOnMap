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
import {
  DEFAULT_FILTERS, SEARCH_KEYS, TYPE_CATEGORIES, LEASE_CATEGORY_IDS, SALE_CATEGORY_IDS,
  countActiveFilters, staleFilterPatch, modeChangePatch,
} from '@config/filters'
import Icon from '@components/common/Icon'
import PropertyTypeSwitcher from '@features/filters/components/PropertyTypeSwitcher'
import DynamicFilterRenderer from '@features/filters/components/DynamicFilterRenderer'
import { useFilterCount } from '@features/filters/hooks/useFilterCount'
import { colors } from '@theme/colors'
import { shadows } from '@theme/shadows'
import { fonts, fontSizes } from '@theme/typography'
import { spacing, radius } from '@theme/spacing'

// Rent, Lease and Buy: three different deals, not three price ranges. Rent is
// monthly; lease is the Kerala/Karnataka lump sum the owner returns when you
// leave; buy is an outright purchase. One mode at a time — see PricingModel in
// schema.prisma.
//
// Buy is what makes sale listings reachable at all: the map defaults to
// pricingModel=RENT, so without this control a for-sale listing could be
// created, moderated and published and still never appear to anyone. Mobile
// could already CREATE one — the wizard has had SALE since 2026-07-26 — so
// until this landed on 2026-07-27, a plot listed from the app was invisible in
// the app.
const MODES = [
  { value: 'RENT', label: 'Rent', hint: 'Pay monthly' },
  { value: 'LEASE', label: 'Lease', hint: 'Lump sum, refunded on exit' },
  { value: 'SALE', label: 'Buy', hint: 'Outright purchase' },
]

const LEASE_CATEGORIES = TYPE_CATEGORIES.filter((c) => LEASE_CATEGORY_IDS.includes(c.id))
const SALE_CATEGORIES = TYPE_CATEGORIES.filter((c) => SALE_CATEGORY_IDS.includes(c.id))

// Which property types a mode can even offer. Buy adds land and drops PG and
// short-stay; lease drops land too.
function categoriesForMode(mode) {
  if (mode === 'LEASE') return LEASE_CATEGORIES
  if (mode === 'SALE') return SALE_CATEGORIES
  return TYPE_CATEGORIES
}

export default function MapFiltersSheet({ visible, onClose }) {
  const setFilters = useFilterStore((s) => s.setFilters)
  const [draft, setDraft] = useState(DEFAULT_FILTERS)

  // Re-seed the draft from the store each time the sheet opens
  useResetOnOpen(visible, () => setDraft(useFilterStore.getState().filters))

  const { count, isFetching } = useFilterCount(draft, visible)
  const activeCount = countActiveFilters(draft)

  const patch = (p) => setDraft((d) => ({ ...d, ...p }))

  const mode = draft.pricingModel || 'RENT'
  const categories = categoriesForMode(mode)

  // Switching modes resets the mode-gated rows (the two budget rows share
  // rentMin/rentMax on different scales) and drops any now-ineligible type
  // selection — picking PG then switching to Lease would otherwise filter to
  // "leased PGs", which can't exist.
  function handleModeChange(next) {
    const allowed = categoriesForMode(next)
    const types = (draft.types ?? []).filter((t) => allowed.some((c) => c.types.includes(t)))
    patch({
      pricingModel: next,
      types,
      ...modeChangePatch(),
      ...staleFilterPatch(types, next),
    })
  }

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
              <Text style={styles.groupLabel}>Looking to</Text>
              <View style={styles.modeRow}>
                {MODES.map((m) => {
                  const active = mode === m.value
                  return (
                    <Pressable
                      key={m.value}
                      style={[styles.modeCard, active && styles.modeCardActive]}
                      onPress={() => handleModeChange(m.value)}
                      accessibilityRole="button"
                      accessibilityLabel={`${m.label} — ${m.hint}`}
                      accessibilityState={{ selected: active }}
                    >
                      <Text style={[styles.modeLabel, active && styles.modeLabelActive]}>{m.label}</Text>
                      <Text style={styles.modeHint}>{m.hint}</Text>
                    </Pressable>
                  )
                })}
              </View>
              <Text style={styles.groupLabel}>Property type</Text>
              <View style={styles.typeSwitcher}>
                <PropertyTypeSwitcher
                  selectedTypes={draft.types ?? []}
                  categories={categories}
                  onChange={(types) => patch({ types, ...staleFilterPatch(types, mode) })}
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
  modeRow: { flexDirection: 'row', gap: spacing.sm, paddingBottom: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.slate100, marginBottom: spacing.md },
  modeCard: {
    flex: 1, minHeight: 44, justifyContent: 'center',
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm + 4,
    borderRadius: radius.lg, borderWidth: 1, borderColor: colors.slate200, backgroundColor: colors.white,
  },
  modeCardActive: { borderColor: colors.slate800, backgroundColor: colors.slate50 },
  modeLabel: { fontFamily: fonts.bodyMedium, fontSize: fontSizes.sm, color: colors.slate500 },
  modeLabelActive: { fontFamily: fonts.bodySemiBold, color: colors.slate800 },
  modeHint: { fontFamily: fonts.body, fontSize: 11, color: colors.slate500, marginTop: 2 },
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
