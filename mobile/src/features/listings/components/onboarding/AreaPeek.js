import { View, Text, StyleSheet } from 'react-native'
import { useQuery } from '@tanstack/react-query'
import { spatialService } from '@services/spatial.service'
import Icon from '@components/common/Icon'
import { colors } from '@theme/colors'
import { fonts, fontSizes } from '@theme/typography'
import { spacing, radius } from '@theme/spacing'

// Mirror of web's AreaPeek — what renters will see computed from this pin,
// shown while the pin can still be moved.
//
// Read straight from our own PoiIndex (free, unmetered, no Google call) and
// stated as DISTANCE, never as a walk time — a straight line across a rail
// line is not a six-minute walk. Same rule the property page follows.
const CATEGORIES = [
  { key: 'metro_station', label: 'a metro station' },
  { key: 'supermarket', label: 'groceries' },
  { key: 'school', label: 'a school' },
  { key: 'hospital', label: 'a hospital' },
]

const RADIUS_M = 2000

function phrase(m) {
  return m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${m} m`
}

export default function AreaPeek({ lat, lng }) {
  const { data } = useQuery({
    queryKey: ['wizard-area-peek', lat?.toFixed(4), lng?.toFixed(4)],
    queryFn: () =>
      spatialService
        .getPoisNear(lat, lng, CATEGORIES.map((c) => c.key).join(','), RADIUS_M)
        .then((r) => r.data),
    enabled: lat != null && lng != null,
    staleTime: 60 * 60 * 1000,
  })

  // No pin, or a city whose map data isn't loaded — say nothing. "We cannot
  // check" must never wear the clothes of a finding.
  if (!data?.available) return null

  const nearest = CATEGORIES
    .map((c) => ({ ...c, poi: data.pois.find((p) => p.category === c.key) }))
    .filter((c) => c.poi)
    .slice(0, 2)

  if (nearest.length === 0) return null

  return (
    <View style={styles.card}>
      <Icon name="info" size={16} color={colors.brand700} />
      <Text style={styles.text}>
        We found{' '}
        {nearest.map((c, i) => (
          <Text key={c.key}>
            {i > 0 ? ' and ' : ''}
            <Text style={styles.strong}>{c.poi.name || c.label} {phrase(c.poi.distanceM)}</Text>
          </Text>
        ))}{' '}
        from this pin. Renters will see these on your listing.
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start',
    backgroundColor: colors.brand50, borderRadius: radius.lg, padding: spacing.md,
  },
  text: { flex: 1, fontFamily: fonts.body, fontSize: fontSizes.xs, color: colors.brand900, lineHeight: 18 },
  strong: { fontFamily: fonts.bodySemiBold },
})
