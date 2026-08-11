import { View, Text, Pressable, StyleSheet } from 'react-native'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { savedSearchService } from '@services/savedSearch.service'
import Icon from '@components/common/Icon'
import { tapSlop } from '@theme/touchTargets'
import { colors } from '@theme/colors'
import { fonts, fontSizes } from '@theme/typography'
import { spacing, radius } from '@theme/spacing'

// The searches the platform is watching for this person. Mirrors web's
// SavedSearches: lives on the saved list beside the saved homes — the one
// screen built from the renter's own choices — and renders NOTHING when there
// are none. The affordance to create one lives on the results list, where a
// thin result makes the offer make sense; an empty box here would be a
// feature advertising itself.
export default function SavedSearchList({ enabled = true }) {
  const qc = useQueryClient()
  const { data: searches = [] } = useQuery({
    queryKey: ['saved-searches'],
    queryFn: () => savedSearchService.list().then((r) => r.data),
    enabled,
  })

  const remove = useMutation({
    mutationFn: (id) => savedSearchService.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['saved-searches'] }),
  })

  if (!searches.length) return null

  return (
    <View style={styles.wrap}>
      <Text style={styles.heading}>Watching for you</Text>
      {searches.map((s) => (
        <View key={s.id} style={styles.row}>
          <View style={styles.iconWell}>
            <Icon name="bell" size={14} color={colors.brand600} />
          </View>
          <View style={styles.body}>
            <Text style={styles.name} numberOfLines={1}>{s.name}</Text>
            <Text style={styles.meta}>You&rsquo;ll hear when a new home matches</Text>
          </View>
          <Pressable
            onPress={() => remove.mutate(s.id)}
            disabled={remove.isPending}
            hitSlop={tapSlop(18)}
            accessibilityRole="button"
            accessibilityLabel={`Stop watching ${s.name}`}
          >
            <Icon name="trash" size={18} color={colors.slate500} />
          </Pressable>
        </View>
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { marginBottom: spacing.md, gap: spacing.xs },
  heading: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.base, color: colors.slate800, marginBottom: spacing.xs },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    backgroundColor: colors.white, borderWidth: 1, borderColor: colors.slate200,
    borderRadius: radius.lg, padding: spacing.md,
  },
  iconWell: {
    width: 36, height: 36, borderRadius: radius.md, backgroundColor: colors.brand50,
    alignItems: 'center', justifyContent: 'center',
  },
  body: { flex: 1, minWidth: 0 },
  name: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.sm, color: colors.slate800 },
  meta: { fontFamily: fonts.body, fontSize: fontSizes.xs, color: colors.slate500, marginTop: 2 },
})
