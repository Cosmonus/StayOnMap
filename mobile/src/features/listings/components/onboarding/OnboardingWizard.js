import { useState } from 'react'
import { View, Text, Pressable, ScrollView, ActivityIndicator, StyleSheet } from 'react-native'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { propertyService } from '@services/property.service'
import { verificationService } from '@services/verification.service'
import { availabilityService } from '@services/availability.service'
import { authService } from '@services/auth.service'
import { useAuth } from '@features/auth/hooks/useAuth'
import Icon from '@components/common/Icon'
import TypePicker, { BusinessGate } from './TypePicker'
import PhaseInterstitial from './PhaseInterstitial'
import {
  DescribeScreen, FieldsScreen, LocationScreen, FeaturesScreen, PhotosScreen,
  TitleScreen, DescriptionScreen, PricingScreen, ContactScreen, VerifyScreen, ReviewScreen,
} from './WizardScreens'
import { CATEGORIES, BUSINESS_GATED_TYPES, PRICING, DESCRIBE, getScreens, phaseOf, deriveType } from '../../config/onboarding.js'
import { colors } from '@theme/colors'
import { fonts, fontSizes } from '@theme/typography'
import { spacing, radius } from '@theme/spacing'

const EMPTY_DRAFT = {
  fields: {},
  amenityNames: [],
  location: { address: '', city: '', state: '', pincode: '', landmark: '', lat: null, lng: null },
  images: [],
  title: '',
  description: '',
  pricing: {},
  appointmentWindowStart: '',
  appointmentWindowEnd: '',
  instantBook: false,
  docs: [],
  blockedDates: [],
}

const NUMERIC_FIELD_KEYS = new Set([
  'bhk', 'sharing', 'bathrooms', 'floor', 'totalFloors', 'area', 'extent', 'roadWidth',
  'carpetArea', 'frontage', 'totalBeds', 'availableBeds', 'noticePeriodDays', 'maxGuests', 'beds',
])

function buildPayload(categoryKey, type, draft, amenityIds) {
  const { fields, location, pricing } = draft
  const typedFields = {}
  for (const [key, value] of Object.entries(fields)) {
    if (key === 'genderPreference' || value === undefined || value === '') continue
    typedFields[key] = NUMERIC_FIELD_KEYS.has(key) ? Number(value) : value
  }

  const isStay = categoryKey === 'stay'
  const primaryRent = isStay ? Number(pricing.nightlyRate || 0) : Number(pricing.rent || 0)

  const payload = {
    title: draft.title.trim(),
    description: draft.description.trim(),
    type,
    address: location.address.trim(),
    city: location.city,
    state: location.state,
    pincode: location.pincode,
    landmark: location.landmark?.trim() || undefined,
    lat: location.lat,
    lng: location.lng,
    images: draft.images,
    amenityIds,
    ...typedFields,
    rent: primaryRent,
    deposit: Number(pricing.deposit ?? 0),
    ...(pricing.maintenance !== undefined && pricing.maintenance !== '' && { maintenance: Number(pricing.maintenance) }),
    ...(isStay && {
      nightlyRate: primaryRent,
      cleaningFee: Number(pricing.cleaningFee || 0),
      ...(pricing.weekendRate && { weekendRate: Number(pricing.weekendRate) }),
      minNights: 1,
      maxNights: 28,
      instantBook: draft.instantBook,
    }),
    ...(draft.appointmentWindowStart && { appointmentWindowStart: draft.appointmentWindowStart }),
    ...(draft.appointmentWindowEnd && { appointmentWindowEnd: draft.appointmentWindowEnd }),
  }

  if (fields.genderPreference) payload.rules = { genderPreference: fields.genderPreference }

  return payload
}

function getBlockingError(screen, categoryKey, draft) {
  if (screen.k === 'describe' && draft.fields[DESCRIBE[categoryKey].k] === undefined) return 'Make a selection to continue.'
  if (screen.k === 'location') {
    const l = draft.location
    if (l.address.trim().length < 5) return 'Enter a full address.'
    if (!l.city) return 'Select a city.'
    if (!/^\d{6}$/.test(l.pincode)) return 'Enter a valid 6-digit pincode.'
    if (l.lat == null) return 'Drop a pin on the map.'
  }
  if (screen.k === 'photos' && draft.images.length < 1) return 'Add at least one photo.'
  if (screen.k === 'title' && draft.title.trim().length < 5) return 'Title needs at least 5 characters.'
  if (screen.k === 'description' && draft.description.trim().length < 10) return 'Description needs at least 10 characters.'
  if (screen.k === 'pricing') {
    for (const [key] of PRICING[categoryKey]) {
      if (['deposit', 'maintenance', 'cleaningFee', 'weekendRate'].includes(key)) continue
      if (!draft.pricing[key]) return 'Fill in the required price fields.'
    }
  }
  return null
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
        Your {category.label} is a draft in PENDING status. We&apos;ll verify your documents and
        put it on the map the moment it&apos;s approved.
      </Text>
      <View style={styles.doneStatusRow}>
        {['DRAFT', 'PENDING', 'ACTIVE'].map((s, i) => (
          <View key={s} style={[styles.doneStatusPill, i <= 1 && styles.doneStatusPillActive]}>
            <Text style={[styles.doneStatusText, i <= 1 && styles.doneStatusTextActive]}>{s}</Text>
          </View>
        ))}
      </View>
      <View style={styles.doneActions}>
        <Pressable style={styles.doneSecondaryButton} onPress={onListAnother}>
          <Text style={styles.doneSecondaryText}>List another type</Text>
        </Pressable>
        <Pressable style={styles.donePrimaryButton} onPress={onDone}>
          <Text style={styles.donePrimaryText}>Go to my listings</Text>
        </Pressable>
      </View>
    </View>
  )
}

function TopBar({ title, onClose }) {
  return (
    <View style={styles.topBar}>
      <Text style={styles.topBarTitle}>{title}</Text>
      <Pressable onPress={onClose} hitSlop={8}>
        <Text style={styles.topBarClose}>Close</Text>
      </Pressable>
    </View>
  )
}

export default function OnboardingWizard({ onDone }) {
  const { user } = useAuth()
  const qc = useQueryClient()
  const [stage, setStage] = useState('picker')
  const [categoryKey, setCategoryKey] = useState(null)
  const [screenIdx, setScreenIdx] = useState(0)
  const [draft, setDraft] = useState(EMPTY_DRAFT)
  const [blockError, setBlockError] = useState('')

  const { data: profile } = useQuery({
    queryKey: ['me'],
    queryFn: () => authService.getMe().then((r) => r.data),
    enabled: !!user,
  })

  const { data: amenities = [] } = useQuery({
    queryKey: ['amenities'],
    queryFn: () => propertyService.getAmenities().then((r) => r.data),
  })

  const { mutate: publish, isPending } = useMutation({
    mutationFn: async () => {
      const type = deriveType(categoryKey, draft.fields[DESCRIBE[categoryKey].k])
      const amenityIds = amenities.filter((a) => draft.amenityNames.includes(a.name)).map((a) => a.id)
      const payload = buildPayload(categoryKey, type, draft, amenityIds)
      const property = await propertyService.create(payload).then((r) => r.data)

      if (draft.docs.length > 0) {
        await verificationService.submit(property.id).catch(() => {})
        await Promise.all(draft.docs.map((doc) => verificationService.addDocument(property.id, doc).catch(() => {})))
      }
      if (categoryKey === 'stay' && draft.blockedDates.length > 0) {
        await availabilityService.set(property.id, draft.blockedDates.map((date) => ({ date: `${date}T00:00:00.000Z`, isBlocked: true }))).catch(() => {})
      }

      await propertyService.publish(property.id)
      return property
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['my-listings'] })
      setStage('done')
    },
    onError: (err) => setBlockError(err?.message ?? 'Please try again.'),
  })

  function pickCategory(key) {
    if (BUSINESS_GATED_TYPES.includes(key) && !profile?.isBusiness) {
      setCategoryKey(key)
      setStage('business-gate')
      return
    }
    setCategoryKey(key)
    setDraft(EMPTY_DRAFT)
    setScreenIdx(0)
    setBlockError('')
    setStage('flow')
  }

  if (stage === 'picker') {
    return (
      <View style={{ flex: 1 }}>
        <TopBar title="List your property" onClose={onDone} />
        <ScrollView contentContainerStyle={{ paddingBottom: spacing.xxl }}>
          <TypePicker onPick={pickCategory} />
        </ScrollView>
      </View>
    )
  }

  if (stage === 'business-gate') {
    return (
      <View style={{ flex: 1 }}>
        <TopBar title="List your property" onClose={onDone} />
        <ScrollView contentContainerStyle={{ paddingBottom: spacing.xxl }}>
          <BusinessGate
            onUpgraded={() => pickCategory(categoryKey)}
            onChooseDifferent={() => { setCategoryKey(null); setStage('picker') }}
          />
        </ScrollView>
      </View>
    )
  }

  if (stage === 'done') {
    return (
      <View style={{ flex: 1 }}>
        <TopBar title="List your property" onClose={onDone} />
        <ScrollView contentContainerStyle={{ paddingBottom: spacing.xxl }}>
          <DoneScreen
            category={CATEGORIES[categoryKey]}
            onListAnother={() => { setCategoryKey(null); setStage('picker') }}
            onDone={onDone}
          />
        </ScrollView>
      </View>
    )
  }

  // stage === 'flow'
  const screens = getScreens()
  const screen = screens[screenIdx]
  const isPhase = screen.k === 'phase'
  const phase = phaseOf(screenIdx)
  const totalScreens = screens.filter((s) => s.k !== 'phase').length
  const doneCount = screens.slice(0, screenIdx).filter((s) => s.k !== 'phase').length
  const pct = Math.round((doneCount / totalScreens) * 100)
  const isLast = screenIdx === screens.length - 1

  function next() {
    if (!isPhase) {
      const err = getBlockingError(screen, categoryKey, draft)
      if (err) { setBlockError(err); return }
    }
    setBlockError('')
    if (isLast) { publish(); return }
    setScreenIdx((i) => i + 1)
  }

  function back() {
    setBlockError('')
    if (screenIdx > 0) { setScreenIdx((i) => i - 1); return }
    setCategoryKey(null)
    setStage('picker')
  }

  return (
    <View style={{ flex: 1 }}>
      <View style={styles.flowHeader}>
        <Text style={styles.flowHeaderTitle}>{CATEGORIES[categoryKey].label}</Text>
        <Pressable style={styles.saveExitButton} onPress={onDone}>
          <Text style={styles.saveExitText}>Save &amp; exit</Text>
        </Pressable>
      </View>

      <View style={styles.phaseBar}>
        {[1, 2, 3].map((n) => (
          <View key={n} style={{ flex: 1 }}>
            <View style={[styles.phaseSegment, n <= phase && styles.phaseSegmentActive]} />
            <Text style={[styles.phaseLabel, n === phase && styles.phaseLabelActive]} numberOfLines={1}>
              {['Tell us about your place', 'Make it stand out', 'Finish & publish'][n - 1]}
            </Text>
          </View>
        ))}
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.flowContent}>
        {isPhase && <PhaseInterstitial n={screen.n} title={screen.title} blurb={screen.blurb} />}
        {screen.k === 'describe' && <DescribeScreen categoryKey={categoryKey} draft={draft} setDraft={setDraft} />}
        {screen.k === 'fields' && <FieldsScreen categoryKey={categoryKey} draft={draft} setDraft={setDraft} />}
        {screen.k === 'location' && <LocationScreen draft={draft} setDraft={setDraft} />}
        {screen.k === 'features' && <FeaturesScreen categoryKey={categoryKey} draft={draft} setDraft={setDraft} />}
        {screen.k === 'photos' && <PhotosScreen draft={draft} setDraft={setDraft} />}
        {screen.k === 'title' && <TitleScreen draft={draft} setDraft={setDraft} />}
        {screen.k === 'description' && <DescriptionScreen draft={draft} setDraft={setDraft} />}
        {screen.k === 'pricing' && <PricingScreen categoryKey={categoryKey} draft={draft} setDraft={setDraft} />}
        {screen.k === 'contact' && <ContactScreen categoryKey={categoryKey} draft={draft} setDraft={setDraft} />}
        {screen.k === 'verify' && <VerifyScreen categoryKey={categoryKey} draft={draft} setDraft={setDraft} />}
        {screen.k === 'review' && <ReviewScreen categoryKey={categoryKey} draft={draft} />}

        {!!blockError && <Text style={styles.blockError}>{blockError}</Text>}
      </ScrollView>

      <View style={styles.flowFooter}>
        <Pressable onPress={back}>
          <Text style={styles.backLink}>Back</Text>
        </Pressable>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
          {!isPhase && <Text style={styles.pctText}>{pct}%</Text>}
          <Pressable style={[styles.nextButton, isPending && styles.disabled]} onPress={next} disabled={isPending}>
            {isPending ? (
              <ActivityIndicator color={colors.white} size="small" />
            ) : (
              <Text style={styles.nextButtonText}>
                {isPhase ? 'Get started' : isLast ? 'Publish listing' : 'Next'}
              </Text>
            )}
          </Pressable>
        </View>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  topBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
    borderBottomWidth: 1, borderBottomColor: colors.slate200,
  },
  topBarTitle: { fontFamily: fonts.displayBold, fontSize: fontSizes.lg, color: colors.slate800 },
  topBarClose: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.sm, color: colors.brand600 },
  flowHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
    borderBottomWidth: 1, borderBottomColor: colors.slate100,
  },
  flowHeaderTitle: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.sm, color: colors.slate800 },
  saveExitButton: { borderWidth: 1, borderColor: colors.slate200, borderRadius: radius.full, paddingHorizontal: spacing.md, paddingVertical: 6 },
  saveExitText: { fontFamily: fonts.bodySemiBold, fontSize: 11, color: colors.slate600 },
  phaseBar: { flexDirection: 'row', gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, backgroundColor: colors.slate50, borderBottomWidth: 1, borderBottomColor: colors.slate100 },
  phaseSegment: { height: 3, borderRadius: 2, backgroundColor: colors.slate200 },
  phaseSegmentActive: { backgroundColor: colors.brand600 },
  phaseLabel: { fontFamily: fonts.body, fontSize: 10, color: colors.slate400, marginTop: 6 },
  phaseLabelActive: { color: colors.brand700, fontFamily: fonts.bodySemiBold },
  flowContent: { padding: spacing.lg, paddingBottom: spacing.xxl },
  blockError: { fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.danger, marginTop: spacing.md },
  flowFooter: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
    borderTopWidth: 1, borderTopColor: colors.slate100, backgroundColor: colors.slate50,
  },
  backLink: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.sm, color: colors.slate700, textDecorationLine: 'underline' },
  pctText: { fontFamily: fonts.body, fontSize: fontSizes.xs, color: colors.slate400 },
  nextButton: { backgroundColor: colors.brand600, borderRadius: radius.md, paddingHorizontal: spacing.xl, paddingVertical: spacing.sm + 4 },
  disabled: { opacity: 0.6 },
  nextButtonText: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.sm, color: colors.white },
  doneContainer: { alignItems: 'center', padding: spacing.xl },
  doneIconOuter: { width: 64, height: 64, borderRadius: radius.full, backgroundColor: colors.brand50, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.lg },
  doneIconInner: { width: 44, height: 44, borderRadius: radius.full, backgroundColor: colors.brand600, alignItems: 'center', justifyContent: 'center' },
  doneTitle: { fontFamily: fonts.displayBold, fontSize: fontSizes.xl, color: colors.slate800, textAlign: 'center' },
  doneBody: { fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.slate500, textAlign: 'center', lineHeight: 20, marginTop: spacing.sm, marginBottom: spacing.lg },
  doneStatusRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.xl },
  doneStatusPill: { paddingHorizontal: spacing.md, paddingVertical: 6, borderRadius: radius.full, backgroundColor: colors.slate100 },
  doneStatusPillActive: { backgroundColor: colors.brand50 },
  doneStatusText: { fontFamily: fonts.bodySemiBold, fontSize: 11, color: colors.slate400 },
  doneStatusTextActive: { color: colors.brand700 },
  doneActions: { flexDirection: 'row', gap: spacing.sm, width: '100%' },
  doneSecondaryButton: { flex: 1, borderWidth: 1, borderColor: colors.slate200, borderRadius: radius.md, paddingVertical: spacing.md, alignItems: 'center' },
  doneSecondaryText: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.sm, color: colors.slate700 },
  donePrimaryButton: { flex: 1, backgroundColor: colors.slate800, borderRadius: radius.md, paddingVertical: spacing.md, alignItems: 'center' },
  donePrimaryText: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.sm, color: colors.white },
})
