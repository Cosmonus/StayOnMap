import { useState, useRef } from 'react'
import { View, Text, ScrollView, Pressable, ActivityIndicator, StyleSheet, Dimensions, Share, Animated } from 'react-native'
import { Image } from 'expo-image'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { propertyService } from '@services/property.service'
import { chatService } from '@services/chat.service'
import { savedService } from '@services/saved.service'
import { useAuth } from '@features/auth/hooks/useAuth'
import { useUiStore } from '@store/uiStore'
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
import ReportButton from '@features/reports/components/ReportButton'
import Icon from '@components/common/Icon'
import { imgUrl, formatCompact } from '@utils/format'
import { colors } from '@theme/colors'
import { shadows } from '@theme/shadows'
import { fonts, fontSizes } from '@theme/typography'
import { spacing, radius } from '@theme/spacing'

const FURNISHED_LABEL = { FULLY: 'Fully furnished', SEMI: 'Semi furnished', UNFURNISHED: 'Unfurnished' }
const SCREEN_WIDTH = Dimensions.get('window').width

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
  if (diff === 0) return { text: 'Right at the average for similar homes nearby', color: colors.slate400 }
  const below = diff < 0
  return {
    text: `${Math.abs(diff)}% ${below ? 'below' : 'above'} the average for similar homes nearby`,
    color: below ? colors.success : colors.warning,
  }
}

export default function PropertyDetailScreen({ route, navigation }) {
  const { propertyId } = route.params
  const [chatLoading, setChatLoading] = useState(false)
  const { user } = useAuth()
  const insets = useSafeAreaInsets()
  const scrollY = useRef(new Animated.Value(0)).current
  // Fade a solid status-bar backing in as the body scrolls up under the status
  // bar. Without it, with headerShown:false under Android edge-to-edge, the
  // clock/battery icons sit directly on the content. 260 = hero gallery height.
  const scrimOpacity = scrollY.interpolate({
    inputRange: [260 - insets.top - 24, 260 - insets.top],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  })
  const hostMode = useUiStore((s) => s.hostMode)
  const qc = useQueryClient()

  const { data: property, isLoading, isError } = useQuery({
    queryKey: ['property', propertyId],
    queryFn: () => propertyService.getById(propertyId).then((r) => r.data),
    enabled: !!propertyId,
  })

  const { data: savedList } = useQuery({
    queryKey: ['saved'],
    queryFn: () => savedService.getMySaved().then((r) => r.data),
    enabled: !!user,
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

  function handleShare() {
    if (!property) return
    const unit = property.pricingModel === 'LEASE' ? ' lease' : '/mo'
    Share.share({ message: `${property.title} — ${formatCompact(Number(property.rent))}${unit} in ${property.city}` })
  }

  async function handleMessageOwner() {
    setChatLoading(true)
    try {
      await chatService.startConversation(propertyId)
      navigation.getParent()?.navigate(hostMode ? 'Inbox' : 'Chat')
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
              <View key={img?.id ?? i} style={styles.galleryImageWrap}>
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

        <View style={styles.body}>
          {property.riskScore && (
            <View style={{ marginBottom: spacing.md }}>
              <RiskAlert riskScore={property.riskScore} />
            </View>
          )}

          <AvailabilityBadge status={property.status} availableFrom={property.availableFrom} />

          <View style={styles.priceRow}>
            {/* On a LEASE listing `rent` is the refundable lump sum — never "/mo". */}
            <Text style={styles.price}>{formatCompact(Number(property.rent))}<Text style={styles.priceUnit}>{property.pricingModel === 'LEASE' ? ' lease' : '/mo'}</Text></Text>
            {property.deposit > 0 && <Text style={styles.deposit}>{formatCompact(Number(property.deposit))} deposit</Text>}
          </View>

          {(() => {
            const bench = rentBenchmarkLabel(Number(property.rent), property.rentBenchmark)
            return bench && <Text style={[styles.benchmark, { color: bench.color }]}>{bench.text}</Text>
          })()}

          <Text style={styles.title}>{property.title}</Text>
          {!!property.displayId && (
            <View style={styles.idChip}>
              <Text style={styles.idChipText}>{property.displayId}</Text>
            </View>
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

          <LocationMapCard lat={lat} lng={lng} />
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
          </View>

          <View style={[styles.section, { alignItems: 'flex-start' }]}>
            <ReportButton propertyId={propertyId} />
          </View>
        </View>
      </Animated.ScrollView>

      {/* Solid status-bar backing, fades in once content scrolls under it. */}
      <Animated.View pointerEvents="none" style={[styles.statusScrim, { height: insets.top, opacity: scrimOpacity }]} />

      {!isOwner && (
        <SafeAreaView edges={['bottom']} style={styles.footer}>
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
          <Pressable
            style={styles.bookButton}
            onPress={() => navigation.navigate('BookViewing', {
              propertyId,
              windowStart: property.appointmentWindowStart,
              windowEnd: property.appointmentWindowEnd,
            })}
          >
            <Icon name="calendar" size={16} color={colors.white} />
            <Text style={styles.bookButtonText}>Book a viewing</Text>
          </Pressable>
        </SafeAreaView>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.white },
  statusScrim: { position: 'absolute', top: 0, left: 0, right: 0, backgroundColor: colors.white },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.white },
  centerBack: { position: 'absolute', top: spacing.sm, left: spacing.md },
  emptyText: { fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.slate400 },
  gallery: { height: 260 },
  galleryImageWrap: { width: SCREEN_WIDTH, height: 260 },
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
  priceUnit: { fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.slate400 },
  deposit: { fontFamily: fonts.body, fontSize: fontSizes.xs, color: colors.slate400 },
  benchmark: { fontFamily: fonts.bodyMedium, fontSize: fontSizes.xs, marginBottom: spacing.xs },
  title: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.lg, color: colors.slate800, marginTop: spacing.xs },
  idChip: { alignSelf: 'flex-start', backgroundColor: colors.slate100, borderRadius: radius.md, paddingHorizontal: 8, paddingVertical: 2, marginTop: 4 },
  idChipText: { fontFamily: fonts.bodySemiBold, fontSize: 10, color: colors.slate500, letterSpacing: 0.5 },
  location: { fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.slate400, marginTop: 2, marginBottom: spacing.md },
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
    flexDirection: 'row', gap: spacing.sm, padding: spacing.md,
    backgroundColor: colors.white, borderTopWidth: 1, borderTopColor: colors.slate200,
  },
  messageButton: { flex: 1, minHeight: 44, flexDirection: 'row', gap: 6, borderWidth: 1, borderColor: colors.brand600, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.sm + 4 },
  messageButtonText: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.sm, color: colors.brand700 },
  bookButton: { flex: 2, minHeight: 44, flexDirection: 'row', gap: 6, backgroundColor: colors.brand600, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.sm + 4 },
  bookButtonText: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.sm, color: colors.white },
})
