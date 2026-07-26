import { useState } from 'react'
import { View, Text, Pressable, StyleSheet } from 'react-native'
import { Image } from 'expo-image'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@features/auth/hooks/useAuth'
import { savedService } from '@services/saved.service'
import { imgUrl, formatCompact } from '@utils/format'
import Icon from '@components/common/Icon'
import { colors } from '@theme/colors'
import { fonts, fontSizes } from '@theme/typography'
import { spacing, radius } from '@theme/spacing'

// Lightweight card for the "Homes in this area" rail — neither PropertyCard
// (too heavy/chip-laden for a 3-across compact rail) nor PinPreviewCard
// (72x72 fixed thumb, wrong shape) fit here.
export default function MapHomeCard({ property, isSaved: initialSaved = false, onPress }) {
  const { user } = useAuth()
  const qc = useQueryClient()
  const [saved, setSaved] = useState(initialSaved)

  const mutation = useMutation({
    mutationFn: (isSaving) =>
      isSaving ? savedService.save(property.id).then((r) => r.data) : savedService.unsave(property.id).then((r) => r.data),
    onMutate: (isSaving) => setSaved(isSaving),
    onError: (_err, isSaving) => setSaved(!isSaving),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['saved'] }),
  })

  function handleHeartPress() {
    if (!user) return
    mutation.mutate(!saved)
  }

  const thumb = property.images?.[0]?.url ?? property.images?.[0]
  const bhkLabel = property.type === 'PG'
    ? `${property.sharing}-Sharing`
    : property.bhk != null ? `${property.bhk} BHK` : null

  return (
    <Pressable style={styles.card} onPress={onPress} accessibilityRole="button" accessibilityLabel={`View ${property.title}`}>
      <View style={styles.imageWrap}>
        {thumb ? (
          <Image source={{ uri: imgUrl(thumb, 'card') }} style={styles.image} contentFit="cover" cachePolicy="memory-disk" transition={200} />
        ) : (
          <View style={[styles.image, styles.imageFallback]} />
        )}
        <Pressable
          style={styles.heartButton}
          onPress={handleHeartPress}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel={saved ? 'Remove from saved' : 'Save property'}
          accessibilityState={{ selected: saved }}
        >
          <Icon name={saved ? 'heartFilled' : 'heart'} size={13} color={saved ? colors.danger : colors.white} />
        </Pressable>
      </View>
      <Text style={styles.rent} numberOfLines={1}>
        {formatCompact(Number(property.rent))}<Text style={styles.rentUnit}>{property.pricingModel === 'LEASE' ? ' lease' : '/mo'}</Text>
      </Text>
      <Text style={styles.title} numberOfLines={1}>{property.title}</Text>
      <Text style={styles.spec} numberOfLines={1}>
        {[bhkLabel, property.city].filter(Boolean).join(' · ')}
      </Text>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  card: { flex: 1, minWidth: 0 },
  imageWrap: { aspectRatio: 4 / 3, borderRadius: radius.md, overflow: 'hidden', backgroundColor: colors.slate100 },
  image: { width: '100%', height: '100%' },
  imageFallback: { backgroundColor: colors.slate100 },
  heartButton: {
    position: 'absolute', top: 6, right: 6, width: 24, height: 24, borderRadius: radius.full,
    backgroundColor: 'rgba(0,0,0,0.35)', alignItems: 'center', justifyContent: 'center',
  },
  rent: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.sm, color: colors.slate800, marginTop: spacing.xs },
  rentUnit: { fontFamily: fonts.body, fontSize: 10, color: colors.slate400 },
  title: { fontFamily: fonts.bodyMedium, fontSize: fontSizes.xs, color: colors.slate700, marginTop: 1 },
  spec: { fontFamily: fonts.body, fontSize: 10, color: colors.slate400, marginTop: 1 },
})
