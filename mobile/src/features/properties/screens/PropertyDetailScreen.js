import { useState } from 'react'
import { View, Text, Image, ScrollView, Pressable, ActivityIndicator, StyleSheet, Dimensions } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useQuery } from '@tanstack/react-query'
import { propertyService } from '@services/property.service'
import { chatService } from '@services/chat.service'
import { authService } from '@services/auth.service'
import { useAuth } from '@features/auth/hooks/useAuth'
import TrustBadge from '@components/common/TrustBadge'
import RiskAlert from '@components/common/RiskAlert'
import TrustScoreWidget from '@features/trust/components/TrustScoreWidget'
import ReviewsSection from '@features/reviews/components/ReviewsSection'
import ReportButton from '@features/reports/components/ReportButton'
import { imgUrl, formatCompact } from '@utils/format'
import { colors } from '@theme/colors'
import { fonts, fontSizes } from '@theme/typography'
import { spacing, radius } from '@theme/spacing'

const FURNISHED_LABEL = { FULLY: 'Fully furnished', SEMI: 'Semi furnished', UNFURNISHED: 'Unfurnished' }
const SCREEN_WIDTH = Dimensions.get('window').width

export default function PropertyDetailScreen({ route, navigation }) {
  const { propertyId } = route.params
  const [chatLoading, setChatLoading] = useState(false)
  const { user } = useAuth()

  const { data: property, isLoading, isError } = useQuery({
    queryKey: ['property', propertyId],
    queryFn: () => propertyService.getById(propertyId).then((r) => r.data),
    enabled: !!propertyId,
  })

  const { data: profile } = useQuery({
    queryKey: ['me'],
    queryFn: () => authService.getMe().then((r) => r.data),
    enabled: !!user,
  })

  async function handleMessageOwner() {
    setChatLoading(true)
    try {
      await chatService.startConversation(propertyId)
      navigation.getParent()?.navigate('Chat')
    } catch {
      // best-effort
    } finally {
      setChatLoading(false)
    }
  }

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.brand600} size="large" />
      </View>
    )
  }

  if (isError || !property) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyText}>This listing isn&apos;t available anymore.</Text>
      </View>
    )
  }

  const bhkLabel = property.bhk === 0 ? 'Studio' : property.bhk ? `${property.bhk} BHK` : property.sharing ? `${property.sharing} Sharing` : null
  const amenities = property.amenities?.map((a) => a.amenity?.name).filter(Boolean) ?? []
  const isOwner = !!profile && profile.id === property.ownerId

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={{ paddingBottom: 100 }}>
        <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false} style={styles.gallery}>
          {(property.images?.length ? property.images : [null]).map((img, i) => (
            <View key={img?.id ?? i} style={styles.galleryImageWrap}>
              {img ? (
                <Image source={{ uri: imgUrl(img.url, 'detail') }} style={styles.galleryImage} resizeMode="cover" />
              ) : (
                <View style={[styles.galleryImage, styles.galleryFallback]} />
              )}
            </View>
          ))}
        </ScrollView>

        <View style={styles.body}>
          {property.riskScore && (
            <View style={{ marginBottom: spacing.md }}>
              <RiskAlert riskScore={property.riskScore} />
            </View>
          )}

          <View style={styles.priceRow}>
            <Text style={styles.price}>{formatCompact(Number(property.rent))}<Text style={styles.priceUnit}>/mo</Text></Text>
            {property.deposit > 0 && <Text style={styles.deposit}>{formatCompact(Number(property.deposit))} deposit</Text>}
          </View>

          <Text style={styles.title}>{property.title}</Text>
          <Text style={styles.location}>{property.address}, {property.city}</Text>

          {property.trustScore?.badge && (
            <View style={{ marginTop: spacing.xs, marginBottom: spacing.xs }}>
              <TrustBadge badge={property.trustScore.badge} size="sm" />
            </View>
          )}

          <View style={styles.chipRow}>
            {bhkLabel && (
              <View style={[styles.chip, styles.chipBrand]}><Text style={styles.chipTextBrand}>{bhkLabel}</Text></View>
            )}
            {FURNISHED_LABEL[property.furnished] && (
              <View style={styles.chip}><Text style={styles.chipText}>{FURNISHED_LABEL[property.furnished]}</Text></View>
            )}
            {property.area && (
              <View style={styles.chip}><Text style={styles.chipText}>{Math.round(Number(property.area))} sq.ft</Text></View>
            )}
          </View>

          {!!property.description && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>About this home</Text>
              <Text style={styles.description}>{property.description}</Text>
            </View>
          )}

          {!!amenities.length && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Amenities</Text>
              <View style={styles.chipRow}>
                {amenities.map((name) => (
                  <View key={name} style={styles.chip}><Text style={styles.chipText}>{name}</Text></View>
                ))}
              </View>
            </View>
          )}

          {property.owner && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Posted by</Text>
              <View style={styles.ownerRow}>
                <View style={styles.ownerAvatar}>
                  <Text style={styles.ownerAvatarText}>{(property.owner.name || '?')[0].toUpperCase()}</Text>
                </View>
                <Text style={styles.ownerName}>{property.owner.name || 'Property owner'}</Text>
              </View>
            </View>
          )}

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Trust & Safety</Text>
            <TrustScoreWidget trustScore={property.trustScore} />
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Community Reviews</Text>
            <ReviewsSection propertyId={propertyId} isOwner={isOwner} ownerName={property.owner?.name} />
          </View>

          <View style={[styles.section, { alignItems: 'flex-start' }]}>
            <ReportButton propertyId={propertyId} />
          </View>
        </View>
      </ScrollView>

      <SafeAreaView edges={['bottom']} style={styles.footer}>
        <Pressable style={styles.messageButton} onPress={handleMessageOwner} disabled={chatLoading}>
          {chatLoading ? <ActivityIndicator color={colors.brand700} size="small" /> : <Text style={styles.messageButtonText}>Message</Text>}
        </Pressable>
        <Pressable
          style={styles.bookButton}
          onPress={() => navigation.navigate('BookViewing', {
            propertyId,
            windowStart: property.appointmentWindowStart,
            windowEnd: property.appointmentWindowEnd,
          })}
        >
          <Text style={styles.bookButtonText}>Book a viewing</Text>
        </Pressable>
      </SafeAreaView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.white },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.white },
  emptyText: { fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.slate400 },
  gallery: { height: 260 },
  galleryImageWrap: { width: SCREEN_WIDTH, height: 260 },
  galleryImage: { width: '100%', height: '100%' },
  galleryFallback: { backgroundColor: colors.slate100 },
  body: { padding: spacing.lg },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm, marginBottom: spacing.xs },
  price: { fontFamily: fonts.displayBold, fontSize: fontSizes.xxl, color: colors.slate800 },
  priceUnit: { fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.slate400 },
  deposit: { fontFamily: fonts.body, fontSize: fontSizes.xs, color: colors.slate400 },
  title: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.lg, color: colors.slate800, marginTop: spacing.xs },
  location: { fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.slate400, marginTop: 2, marginBottom: spacing.md },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: { backgroundColor: colors.slate100, borderRadius: radius.full, paddingHorizontal: spacing.md, paddingVertical: 6 },
  chipBrand: { backgroundColor: colors.brand50 },
  chipText: { fontFamily: fonts.bodyMedium, fontSize: fontSizes.xs, color: colors.slate600 },
  chipTextBrand: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.xs, color: colors.brand700 },
  section: { marginTop: spacing.lg },
  sectionTitle: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.base, color: colors.slate800, marginBottom: spacing.sm },
  description: { fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.slate600, lineHeight: 21 },
  ownerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  ownerAvatar: { width: 40, height: 40, borderRadius: radius.full, backgroundColor: colors.brand100, alignItems: 'center', justifyContent: 'center' },
  ownerAvatarText: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.base, color: colors.brand700 },
  ownerName: { fontFamily: fonts.bodyMedium, fontSize: fontSizes.sm, color: colors.slate800 },
  footer: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    flexDirection: 'row', gap: spacing.sm, padding: spacing.md,
    backgroundColor: colors.white, borderTopWidth: 1, borderTopColor: colors.slate200,
  },
  messageButton: { flex: 1, borderWidth: 1, borderColor: colors.brand600, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.sm + 4 },
  messageButtonText: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.sm, color: colors.brand700 },
  bookButton: { flex: 2, backgroundColor: colors.brand600, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.sm + 4 },
  bookButtonText: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.sm, color: colors.white },
})
