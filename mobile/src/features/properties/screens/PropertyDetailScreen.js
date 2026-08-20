import { useEffect, useState, useMemo } from 'react'
import { View, Text, ScrollView, Pressable, ActivityIndicator, StyleSheet, useWindowDimensions, Share, Animated } from 'react-native'
import { Image } from 'expo-image'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { propertyService } from '@services/property.service'
import { chatService } from '@services/chat.service'
import { savedService } from '@services/saved.service'
import { appointmentService } from '@services/appointment.service'
import { useAuth } from '@features/auth/hooks/useAuth'
import { propertyUrl } from '@config/links'
import TrustBadge from '@components/common/TrustBadge'
import RiskAlert from '@components/common/RiskAlert'
import TrustScoreWidget from '@features/trust/components/TrustScoreWidget'
import LocationMapCard from '../components/LocationMapCard'
import SpatialContextPanel from '@features/spatial/components/SpatialContextPanel'
import CommuteCalculator from '../components/CommuteCalculator'
import AvailabilityBadge from '../components/AvailabilityBadge'
import PropertyDetailsSection from '../components/PropertyDetailsSection'
import PricingBreakdownSection from '../components/PricingBreakdownSection'
import ZeroBrokerageBanner from '../components/ZeroBrokerageBanner'
import HouseRulesSection from '../components/HouseRulesSection'
import OwnerCard from '../components/OwnerCard'
import ReviewsSection from '@features/reviews/components/ReviewsSection'
import PastTenantReviews from '@features/tenancies/components/PastTenantReviews'
import SimilarHomesSection from '../components/SimilarHomesSection'
import ReportButton from '@features/reports/components/ReportButton'
import Icon from '@components/common/Icon'
import { imgUrl, formatCompact, priceUnit } from '@utils/format'
import { colors } from '@theme/colors'
import { tapSlop } from '@theme/touchTargets'
import { useLayout, centered } from '@theme/breakpoints'
import { shadows } from '@theme/shadows'
import { fonts, fontSizes } from '@theme/typography'
import { spacing, radius } from '@theme/spacing'
import { track } from '@lib/analytics'

// Loaded defensively, for the same reason OfflineBanner loads expo-network that
// way: `expo-clipboard` reaches for its native module at IMPORT time, so on a
// build that predates the dependency the static import throws while this module
// is evaluating — and takes the ENTIRE property page down over a copy-to-
// clipboard convenience. Null means "no clipboard in this build"; the copy
// button then does nothing visible rather than crashing the screen.
//
// Below the imports on purpose: a `require` above them makes every later
// `import` a body statement to eslint's import/first.
let Clipboard = null
try {
  Clipboard = require('expo-clipboard')
} catch {
  Clipboard = null
}

const FURNISHED_LABEL = { FULLY: 'Fully furnished', SEMI: 'Semi furnished', UNFURNISHED: 'Unfurnished' }

// An existing visit request replaces the "Request a visit" button with a status
// pill — mirrors web's AppointmentSection. Only PENDING/ACCEPTED show a pill; a
// rejected/cancelled/reschedule state falls back to letting them request again.
const APPT_STATUS = {
  PENDING:  { label: 'Visit requested', icon: 'clock',       bg: colors.warning50, fg: colors.warning700, iconColor: colors.warning700 },
  ACCEPTED: { label: 'Visit confirmed', icon: 'checkCircle', bg: colors.brand50,   fg: colors.brand700,  iconColor: colors.brand600 },
}

function formatType(type) {
  if (!type) return null
  return type.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase())
}

const AMENITY_ICON_RULES = [
  [/wifi|internet/, 'wifi'], [/lift|elevator/, 'elevator'], [/gym|fitness/, 'gym'],
  [/pool|swim/, 'pool'], [/cctv|camera|surveillance/, 'cctv'], [/security|guard/, 'security'],
  [/power|backup|generator/, 'power'], [/water/, 'water'], [/\bac\b|air.?condition/, 'ac'],
  [/fridge|refrigerator/, 'fridge'], [/washing/, 'washingMachine'], [/garden|park\b/, 'garden'],
  [/gate/, 'gate'], [/parking/, 'parking'],
]
function amenityIcon(name) {
  const n = name.toLowerCase()
  const match = AMENITY_ICON_RULES.find(([re]) => re.test(n))
  return match ? match[1] : 'checkCircle'
}

// Uses only our own listings data — no external API. Requires at least 3
// comparable listings (same city + BHK/sharing) so a lone other listing
// can't masquerade as "the area average" (see properties.service.js).
function rentBenchmarkLabel(rent, benchmark) {
  if (!benchmark) return null
  const diff = Math.round(((rent - benchmark.avgRent) / benchmark.avgRent) * 100)
  if (diff === 0) return { text: 'Right at the average for similar homes nearby', color: colors.slate500 }
  const below = diff < 0
  return {
    text: `${Math.abs(diff)}% ${below ? 'below' : 'above'} the average for similar homes nearby`,
    color: below ? colors.success : colors.warning,
  }
}

export default function PropertyDetailScreen({ route, navigation }) {
  // The gallery pages at exactly one window width, so `pagingEnabled` snaps to
  // photo boundaries. That was a module-level `Dimensions.get('window').width`,
  // read ONCE at import: after a rotation or a multi-window drag every page was
  // the old width and the paging stopped landing on a photo. The hook re-renders.
  const { width: windowWidth } = useWindowDimensions()
  // The gallery and the map stay full-bleed — they are images, and a photo has
  // no reading measure. Everything below them is prose and facts, so it caps.
  const { contentMaxWidth } = useLayout()
  const { propertyId } = route.params
  const [chatLoading, setChatLoading] = useState(false)
  const [copiedId, setCopiedId] = useState(false)
  // The "Copied" label reverts itself, and the effect's cleanup cancels the
  // timer — so navigating away mid-window can't set state on an unmounted
  // screen, which a bare setTimeout in the handler would.
  useEffect(() => {
    if (!copiedId) return undefined
    const t = setTimeout(() => setCopiedId(false), 1600)
    return () => clearTimeout(t)
  }, [copiedId])
  const { user } = useAuth()
  const insets = useSafeAreaInsets()
  const scrollY = useMemo(() => new Animated.Value(0), [])
  // Fade a solid status-bar backing in as the body scrolls up under the status
  // bar. Without it, with headerShown:false under Android edge-to-edge, the
  // clock/battery icons sit directly on the content. 260 = hero gallery height.
  const scrimOpacity = scrollY.interpolate({
    inputRange: [260 - insets.top - 24, 260 - insets.top],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  })
  const qc = useQueryClient()

  const { data: property, isLoading, isError } = useQuery({
    queryKey: ['property', propertyId],
    queryFn: () => propertyService.getById(propertyId).then((r) => r.data),
    enabled: !!propertyId,
  })

  // Funnel step 3. Keyed on the id so opening a second listing counts twice
  // and a background refetch counts once.
  useEffect(() => {
    if (property?.id) track('property_view', { propertyId: property.id, city: property.city })
  }, [property?.id, property?.city])

  const { data: savedList } = useQuery({
    queryKey: ['saved'],
    queryFn: () => savedService.getMySaved().then((r) => r.data),
    enabled: !!user,
  })
  const { data: myAppointments = [] } = useQuery({
    queryKey: ['my-appointments'],
    queryFn: () => appointmentService.mine().then((r) => r.data),
    enabled: !!user,
    staleTime: 60 * 1000,
  })
  const isSaved = savedList?.some((s) => s.propertyId === propertyId) ?? false

  const saveMutation = useMutation({
    mutationFn: (isSaving) =>
      isSaving ? savedService.save(propertyId).then((r) => r.data) : savedService.unsave(propertyId).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['saved'] }),
  })

  function handleSave() {
    if (!user) return
    saveMutation.mutate(!isSaved)
  }

  async function copyDisplayId(displayId) {
    // No clipboard in this build — see the require at the top. Do nothing
    // rather than throwing inside a tap handler, and do NOT flash "Copied",
    // which would be a lie about what just happened.
    if (!Clipboard?.setStringAsync) return
    await Clipboard.setStringAsync(displayId)
    setCopiedId(true)
  }

  // The link goes INSIDE `message`, not in Share.share's `url` field: Android
  // drops `url` entirely and sends only the message, so a listing shared from
  // an Android phone arrived as a price and a city with nothing to tap. Web has
  // always shared its URL; this is the half that was missing.
  function handleShare() {
    if (!property) return
    const unit = priceUnit(property)
    const price = `${formatCompact(Number(property.rent))}${unit}`
    Share.share({
      message: `${property.title} — ${price} in ${property.city}\n${propertyUrl(property.id)}`,
    })
  }

  async function handleMessageOwner() {
    // Funnel step 4. Fired on the ATTEMPT: pressing "message the owner" is the
    // intent, and a failed request is our problem rather than a change of mind.
    track('contact_intent', { propertyId, city: property?.city, props: { via: 'chat' } })
    setChatLoading(true)
    try {
      const convo = await chatService.startConversation(propertyId).then((r) => r.data)
      qc.invalidateQueries({ queryKey: ['conversations'] })
      // Pushed onto THIS stack (AppTabs.js's CONVERSATION_SCREEN rides along
      // with BOOKING_SCREENS) — back returns to the property. Jumping to the
      // Chat tab instead showed whatever that tab was parked on, and back
      // from there could never reach this listing again.
      navigation.navigate('Conversation', {
        conversationId: convo.id,
        other: property.owner,
        otherRole: 'Owner',
      })
    } catch {
      // best-effort
    } finally {
      setChatLoading(false)
    }
  }

  if (isLoading) {
    return (
      <SafeAreaView style={styles.center} edges={['top']}>
        {navigation.canGoBack() && (
          <Pressable style={[styles.circleButton, styles.centerBack]} onPress={() => navigation.goBack()} hitSlop={8} accessibilityRole="button" accessibilityLabel="Go back">
            <Icon name="chevronLeft" size={20} color={colors.slate800} />
          </Pressable>
        )}
        <ActivityIndicator color={colors.brand600} size="large" />
      </SafeAreaView>
    )
  }

  if (isError || !property) {
    return (
      <SafeAreaView style={styles.center} edges={['top']}>
        {navigation.canGoBack() && (
          <Pressable style={[styles.circleButton, styles.centerBack]} onPress={() => navigation.goBack()} hitSlop={8} accessibilityRole="button" accessibilityLabel="Go back">
            <Icon name="chevronLeft" size={20} color={colors.slate800} />
          </Pressable>
        )}
        <Text style={styles.emptyText}>This listing isn&apos;t available anymore.</Text>
      </SafeAreaView>
    )
  }

  const bhkLabel = property.bhk === 0 ? 'Studio' : property.bhk ? `${property.bhk} BHK` : property.sharing ? `${property.sharing} Sharing` : null
  const amenities = property.amenities?.map((a) => a.amenity?.name).filter(Boolean) ?? []
  // Identity check off useAuth().user (loaded at app start), NOT the async
  // ['me'] profile query — otherwise an owner briefly sees "Book a viewing" /
  // "Message" on their own listing until that query resolves. An owner can't
  // book or message themselves, so the footer must be hidden from the first frame.
  const isOwner = !!user && user.id === property.ownerId
  const existingAppt = myAppointments
    .filter((a) => a.propertyId === propertyId)
    .sort((a, b) => new Date(b.createdAt ?? 0) - new Date(a.createdAt ?? 0))[0]
  const apptStatus = existingAppt ? APPT_STATUS[existingAppt.status] : null
  // Prisma's Decimal(10,7) lat/lng serialize as strings over JSON — every
  // other map consumer in this app (PropertyPin, clustering.js) coerces with
  // unary + before using them numerically; react-native-maps crashes with a
  // native "cannot be cast from String to double" if you don't.
  const lat = property.lat != null ? +property.lat : null
  const lng = property.lng != null ? +property.lng : null

  return (
    <View style={styles.container}>
      <Animated.ScrollView
        contentContainerStyle={{ paddingBottom: 100 }}
        scrollEventThrottle={16}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: true })}
      >
        <View>
          <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false} style={styles.gallery}>
            {(property.images?.length ? property.images : [null]).map((img, i) => (
              <View key={img?.id ?? i} style={[styles.galleryImageWrap, { width: windowWidth }]}>
                {img ? (
                  <Image source={{ uri: imgUrl(img.url, 'detail') }} style={styles.galleryImage} contentFit="cover" cachePolicy="memory-disk" transition={200} />
                ) : (
                  <View style={[styles.galleryImage, styles.galleryFallback]} />
                )}
              </View>
            ))}
          </ScrollView>

          <SafeAreaView edges={['top']} style={styles.galleryHeader} pointerEvents="box-none">
            {navigation.canGoBack() ? (
              <Pressable style={styles.circleButton} onPress={() => navigation.goBack()} hitSlop={8} accessibilityRole="button" accessibilityLabel="Go back">
                <Icon name="chevronLeft" size={20} color={colors.slate800} />
              </Pressable>
            ) : <View />}
            <View style={{ flexDirection: 'row', gap: spacing.sm }}>
              <Pressable style={styles.circleButton} onPress={handleShare} hitSlop={8} accessibilityRole="button" accessibilityLabel="Share this listing">
                <Icon name="share" size={18} color={colors.slate800} />
              </Pressable>
              <Pressable
                style={styles.circleButton}
                onPress={handleSave}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel={isSaved ? 'Remove from saved' : 'Save this listing'}
                accessibilityState={{ selected: isSaved }}
              >
                <Icon name={isSaved ? 'heartFilled' : 'heart'} size={18} color={isSaved ? colors.danger : colors.slate800} />
              </Pressable>
            </View>
          </SafeAreaView>
        </View>

        <View style={[styles.body, centered(contentMaxWidth)]}>
          {property.riskScore && (
            <View style={{ marginBottom: spacing.md }}>
              <RiskAlert riskScore={property.riskScore} />
            </View>
          )}

          <AvailabilityBadge status={property.status} availableFrom={property.availableFrom} />

          <View style={styles.priceRow}>
            {/* `rent` is a monthly rent, a refundable lump sum or an asking
                price depending on pricingModel — priceUnit is the only thing
                allowed to decide what follows the number. */}
            <Text style={styles.price}>{formatCompact(Number(property.rent))}<Text style={styles.priceUnit}>{priceUnit(property)}</Text></Text>
            {property.deposit > 0 && <Text style={styles.deposit}>{formatCompact(Number(property.deposit))} deposit</Text>}
          </View>

          {(() => {
            const bench = rentBenchmarkLabel(Number(property.rent), property.rentBenchmark)
            return bench && <Text style={[styles.benchmark, { color: bench.color }]}>{bench.text}</Text>
          })()}

          <Text style={styles.title}>{property.title}</Text>
          {/* The listing id is what someone reads out on the phone or pastes
              into a message to ask "is this one still free?". It was static
              text, so the only way to use it was to retype it correctly from a
              screen — 48dp target, and the label itself is the confirmation
              (there is no toast primitive on mobile, and a chip that says
              "Copied" is clearer than one anyway). */}
          {!!property.displayId && (
            <Pressable
              style={styles.idChip}
              onPress={() => copyDisplayId(property.displayId)}
              accessibilityRole="button"
              accessibilityLabel={`Copy listing id ${property.displayId}`}
              hitSlop={tapSlop(20)}
            >
              <Icon name={copiedId ? 'check' : 'copy'} size={11} color={colors.slate500} />
              <Text style={styles.idChipText}>{copiedId ? 'Copied' : property.displayId}</Text>
            </Pressable>
          )}
          <Text style={styles.location}>{property.address}, {property.city}</Text>

          {property.trustScore?.badge && (
            <View style={{ marginTop: spacing.xs, marginBottom: spacing.xs }}>
              <TrustBadge badge={property.trustScore.badge} size="sm" />
            </View>
          )}

          <View style={styles.chipRow}>
            {bhkLabel && (
              <View style={[styles.chip, styles.chipBrand]}>
                <Icon name="bed" size={13} color={colors.brand700} />
                <Text style={styles.chipTextBrand}>{bhkLabel}</Text>
              </View>
            )}
            {FURNISHED_LABEL[property.furnished] && (
              <View style={styles.chip}>
                <Icon name="sofa" size={13} color={colors.slate600} />
                <Text style={styles.chipText}>{FURNISHED_LABEL[property.furnished]}</Text>
              </View>
            )}
            {!!property.type && (
              <View style={styles.chip}>
                <Icon name="home" size={13} color={colors.slate600} />
                <Text style={styles.chipText}>{formatType(property.type)}</Text>
              </View>
            )}
            {property.area && (
              <View style={styles.chip}>
                <Icon name="area" size={13} color={colors.slate600} />
                <Text style={styles.chipText}>{Math.round(Number(property.area))} sq.ft</Text>
              </View>
            )}
          </View>

          {!!property.description && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>About this home</Text>
              <Text style={styles.description}>{property.description}</Text>
            </View>
          )}

          <PropertyDetailsSection property={property} />
          <PricingBreakdownSection property={property} />
          <ZeroBrokerageBanner brokerage={property.brokerage} />
          <HouseRulesSection rules={property.rules} />

          <LocationMapCard lat={lat} lng={lng} approximate={!!property?.approximateLocation} />
          {/* The spatial layer supersedes AreaIntelligenceSection and
              PropertyAreaInsightCard (2026-07-19, matching web) — context
              arrives joined on the property payload, already filtered to this
              listing's property type. CommuteCalculator survives inside the
              same titled group. */}
          <SpatialContextPanel context={property.spatialContext} coords={{ lat, lng }}>
            <CommuteCalculator lat={lat} lng={lng} />
          </SpatialContextPanel>

          {!!amenities.length && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Amenities</Text>
              <View style={styles.chipRow}>
                {amenities.map((name) => (
                  <View key={name} style={styles.chip}>
                    <Icon name={amenityIcon(name)} size={13} color={colors.slate600} />
                    <Text style={styles.chipText}>{name}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          <OwnerCard owner={property.owner} />

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Trust & Safety</Text>
            <TrustScoreWidget trustScore={property.trustScore} />
          </View>

          <View style={styles.section}>
            <ReviewsSection title="Community Reviews" propertyId={propertyId} isOwner={isOwner} ownerName={property.owner?.name} />
            {/* Tenancy-backed reviews of the OWNER — renders nothing when
                there are none, so no heading ever sits above an empty box. */}
            <PastTenantReviews propertyId={propertyId} />
          </View>

          {/* "Homes like this one" sits after reviews and before the report
              link: it is the next step for somebody who has read this listing
              and decided against it. Renders nothing — heading included — when
              there are no neighbours. */}
          <SimilarHomesSection propertyId={propertyId} />

          <View style={[styles.section, { alignItems: 'flex-start' }]}>
            <ReportButton propertyId={propertyId} />
          </View>
        </View>
      </Animated.ScrollView>

      {/* Solid status-bar backing, fades in once content scrolls under it. */}
      <Animated.View pointerEvents="none" style={[styles.statusScrim, { height: insets.top, opacity: scrimOpacity }]} />

      {/* The footer is a plain View, not SafeAreaView: this screen lives
          inside the tab stack, and the tab bar underneath already owns the
          bottom inset. Claiming it here too stacked a second safe-area gap
          under the buttons — the "two things claiming one inset" bug. */}
      {!isOwner && (
        <View style={styles.footer}>
          {/* The BAR spans the window — it is chrome, and a white strip that
              stopped at 640 would leave the canvas showing either side of it.
              The BUTTONS inside it cap, because "Request a visit" 900dp wide is
              a banner, not a button. */}
          <View style={[styles.footerRow, centered(contentMaxWidth)]}>
          <Pressable style={styles.messageButton} onPress={handleMessageOwner} disabled={chatLoading}>
            {chatLoading ? (
              <ActivityIndicator color={colors.brand700} size="small" />
            ) : (
              <>
                <Icon name="messageCircle" size={16} color={colors.brand700} />
                <Text style={styles.messageButtonText}>Message</Text>
              </>
            )}
          </Pressable>
          {apptStatus ? (
            // Tappable, not a label. This sat in the footer as an inert View:
            // it announced that a visit existed and offered no way to reach it,
            // so changing your mind meant leaving the listing and finding
            // Visits under Profile unaided. Renter-mode visits live in the
            // Profile stack, hence the cross-tab navigate; `initial: false`
            // leaves ProfileHome underneath so back goes somewhere sensible.
            <Pressable
              style={[styles.apptStatus, { backgroundColor: apptStatus.bg }]}
              onPress={() => navigation.getParent()?.navigate('Profile', { screen: 'Appointments', initial: false })}
              accessibilityRole="button"
              accessibilityLabel={`${apptStatus.label} — view or cancel this visit`}
            >
              <Icon name={apptStatus.icon} size={16} color={apptStatus.iconColor} />
              <Text style={[styles.apptStatusText, { color: apptStatus.fg }]}>{apptStatus.label}</Text>
              <Icon name="chevronRight" size={14} color={apptStatus.fg} />
            </Pressable>
          ) : (
            <Pressable
              style={styles.bookButton}
              onPress={() => navigation.navigate('BookViewing', {
                propertyId,
                windowStart: property.appointmentWindowStart,
                windowEnd: property.appointmentWindowEnd,
              })}
            >
              <Icon name="calendar" size={16} color={colors.white} />
              <Text style={styles.bookButtonText}>Request a visit</Text>
            </Pressable>
          )}
          </View>
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.white },
  statusScrim: { position: 'absolute', top: 0, left: 0, right: 0, backgroundColor: colors.white },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.white },
  centerBack: { position: 'absolute', top: spacing.sm, left: spacing.md },
  emptyText: { fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.slate500 },
  gallery: { height: 260 },
  galleryImageWrap: { height: 260 },
  galleryImage: { width: '100%', height: '100%' },
  galleryFallback: { backgroundColor: colors.slate100 },
  galleryHeader: {
    position: 'absolute', top: 0, left: 0, right: 0,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.md, paddingTop: spacing.sm,
  },
  circleButton: {
    width: 36, height: 36, borderRadius: radius.full, backgroundColor: 'rgba(255,255,255,0.92)',
    alignItems: 'center', justifyContent: 'center',
    ...shadows.md,
  },
  body: { padding: spacing.lg },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm, marginBottom: spacing.xs },
  price: { fontFamily: fonts.displayBold, fontSize: fontSizes.xxl, color: colors.slate800 },
  priceUnit: { fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.slate500 },
  deposit: { fontFamily: fonts.body, fontSize: fontSizes.xs, color: colors.slate500 },
  benchmark: { fontFamily: fonts.bodyMedium, fontSize: fontSizes.xs, marginBottom: spacing.xs },
  title: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.lg, color: colors.slate800, marginTop: spacing.xs },
  // minHeight pins the box the slop below is computed against; it grows with
  // the OS font setting, so the target only ever gets bigger from here.
  idChip: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 20, backgroundColor: colors.slate100, borderRadius: radius.md, paddingHorizontal: 8, paddingVertical: 2, marginTop: 4 },
  idChipText: { fontFamily: fonts.bodySemiBold, fontSize: 11, color: colors.slate500, letterSpacing: 0.5 },
  location: { fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.slate500, marginTop: 2, marginBottom: spacing.md },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: colors.slate100, borderRadius: radius.full, paddingHorizontal: spacing.md, paddingVertical: 6 },
  chipBrand: { backgroundColor: colors.brand50 },
  chipText: { fontFamily: fonts.bodyMedium, fontSize: fontSizes.xs, color: colors.slate600 },
  chipTextBrand: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.xs, color: colors.brand700 },
  section: { marginTop: spacing.lg },
  sectionTitle: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.base, color: colors.slate800, marginBottom: spacing.sm },
  description: { fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.slate600, lineHeight: 21 },
  footer: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    padding: spacing.md,
    backgroundColor: colors.white, borderTopWidth: 1, borderTopColor: colors.slate200,
  },
  footerRow: { flexDirection: 'row', gap: spacing.sm },
  messageButton: { flex: 1, minHeight: 44, flexDirection: 'row', gap: 6, borderWidth: 1, borderColor: colors.brand600, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.sm + 4 },
  messageButtonText: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.sm, color: colors.brand700 },
  bookButton: { flex: 2, minHeight: 44, flexDirection: 'row', gap: 6, backgroundColor: colors.brand600, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.sm + 4 },
  bookButtonText: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.sm, color: colors.white },
  apptStatus: { flex: 2, minHeight: 44, flexDirection: 'row', gap: 6, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.sm + 4 },
  apptStatusText: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.sm },
})
