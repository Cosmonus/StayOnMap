import { View, Text, Image, Pressable, StyleSheet } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useQuery } from '@tanstack/react-query'
import Icon from '@components/common/Icon'
import { propertyService } from '@services/property.service'
import { formatCompact, imgUrl } from '@utils/format'
import { colors } from '@theme/colors'
import { fonts, fontSizes } from '@theme/typography'
import { spacing, radius } from '@theme/spacing'

// Floating preview card over the map for the currently selected pin — same
// query key ('property', id) PropertyDetailScreen uses, so tapping through
// is served from cache instead of refetching. Renders nothing until a pin
// is selected (ExploreScreen only mounts this when selectedPinId is set).
export default function PinPreviewCard({ propertyId, onPress }) {
  const { data: property, isLoading } = useQuery({
    queryKey: ['property', propertyId],
    queryFn: () => propertyService.getById(propertyId).then((r) => r.data),
    enabled: !!propertyId,
  })

  return (
    <SafeAreaView edges={['bottom']} style={styles.wrap} pointerEvents="box-none">
      {isLoading || !property ? (
        <View style={styles.card}>
          <View style={styles.skeleton} />
        </View>
      ) : (
        <Pressable style={styles.card} onPress={onPress}>
          <View style={styles.imageWrap}>
            {property.images?.[0] ? (
              <Image source={{ uri: imgUrl(property.images[0].url, 'card') }} style={styles.image} resizeMode="cover" />
            ) : (
              <View style={[styles.image, styles.imageFallback]} />
            )}
          </View>

          <View style={styles.body}>
            <Text style={styles.price}>{formatCompact(Number(property.rent))}<Text style={styles.priceUnit}>/mo</Text></Text>
            <Text style={styles.title} numberOfLines={1}>{property.title}</Text>
            <View style={styles.metaRow}>
              {bhkLabel(property) && (
                <View style={styles.chip}>
                  <Icon name="bed" size={11} color={colors.brand700} />
                  <Text style={styles.chipText}>{bhkLabel(property)}</Text>
                </View>
              )}
              <Text style={styles.city} numberOfLines={1}>{property.city}</Text>
            </View>
          </View>

          <View style={styles.navButton}>
            <Icon name="chevronRight" size={18} color={colors.white} />
          </View>
        </Pressable>
      )}
    </SafeAreaView>
  )
}

function bhkLabel(property) {
  if (property.bhk === 0) return 'Studio'
  if (property.bhk) return `${property.bhk} BHK`
  if (property.sharing) return `${property.sharing} Sharing`
  return null
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: spacing.md, paddingBottom: spacing.sm },
  card: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    backgroundColor: colors.white, borderRadius: radius.xl, padding: spacing.sm + 2,
    shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 6,
  },
  skeleton: { height: 72, width: '100%', borderRadius: radius.lg, backgroundColor: colors.slate100 },
  imageWrap: { width: 72, height: 72, borderRadius: radius.lg, overflow: 'hidden', backgroundColor: colors.slate100 },
  image: { width: '100%', height: '100%' },
  imageFallback: { backgroundColor: colors.slate100 },
  body: { flex: 1, minWidth: 0 },
  price: { fontFamily: fonts.displayBold, fontSize: fontSizes.lg, color: colors.slate800 },
  priceUnit: { fontFamily: fonts.body, fontSize: fontSizes.xs, color: colors.slate400 },
  title: { fontFamily: fonts.bodyMedium, fontSize: fontSizes.sm, color: colors.slate700, marginTop: 2 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.xs },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.brand50, borderRadius: radius.full, paddingHorizontal: 8, paddingVertical: 2 },
  chipText: { fontFamily: fonts.bodySemiBold, fontSize: 11, color: colors.brand700 },
  city: { fontFamily: fonts.body, fontSize: fontSizes.xs, color: colors.slate400, flexShrink: 1 },
  navButton: {
    width: 36, height: 36, borderRadius: radius.full, backgroundColor: colors.brand600,
    alignItems: 'center', justifyContent: 'center',
  },
})
