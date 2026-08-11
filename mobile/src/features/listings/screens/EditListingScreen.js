import { useEffect, useMemo, useRef, useState } from 'react'
import {
  View,
  Text,
  Pressable,
  ScrollView,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  StyleSheet,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { propertyService } from '@services/property.service'
import ScreenHeader from '@components/common/ScreenHeader'
import { BasicsScreen, LocationScreen, PhotosScreen, FeaturesScreen, PriceScreen } from '../components/onboarding/WizardScreens'
import {
  STEPS, DESCRIBE, deriveType, categoryFromType, draftFromProperty,
  missingRequirements, buildUpdatePayload,
} from '../config/onboarding.js'
import { colors } from '@theme/colors'
import { useLayout, centered } from '@theme/breakpoints'
import { fonts, fontSizes } from '@theme/typography'
import { spacing, radius } from '@theme/spacing'

// Wizard-grade editing — the same five type-aware panels the add flow uses,
// mirroring web's EditListingPanel. This replaced a scalar-fields-only form
// (title, description, pricing) that quietly offered a smaller product than
// adding: a plot's survey number, a PG's beds, the photos, the amenities and
// the map pin were all uneditable on mobile.
//
// Same two differences from the add flow as web:
//   - no Review tab (nothing to review — it is already live), Save instead
//   - the category is fixed: a listing becoming a different KIND of property
//     is a relist, not an edit (hence `typeLocked` on the basics panel — the
//     add wizard reaches its type picker on its own first step, config/
//     wizardSteps.js, and there is no equivalent tab here)
//
// These are the SHARED six steps minus review, which is exactly the editable
// set — the wizard's mobile-only type step is not one of them.

const TABS = STEPS.filter((s) => s.k !== 'review')

// Tab labels are shorter than the wizard's step labels — a tab bar is read at
// a glance, a step header is read as a sentence. Same set as web's TAB_LABEL.
const TAB_LABEL = {
  basics: 'Basic info',
  location: 'Location',
  photos: 'Photos',
  features: 'Features',
  pricing: 'Price',
}

const PANEL = {
  basics: BasicsScreen,
  location: LocationScreen,
  photos: PhotosScreen,
  features: FeaturesScreen,
  pricing: PriceScreen,
}

function EditForm({ property, navigation }) {
  const { contentMaxWidth } = useLayout()
  const qc = useQueryClient()
  const categoryKey = categoryFromType(property.type)
  const [activeTab, setActiveTab] = useState('basics')
  const scrollRef = useRef(null)

  // Seeded once from the saved listing, then owned by the form. Deriving it on
  // every render would throw away each keystroke.
  const seeded = useMemo(() => draftFromProperty(property, categoryKey), [property, categoryKey])
  const [draft, setDraft] = useState(null)
  const current = draft ?? seeded
  const updateDraft = (updater) => setDraft((d) => (typeof updater === 'function' ? updater(d ?? seeded) : updater))

  const { data: amenities = [] } = useQuery({
    queryKey: ['amenities'],
    queryFn: () => propertyService.getAmenities().then((r) => r.data),
  })

  // Hardware/gesture back must never silently discard edits (AGENTS.md §2).
  // dirtyRef is read inside the listener; savedRef lets the post-save goBack
  // leave without re-prompting.
  const dirtyRef = useRef(false)
  const savedRef = useRef(false)
  // Recomputed every render so the `beforeRemove` listener below (subscribed
  // once, not re-subscribed per keystroke) always reads the latest dirty
  // state instead of a stale closure — deliberate, not an oversight.
  // eslint-disable-next-line react-hooks/refs
  dirtyRef.current = draft !== null && JSON.stringify(current) !== JSON.stringify(seeded)

  useEffect(() => {
    return navigation.addListener('beforeRemove', (e) => {
      if (savedRef.current || !dirtyRef.current) return
      e.preventDefault()
      Alert.alert('Discard changes?', 'Your edits haven’t been saved.', [
        { text: 'Keep editing', style: 'cancel' },
        { text: 'Discard', style: 'destructive', onPress: () => navigation.dispatch(e.data.action) },
      ])
    })
  }, [navigation])

  // The same checks the add flow runs, so an edit can't quietly strip a
  // listing of something it needed to be published in the first place.
  const missing = missingRequirements(categoryKey, current)
  const incomplete = new Set(missing.map((m) => m.stepK))

  const { mutate: save, isPending } = useMutation({
    mutationFn: () => {
      const type = deriveType(categoryKey, current.fields[DESCRIBE[categoryKey].k])
      const amenityIds = amenities.filter((a) => current.amenityNames.includes(a.name)).map((a) => a.id)
      return propertyService.update(property.id, buildUpdatePayload(categoryKey, type, current, amenityIds))
    },
    onSuccess: () => {
      savedRef.current = true
      qc.invalidateQueries({ queryKey: ['my-listings'] })
      qc.invalidateQueries({ queryKey: ['manage-listing', property.id] })
      qc.invalidateQueries({ queryKey: ['property', property.id] })
      Alert.alert('Saved', 'Your listing is updated')
      navigation.goBack()
    },
    onError: (e) => Alert.alert('Couldn’t save', e?.message ?? 'Please try again'),
  })

  function switchTab(k) {
    setActiveTab(k)
    scrollRef.current?.scrollTo({ y: 0, animated: false })
  }

  const Panel = PANEL[activeTab] ?? BasicsScreen

  return (
    <KeyboardAvoidingView style={styles.flex} behavior="padding">
      <View style={styles.tabBar}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabRow}>
          {TABS.map((t) => {
            const active = t.k === activeTab
            return (
              <Pressable
                key={t.k}
                onPress={() => switchTab(t.k)}
                style={[styles.tab, active && styles.tabActive]}
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
                accessibilityLabel={TAB_LABEL[t.k]}
              >
                <Text style={[styles.tabText, active && styles.tabTextActive]}>{TAB_LABEL[t.k]}</Text>
                {/* A dot, not a count — same as web: a badge per tab turns the
                    bar into a scoreboard. */}
                {incomplete.has(t.k) && <View style={styles.tabDot} accessibilityLabel="incomplete" />}
              </Pressable>
            )
          })}
        </ScrollView>
      </View>

      <ScrollView ref={scrollRef} style={styles.flex} contentContainerStyle={[styles.content, centered(contentMaxWidth)]} keyboardShouldPersistTaps="handled">
        {/* typeLocked is read by BasicsScreen only; the other four ignore it. */}
        <Panel categoryKey={categoryKey} draft={current} setDraft={updateDraft} typeLocked />
      </ScrollView>

      <View style={styles.footer}>
        {missing.length > 0 && (
          <Text style={styles.footerWarn}>
            {missing.length} {missing.length === 1 ? 'thing needs' : 'things need'} fixing before you can save
          </Text>
        )}
        <Pressable
          style={[styles.saveButton, (isPending || missing.length > 0) && styles.disabled]}
          onPress={() => save()}
          disabled={isPending || missing.length > 0}
          accessibilityRole="button"
          accessibilityLabel="Save changes"
          accessibilityState={{ disabled: isPending || missing.length > 0 }}
        >
          {isPending ? (
            <ActivityIndicator color={colors.white} size="small" />
          ) : (
            <Text style={styles.saveButtonText}>Save changes</Text>
          )}
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  )
}

export default function EditListingScreen({ navigation, route }) {
  const { propertyId } = route.params

  const { data: property, isLoading, isError, refetch } = useQuery({
    queryKey: ['manage-listing', propertyId],
    queryFn: () => propertyService.getById(propertyId).then((r) => r.data),
  })

  return (
    <SafeAreaView style={styles.container} edges={[]}>
      <ScreenHeader
        title="Edit listing"
        subtitle={property?.title}
        onBack={() => navigation.goBack()}
      />

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.brand600} size="large" />
        </View>
      ) : isError || !property ? (
        <View style={styles.center}>
          <Text style={styles.errorTitle}>Couldn&apos;t load this listing</Text>
          <Pressable style={styles.retryButton} onPress={() => refetch()} accessibilityRole="button" accessibilityLabel="Retry loading listing">
            <Text style={styles.retryText}>Retry</Text>
          </Pressable>
        </View>
      ) : (
        <EditForm property={property} navigation={navigation} />
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.slate50 },
  flex: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md, padding: spacing.xl },
  tabBar: { backgroundColor: colors.white, borderBottomWidth: 1, borderBottomColor: colors.slate200 },
  tabRow: { paddingHorizontal: spacing.md, gap: spacing.xs },
  tab: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    minHeight: 48, paddingHorizontal: spacing.md,
    borderBottomWidth: 2, borderBottomColor: 'transparent',
  },
  tabActive: { borderBottomColor: colors.brand600 },
  tabText: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.sm, color: colors.slate500 },
  tabTextActive: { color: colors.brand700 },
  tabDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#F59E0B' },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl },
  footer: {
    gap: spacing.sm, paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.sm,
    borderTopWidth: 1, borderTopColor: colors.slate100, backgroundColor: colors.white,
  },
  footerWarn: { fontFamily: fonts.body, fontSize: fontSizes.xs, color: '#B45309', textAlign: 'center' },
  saveButton: { minHeight: 52, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.brand600, borderRadius: radius.md },
  saveButtonText: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.sm, color: colors.white },
  errorTitle: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.sm, color: colors.slate600 },
  retryButton: { backgroundColor: colors.brand600, borderRadius: radius.md, paddingHorizontal: spacing.xl, paddingVertical: spacing.sm, minHeight: 40, justifyContent: 'center' },
  retryText: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.sm, color: colors.white },
  disabled: { opacity: 0.6 },
})
