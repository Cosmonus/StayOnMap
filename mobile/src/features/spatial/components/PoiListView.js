import { useMemo, useState } from 'react'
import { View, Text, TextInput, Pressable, ScrollView, Linking, StyleSheet } from 'react-native'
import { Search, Navigation, Clock } from 'lucide-react-native'
import { colors } from '@theme/colors'
import { tapBox } from '@theme/touchTargets'
import { fonts, fontSizes } from '@theme/typography'
import { spacing, radius } from '@theme/spacing'
import usePoisNear from '../hooks/usePoisNear'
import { MODULE_POI_BROWSE, POI_CATEGORY_LABEL } from '../meta'

// The named places behind a module's counts — "which banks", not "how many".
// RN mirror of web's PoiListView; the interaction contract is identical:
//   - Nothing is fetched until a category pill is chosen, and each category is
//     fetched at most once per session — React Query caches it and every
//     keystroke filters locally.
//   - Search is instant, case-insensitive, whitespace-tolerant, and matches
//     name AND brand/operator ("icici" finds a bare-named branch).
//   - Opening hours render only when OSM recorded them — never a guess.
//
// The rows live in a height-capped inner ScrollView (nestedScrollEnabled for
// Android) rather than a FlatList: the list is server-capped at 100 small
// rows — bounded, so the FlatList rule for unbounded lists doesn't apply, and
// nesting a VirtualizedList inside the sheet's ScrollView would warn.

function formatDistance(m) {
  return m < 1000 ? `${m} m` : `${(m / 1000).toFixed(1)} km`
}

const normalize = (s) => (s ?? '').toLowerCase().trim()

function openDirections(lat, lng) {
  Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`).catch(() => {})
}

export default function PoiListView({ moduleKey, lat, lng }) {
  const browse = MODULE_POI_BROWSE[moduleKey]
  const [category, setCategory] = useState(null)
  const [query, setQuery] = useState('')

  const { data, isLoading, isError, refetch } = usePoisNear({
    lat,
    lng,
    category,
    radius: browse?.radius,
    enabled: Boolean(browse && category),
  })

  const filtered = useMemo(() => {
    if (!data?.pois) return []
    const q = normalize(query)
    if (!q) return data.pois
    return data.pois.filter(
      (p) => normalize(p.name).includes(q) || normalize(p.brand).includes(q)
    )
  }, [data, query])

  if (!browse || lat == null || lng == null) return null

  const categoryLabel = POI_CATEGORY_LABEL[category] ?? category

  return (
    <View style={styles.wrap}>
      <Text style={styles.heading}>Nearby places</Text>

      <View style={styles.pills} accessibilityRole="tablist">
        {browse.categories.map((c) => {
          const active = c === category
          return (
            <Pressable
              key={c}
              onPress={() => { setCategory(active ? null : c); setQuery('') }}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              accessibilityLabel={`${POI_CATEGORY_LABEL[c] ?? c} nearby`}
              style={[styles.pill, active && styles.pillActive]}
            >
              <Text style={[styles.pillText, active && styles.pillTextActive]}>
                {POI_CATEGORY_LABEL[c] ?? c}
              </Text>
            </Pressable>
          )
        })}
      </View>

      {category && (
        <View style={styles.results}>
          {isLoading && (
            <>
              <View style={styles.skeleton} />
              <View style={styles.skeleton} />
            </>
          )}

          {isError && (
            <View style={styles.notice}>
              <Text style={styles.noticeText}>Couldn&apos;t load nearby places.</Text>
              <Pressable onPress={() => refetch()} style={tapBox} accessibilityRole="button">
                <Text style={styles.retry}>Try again</Text>
              </Pressable>
            </View>
          )}

          {data && !data.available && (
            <View style={styles.notice}>
              <Text style={styles.noticeText}>
                Local place data hasn&apos;t been loaded for this city yet — this
                is &ldquo;not loaded&rdquo;, not &ldquo;nothing here&rdquo;.
              </Text>
            </View>
          )}

          {data?.available && (
            <>
              <View style={styles.searchWrap}>
                <Search size={14} color={colors.slate500} />
                <TextInput
                  value={query}
                  onChangeText={setQuery}
                  placeholder={`Search ${categoryLabel.toLowerCase()}…`}
                  placeholderTextColor={colors.slate500}
                  accessibilityLabel={`Search nearby ${categoryLabel}`}
                  style={styles.searchInput}
                  autoCorrect={false}
                  returnKeyType="search"
                />
              </View>

              {filtered.length === 0 && (
                <View style={styles.notice}>
                  <Text style={styles.noticeText}>
                    {query
                      ? `Nothing matching “${query.trim()}” nearby.`
                      : `None mapped within ${formatDistance(data.radiusM)} — in a lightly-mapped area that can mean unmapped rather than absent.`}
                  </Text>
                </View>
              )}

              {filtered.length > 0 && (
                <ScrollView style={styles.list} nestedScrollEnabled showsVerticalScrollIndicator>
                  {filtered.map((p, i) => (
                    <View
                      key={`${p.lat},${p.lng},${p.name ?? i}`}
                      style={[styles.poiRow, i === filtered.length - 1 && styles.poiRowLast]}
                    >
                      <View style={styles.poiBody}>
                        <Text style={styles.poiName} numberOfLines={1}>
                          {p.name ?? `Unnamed ${(POI_CATEGORY_LABEL[p.category] ?? p.category).toLowerCase().replace(/s$/, '')}`}
                          {p.brand && p.brand !== p.name ? <Text style={styles.poiBrand}> · {p.brand}</Text> : null}
                        </Text>
                        <Text style={styles.poiMeta}>
                          {p.walkMinutes != null
                            ? `≈${p.walkMinutes} min walk · ${formatDistance(p.distanceM)}`
                            : formatDistance(p.distanceM)}
                        </Text>
                        {!!p.openingHours && (
                          <View style={styles.hoursRow}>
                            <Clock size={10} color={colors.slate500} />
                            {/* Only when the backend read the hours with
                                confidence. Absent means unknown — never shown
                                as closed. */}
                            {!!p.openState && (
                              <Text
                                style={[
                                  styles.openBadge,
                                  p.openState === 'open' ? styles.openNow : styles.closedNow,
                                ]}
                              >
                                {p.openState === 'open' ? 'Open now' : 'Closed now'}
                              </Text>
                            )}
                            <Text style={styles.hours} numberOfLines={1}>{p.openingHours}</Text>
                          </View>
                        )}
                      </View>
                      <Pressable
                        onPress={() => openDirections(p.lat, p.lng)}
                        hitSlop={10}
                        accessibilityRole="button"
                        accessibilityLabel={`Directions to ${p.name ?? 'this place'}`}
                        style={styles.directions}
                      >
                        <Navigation size={14} color={colors.slate500} />
                      </Pressable>
                    </View>
                  ))}
                </ScrollView>
              )}

              {data.truncated && (
                <Text style={styles.footnote}>
                  Showing the nearest {data.pois.length} of {data.total}.
                </Text>
              )}
              {filtered.some((p) => p.walkMinutes != null) && (
                <Text style={styles.footnote}>Walk times are estimates: {data.walkMethod}.</Text>
              )}
            </>
          )}
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { marginTop: spacing.lg },
  heading: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.xs, color: colors.slate500, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: spacing.sm },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  pill: {
    minHeight: 34, justifyContent: 'center', paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: radius.full, borderWidth: 1, borderColor: colors.slate200, backgroundColor: colors.white,
  },
  pillActive: { borderColor: colors.brand600, backgroundColor: colors.brand600 },
  pillText: { fontFamily: fonts.bodySemiBold, fontSize: 11, color: colors.slate600 },
  pillTextActive: { color: colors.white },
  results: { marginTop: spacing.sm + 2 },
  skeleton: { height: 48, backgroundColor: colors.slate100, borderRadius: radius.lg, marginBottom: 6 },
  notice: { backgroundColor: colors.slate50, borderRadius: radius.lg, padding: spacing.md },
  noticeText: { fontFamily: fonts.body, fontSize: 11, lineHeight: 16, color: colors.slate500 },
  retry: { fontFamily: fonts.bodySemiBold, fontSize: 11, color: colors.brand600, marginTop: 6 },
  searchWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderWidth: 1, borderColor: colors.slate200, borderRadius: radius.lg,
    paddingHorizontal: spacing.sm + 2, backgroundColor: colors.white,
  },
  searchInput: { flex: 1, minHeight: 40, fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.slate700, paddingVertical: 8 },
  list: { maxHeight: 280, marginTop: spacing.sm, borderWidth: 1, borderColor: colors.slate100, borderRadius: radius.lg },
  poiRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm + 2,
    borderBottomWidth: 1, borderBottomColor: colors.slate50,
  },
  poiRowLast: { borderBottomWidth: 0 },
  poiBody: { flex: 1, minWidth: 0 },
  poiName: { fontFamily: fonts.bodySemiBold, fontSize: 13, color: colors.slate800 },
  poiBrand: { fontFamily: fonts.body, color: colors.slate500 },
  poiMeta: { fontFamily: fonts.body, fontSize: 11, color: colors.slate500, marginTop: 2 },
  hoursRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  hours: { flex: 1, fontFamily: fonts.body, fontSize: 11, color: colors.slate500 },
  openBadge: {
    fontFamily: fonts.bodySemiBold, fontSize: 11, paddingHorizontal: 4,
    paddingVertical: 1, borderRadius: radius.sm, overflow: 'hidden',
  },
  openNow: { backgroundColor: colors.brand50, color: colors.brand700 },
  closedNow: { backgroundColor: colors.slate100, color: colors.slate500 },
  directions: {
    width: 34, height: 34, borderRadius: radius.md, backgroundColor: colors.slate50,
    alignItems: 'center', justifyContent: 'center',
  },
  footnote: { fontFamily: fonts.body, fontSize: 11, lineHeight: 14, color: colors.slate500, marginTop: 6 },
})
