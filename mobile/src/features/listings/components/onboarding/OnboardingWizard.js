import { useEffect, useRef, useState } from 'react'
import { View, Text, Pressable, ScrollView, ActivityIndicator, KeyboardAvoidingView, BackHandler, Alert, AppState, StyleSheet } from 'react-native'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { propertyService } from '@services/property.service'
import { availabilityService } from '@services/availability.service'
import { authService } from '@services/auth.service'
import { useAuth } from '@features/auth/hooks/useAuth'
import Icon from '@components/common/Icon'
import { BusinessGate } from './HostGates'
import { writeSavedDraft } from './draftStore'
import { syncAndReadDraft, schedulePush, flushPush, discardDraftEverywhere } from './draftSync'
import { TypeScreen, BasicsScreen, LocationScreen, PhotosScreen, FeaturesScreen, PriceScreen, ReviewScreen } from './WizardScreens'
import {
  CATEGORIES, BUSINESS_GATED_TYPES, DESCRIBE,
  deriveType, missingRequirements, buildPayload, suggestTitle, defaultRules,
} from '../../config/onboarding.js'
import { WIZARD_STEPS as STEPS, savedStepIndex } from '../../config/wizardSteps.js'
import { colors } from '@theme/colors'
import { fonts, fontSizes } from '@theme/typography'
import { spacing, radius } from '@theme/spacing'

// Seven steps — web's six with its combined first step split in two
// (config/wizardSteps.js). The draft is persisted after every change (see
// draftStore.js) — a listing takes photos, a pin and a price, and a phone WILL
// be interrupted halfway through.
const EMPTY_DRAFT = {
  fields: {},
  amenityNames: [],
  rules: {},
  location: { address: '', city: '', state: '', pincode: '', landmark: '', lat: null, lng: null },
  images: [],
  title: '',
  titlePrefilled: false,
  description: '',
  // RENT unless the owner picks Lease on the price step (only offered for
  // LEASE_CATEGORIES). Lives beside `pricing` rather than inside it because
  // everything in `pricing` is a money string; this is a mode.
  pricingModel: 'RENT',
  pricing: {},
  terms: {},
  zeroBrokerage: true,
  brokerage: '',
  appointmentWindowStart: '',
  appointmentWindowEnd: '',
  instantBook: false,
  blockedDates: [],
}

function DoneScreen({ category, onListAnother, onDone }) {
  return (
    <View style={styles.doneContainer}>
      <View style={styles.doneIconOuter}>
        <View style={styles.doneIconInner}>
          <Icon name="check" size={22} color={colors.white} />
        </View>
      </View>
      <Text style={styles.doneTitle}>Your listing is submitted</Text>
      <Text style={styles.doneBody}>
        Your {category.label} is pending review — we&apos;ll put it on the map the
        moment it&apos;s approved. Want the Verified badge? Add ownership documents
        any time from My Listing.
      </Text>
      <View style={styles.doneStatusRow}>
        {['DRAFT', 'PENDING', 'ACTIVE'].map((s, i) => (
          <View key={s} style={[styles.doneStatusPill, i <= 1 && styles.doneStatusPillActive]}>
            <Text style={[styles.doneStatusText, i <= 1 && styles.doneStatusTextActive]}>{s}</Text>
          </View>
        ))}
      </View>
      <View style={styles.doneActions}>
        <Pressable style={styles.doneSecondaryButton} onPress={onListAnother} accessibilityRole="button">
          <Text style={styles.doneSecondaryText}>List another</Text>
        </Pressable>
        <Pressable style={styles.donePrimaryButton} onPress={onDone} accessibilityRole="button">
          <Text style={styles.donePrimaryText}>Go to my listings</Text>
        </Pressable>
      </View>
    </View>
  )
}

// One bar, not two rows: back, where you are, and the way out. The step names
// don't fit a phone's width, so the stepper is "Step N of 7 · Label" over a
// single continuous progress bar rather than seven labelled segments.
function WizardBar({ step, onBack, onExit }) {
  return (
    <View style={styles.bar}>
      <Pressable onPress={onBack} hitSlop={16} accessibilityRole="button" accessibilityLabel="Go back" style={styles.barBack}>
        <Icon name="chevronLeft" size={22} color={colors.slate800} />
      </Pressable>
      <View style={styles.barCenter}>
        <Text style={styles.barTitle} numberOfLines={1}>Step {step.n} of {STEPS.length} · {step.label}</Text>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${(step.n / STEPS.length) * 100}%` }]} />
        </View>
      </View>
      <Pressable onPress={onExit} hitSlop={16} accessibilityRole="button" accessibilityLabel="Save and exit" style={styles.barExit}>
        <Text style={styles.barExitText}>Save &amp; exit</Text>
      </Pressable>
    </View>
  )
}

// The line under the primary button. Per step, because what reassures someone
// differs by where they are: that nothing is lost, or that a human looks before
// this goes live.
const FOOTER_NOTE = {
  type: 'Changing this later clears your answers',
  basics: 'Saved automatically',
  location: 'The pin decides your area report',
  photos: 'Safe to close — we keep your draft',
  features: 'Title pre-filled from your answers',
  pricing: 'Compared with live listings nearby',
  review: 'Reviewed by us before it goes live',
}

export default function OnboardingWizard({ onDone }) {
  const { user } = useAuth()
  const qc = useQueryClient()
  const [stage, setStage] = useState('flow')
  const [categoryKey, setCategoryKey] = useState(null)
  const [stepIdx, setStepIdx] = useState(0)
  const [draft, setDraft] = useState(EMPTY_DRAFT)
  const [blockError, setBlockError] = useState('')
  const restored = useRef(false)
  const scrollRef = useRef(null)

  const { data: profile } = useQuery({
    queryKey: ['me'],
    queryFn: () => authService.getMe().then((r) => r.data),
    enabled: !!user,
  })

  const { data: amenities = [] } = useQuery({
    queryKey: ['amenities'],
    queryFn: () => propertyService.getAmenities().then((r) => r.data),
  })

  // Restore once, on mount, before a category is chosen — never clobber a
  // draft the owner is already typing into. Syncs first, so a listing started
  // on the owner's laptop opens here rather than an empty wizard.
  useEffect(() => {
    if (restored.current) return
    restored.current = true
    syncAndReadDraft().then((s) => {
      if (!s) return
      setCategoryKey(s.categoryKey)
      setDraft({ ...EMPTY_DRAFT, ...s.draft })
      // Not s.stepIdx directly — a draft saved before the type/basics split
      // indexes a six-step list, and one written on web indexes a different
      // six. savedStepIndex() reads the key instead.
      setStepIdx(savedStepIndex(s))
    })
  }, [])

  useEffect(() => {
    if (stage !== 'flow' || !categoryKey) return
    // Local first, always: the server copy is for the owner's other device, and
    // it must never be the thing standing between a keystroke and it being
    // safe. The pushed envelope is the one writeSavedDraft stamped, never a
    // re-stamp — see the note on writeSavedDraft for why that matters.
    writeSavedDraft({ categoryKey, stepIdx, stepKey: STEPS[stepIdx].k, draft })
      .then(schedulePush)
  }, [stage, categoryKey, stepIdx, draft])

  // Backgrounding is the moment someone puts the phone down and opens the
  // laptop, and Android may kill the process before the 2s push debounce fires.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s !== 'active') flushPush()
    })
    return () => { sub.remove(); flushPush() }
  }, [])

  const { mutate: publish, isPending } = useMutation({
    mutationFn: async () => {
      const type = deriveType(categoryKey, draft.fields[DESCRIBE[categoryKey].k])
      const amenityIds = amenities.filter((a) => draft.amenityNames.includes(a.name)).map((a) => a.id)
      const payload = buildPayload(categoryKey, type, draft, amenityIds)
      const property = await propertyService.create(payload).then((r) => r.data)

      if (categoryKey === 'stay' && draft.blockedDates.length > 0) {
        await availabilityService.set(property.id, draft.blockedDates.map((date) => ({ date: `${date}T00:00:00.000Z`, isBlocked: true }))).catch(() => {})
      }

      await propertyService.publish(property.id)
      return property
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['my-listings'] })
      qc.invalidateQueries({ queryKey: ['host-dashboard'] })
      // The draft has become a real listing, so it stops existing as a draft on
      // every device — otherwise the owner's laptop still offers to resume a
      // listing they already published.
      discardDraftEverywhere()
      setStage('done')
    },
    onError: (err) => setBlockError(err?.message ?? 'Please try again.'),
  })

  // Changing the category mid-step-1 resets the answers that only made sense
  // for the old one — a plot's approval status is not a flat's furnishing.
  function pickCategory(key) {
    setBlockError('')
    if (BUSINESS_GATED_TYPES.includes(key) && !profile?.isBusiness) {
      setCategoryKey(key)
      setStage('business-gate')
      return
    }
    setCategoryKey(key)
    setDraft((d) => ({ ...d, fields: {}, amenityNames: [], rules: defaultRules(key), terms: {}, pricing: {}, pricingModel: 'RENT' }))
  }

  function startNewListing() {
    setCategoryKey(null)
    setDraft(EMPTY_DRAFT)
    setStepIdx(0)
    setBlockError('')
    setStage('flow')
  }

  const step = STEPS[stepIdx]
  const isLast = stepIdx === STEPS.length - 1
  const missing = categoryKey ? missingRequirements(categoryKey, draft) : []
  const missingProfile = profile?.missingProfileFields ?? []

  function goTo(idx) {
    setBlockError('')
    // Offer a title the moment we have enough to write one, and only into an
    // empty field — never overwrite what the owner typed.
    if (STEPS[idx]?.k === 'features' && !draft.title.trim()) {
      const suggested = suggestTitle(categoryKey, draft)
      if (suggested) setDraft((d) => ({ ...d, title: suggested, titlePrefilled: true }))
    }
    setStepIdx(idx)
    scrollRef.current?.scrollTo({ y: 0, animated: false })
  }

  function next() {
    if (!categoryKey) { setBlockError('Pick what you’re listing to continue.'); return }
    // The one mid-flow gate: step branching and type derivation hang off it.
    if (step.k === 'basics' && draft.fields[DESCRIBE[categoryKey].k] === undefined) {
      setBlockError(`${DESCRIBE[categoryKey].q} Make a selection to continue.`)
      return
    }
    if (isLast) { publish(); return }
    goTo(stepIdx + 1)
  }

  function back() {
    setBlockError('')
    if (stepIdx > 0) { goTo(stepIdx - 1); return }
    onDone()
  }

  // Hardware back steps BACK through the flow; it may never silently discard
  // the listing (mobile/AGENTS.md §2). The draft is saved either way, so the
  // first-step confirm is about leaving, not losing.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (stage === 'done') return false
      if (stage === 'business-gate') { setCategoryKey(null); setStage('flow'); return true }
      if (stepIdx > 0) { goTo(stepIdx - 1); return true }
      if (!categoryKey) return false
      Alert.alert('Leave this listing?', 'It stays saved as a draft — you can pick it up where you left off.', [
        { text: 'Keep editing', style: 'cancel' },
        { text: 'Leave', onPress: onDone },
      ])
      return true
    })
    return () => sub.remove()
  })

  if (stage === 'business-gate') {
    return (
      <ScrollView contentContainerStyle={{ paddingBottom: spacing.xxl }}>
        <BusinessGate
          onUpgraded={() => { setStage('flow'); pickCategory(categoryKey) }}
          onChooseDifferent={() => { setCategoryKey(null); setStage('flow') }}
        />
      </ScrollView>
    )
  }

  if (stage === 'done') {
    return (
      <ScrollView contentContainerStyle={{ paddingBottom: spacing.xxl }}>
        <DoneScreen category={CATEGORIES[categoryKey]} onListAnother={startNewListing} onDone={onDone} />
      </ScrollView>
    )
  }

  const canPublish = isLast && missing.length === 0 && missingProfile.length === 0 && !isPending
  const stepProps = { categoryKey, draft, setDraft }

  return (
    <View style={{ flex: 1 }}>
      <WizardBar step={step} onBack={back} onExit={onDone} />

      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
        <ScrollView ref={scrollRef} style={{ flex: 1 }} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {step.k === 'type' && <TypeScreen categoryKey={categoryKey} onPickCategory={pickCategory} />}
          {categoryKey && step.k === 'basics' && <BasicsScreen {...stepProps} />}
          {categoryKey && step.k === 'location' && <LocationScreen {...stepProps} />}
          {categoryKey && step.k === 'photos' && <PhotosScreen {...stepProps} />}
          {categoryKey && step.k === 'features' && <FeaturesScreen {...stepProps} />}
          {categoryKey && step.k === 'pricing' && <PriceScreen {...stepProps} />}
          {categoryKey && step.k === 'review' && (
            <ReviewScreen {...stepProps} missing={missing} profile={profile} onJump={(k) => goTo(STEPS.findIndex((s) => s.k === k))} />
          )}
          {!!blockError && <Text style={styles.blockError}>{blockError}</Text>}
        </ScrollView>

        {/* Full-width primary action — back lives in the top bar and on the
            hardware button, so the footer is one thumb-reachable target. */}
        <View style={styles.footer}>
          <Pressable
            style={[styles.nextButton, isLast && styles.publishButton, (isPending || (isLast && !canPublish)) && styles.disabled]}
            onPress={next}
            disabled={isPending || (isLast && !canPublish)}
            accessibilityRole="button"
            accessibilityState={{ disabled: isPending || (isLast && !canPublish) }}
          >
            {isPending ? (
              <ActivityIndicator color={colors.white} size="small" />
            ) : (
              <Text style={styles.nextButtonText}>{isLast ? 'Publish listing' : `Next — ${step.next}`}</Text>
            )}
          </Pressable>
          <Text style={styles.footerNote}>{FOOTER_NOTE[step.k]}</Text>
        </View>
      </KeyboardAvoidingView>
    </View>
  )
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    borderBottomWidth: 1, borderBottomColor: colors.slate100,
  },
  barBack: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  barCenter: { flex: 1, gap: 6 },
  barTitle: { fontFamily: fonts.bodyMedium, fontSize: fontSizes.sm, color: colors.slate800 },
  progressTrack: { height: 4, borderRadius: 2, backgroundColor: colors.slate200, overflow: 'hidden' },
  progressFill: { height: 4, borderRadius: 2, backgroundColor: colors.brand600 },
  barExit: { minHeight: 44, justifyContent: 'center' },
  barExitText: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.sm, color: colors.brand700 },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl },
  blockError: { fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.danger, marginTop: spacing.md },
  footer: {
    gap: spacing.sm, paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.sm,
    borderTopWidth: 1, borderTopColor: colors.slate100, backgroundColor: colors.white,
  },
  footerNote: { fontFamily: fonts.body, fontSize: fontSizes.xs, color: colors.slate500, textAlign: 'center' },
  nextButton: { minHeight: 52, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.brand600, borderRadius: radius.md },
  publishButton: { backgroundColor: colors.slate900 },
  disabled: { opacity: 0.6 },
  nextButtonText: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.sm, color: colors.white },
  doneContainer: { alignItems: 'center', padding: spacing.xl },
  doneIconOuter: { width: 64, height: 64, borderRadius: radius.full, backgroundColor: colors.brand50, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.lg },
  doneIconInner: { width: 44, height: 44, borderRadius: radius.full, backgroundColor: colors.brand600, alignItems: 'center', justifyContent: 'center' },
  doneTitle: { fontFamily: fonts.displayBold, fontSize: fontSizes.xl, color: colors.slate800, textAlign: 'center' },
  doneBody: { fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.slate600, textAlign: 'center', lineHeight: 20, marginTop: spacing.sm, marginBottom: spacing.lg },
  doneStatusRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.xl },
  doneStatusPill: { paddingHorizontal: spacing.md, paddingVertical: 6, borderRadius: radius.full, backgroundColor: colors.slate100 },
  doneStatusPillActive: { backgroundColor: colors.brand50 },
  doneStatusText: { fontFamily: fonts.bodySemiBold, fontSize: 11, color: colors.slate500 },
  doneStatusTextActive: { color: colors.brand700 },
  doneActions: { flexDirection: 'row', gap: spacing.sm, width: '100%' },
  doneSecondaryButton: { flex: 1, minHeight: 48, justifyContent: 'center', borderWidth: 1, borderColor: colors.slate200, borderRadius: radius.md, alignItems: 'center' },
  doneSecondaryText: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.sm, color: colors.slate700 },
  donePrimaryButton: { flex: 1, minHeight: 48, justifyContent: 'center', backgroundColor: colors.slate800, borderRadius: radius.md, alignItems: 'center' },
  donePrimaryText: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.sm, color: colors.white },
})
