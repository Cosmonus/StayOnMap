import { useState } from 'react'
import { View, Text, TextInput, Pressable, FlatList, ActivityIndicator, StyleSheet } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useQuery } from '@tanstack/react-query'
import { supportService } from '@services/support.service'
import { useUiStore } from '@store/uiStore'
import Icon from '@components/common/Icon'
import ScreenHeader from '@components/common/ScreenHeader'
import ErrorState from '@components/common/ErrorState'
import NewCaseSheet from '../components/NewCaseSheet'
import { STATUS_COPY, CATEGORY_LABEL, caseRef } from '../supportCopy'
import { colors } from '@theme/colors'
import { useLayout, centered } from '@theme/breakpoints'
import { fonts, fontSizes } from '@theme/typography'
import { spacing, radius } from '@theme/spacing'

/**
 * Help & Support. The mobile mirror of web's SupportCenter.
 *
 * ONE screen for both hats, following `uiStore.hostMode` like Appointments,
 * Chat and Notifications — a host sees requests about their listings, a renter
 * sees their own. The backend decides which from `hat`; nothing here filters.
 *
 * It replaces a screen that was a list of links and a mailto: it could point
 * somebody at the right page but could not TAKE a request, so anything it did
 * not cover left the product entirely.
 */

const TONE = {
  muted: colors.slate500,
  brand: colors.brand600,
  attention: '#b45309',
  good: '#15803D',
}

function CaseRow({ item, onOpen }) {
  const copy = STATUS_COPY[item.status] ?? { label: item.status, tone: 'muted' }
  const unread = item._count?.messages ?? 0

  return (
    <Pressable style={styles.card} onPress={() => onOpen(item)} accessibilityRole="button">
      <View style={styles.cardTop}>
        <Text style={styles.ref}>{caseRef(item.number)}</Text>
        <Text style={styles.type}>{CATEGORY_LABEL[item.type] ?? item.type}</Text>
        {unread > 0 && (
          <View style={styles.badge}><Text style={styles.badgeText}>New reply</Text></View>
        )}
      </View>
      <Text style={styles.subject} numberOfLines={2}>{item.subject}</Text>
      <Text style={[styles.status, { color: TONE[copy.tone] ?? colors.slate500 }]}>{copy.label}</Text>
    </Pressable>
  )
}

export default function SupportCenterScreen({ navigation }) {
  const { contentMaxWidth } = useLayout()
  const hostMode = useUiStore((s) => s.hostMode)
  const hat = hostMode ? 'OWNER' : 'TENANT'
  const [composing, setComposing] = useState(false)
  const [query, setQuery] = useState('')

  const { data: cases, isLoading, isError, refetch, isRefetching } = useQuery({
    queryKey: ['support-cases', hat],
    queryFn: () => supportService.listCases(hat).then((r) => r.data),
  })

  const { data: help } = useQuery({
    queryKey: ['support-articles', hat, query],
    queryFn: () => supportService.articles({ hat, search: query || undefined }).then((r) => r.data),
  })

  const articles = (help?.articles ?? []).slice(0, 5)

  const header = (
    <View>
      <Text style={styles.intro}>
        {hostMode
          ? 'Questions about your listings, and anything raised about them.'
          : 'A real person reads every message. Usually the same day.'}
      </Text>

      {/* Help first — the cheapest support request is the one nobody needed
          to send. Search covers titles and bodies, so "deposit" finds the
          lease article even though the word is not in its title. */}
      <TextInput
        value={query}
        onChangeText={setQuery}
        placeholder="Search help — deposits, visits, reporting…"
        placeholderTextColor={colors.slate500}
        style={styles.search}
        accessibilityLabel="Search help articles"
      />

      {articles.map((a) => (
        <Pressable
          key={a.id}
          style={styles.article}
          onPress={() => navigation.navigate('SupportArticle', { article: a })}
          accessibilityRole="button"
        >
          <Text style={styles.articleTitle}>{a.title}</Text>
          <Icon name="chevronRight" size={16} color={colors.slate500} />
        </Pressable>
      ))}
      {query.length > 0 && articles.length === 0 && (
        <Text style={styles.empty}>Nothing in the help centre matches that. Open a request and ask us.</Text>
      )}

      <Text style={styles.sectionTitle}>{hostMode ? 'Requests and reports' : 'Your requests'}</Text>
    </View>
  )

  if (isError) {
    return (
      <SafeAreaView style={styles.container} edges={[]}>
        <ScreenHeader title="Help & support" onBack={() => navigation.goBack()} />
        <ErrorState title="Couldn't load your requests" onRetry={refetch} />
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.container} edges={[]}>
      <ScreenHeader
        title="Help & support"
        onBack={() => navigation.goBack()}
        right={(
          <Pressable onPress={() => setComposing(true)} hitSlop={8} accessibilityRole="button" accessibilityLabel="New support request">
            <Text style={styles.newText}>New</Text>
          </Pressable>
        )}
      />

      {isLoading ? (
        <ActivityIndicator color={colors.brand600} style={{ marginTop: spacing.xl }} />
      ) : (
        <FlatList
          data={cases ?? []}
          keyExtractor={(c) => c.id}
          contentContainerStyle={[styles.list, centered(contentMaxWidth)]}
          ListHeaderComponent={header}
          refreshing={isRefetching}
          onRefresh={refetch}
          renderItem={({ item }) => (
            <CaseRow item={item} onOpen={(c) => navigation.navigate('SupportCase', { caseId: c.id })} />
          )}
          ListEmptyComponent={(
            <View style={styles.emptyBox}>
              <Icon name="lifeBuoy" size={26} color={colors.brand600} />
              <Text style={styles.emptyTitle}>Nothing open</Text>
              <Text style={styles.empty}>
                {hostMode
                  ? 'Requests you send us, and anything raised about your listings, appear here.'
                  : 'If something is wrong or you are unsure about a listing, tell us and we will look.'}
              </Text>
            </View>
          )}
        />
      )}

      <NewCaseSheet
        visible={composing}
        hat={hat}
        onClose={() => setComposing(false)}
        onCreated={(id) => { setComposing(false); navigation.navigate('SupportCase', { caseId: id }) }}
      />
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.slate50 },
  list: { padding: spacing.md, paddingBottom: spacing.xxl },
  intro: { fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.slate600, lineHeight: 20, marginBottom: spacing.md },
  search: {
    fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.slate800,
    backgroundColor: colors.white, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.slate200,
    borderRadius: radius.md, paddingHorizontal: spacing.sm, minHeight: 48, marginBottom: spacing.sm,
  },
  article: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 48,
    backgroundColor: colors.white, borderRadius: radius.md, paddingHorizontal: spacing.md,
    borderWidth: StyleSheet.hairlineWidth, borderColor: colors.slate100, marginBottom: spacing.xs,
  },
  articleTitle: { flex: 1, fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.slate800 },
  sectionTitle: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.sm, color: colors.slate800, marginTop: spacing.lg, marginBottom: spacing.sm },
  card: {
    backgroundColor: colors.white, borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.sm,
    borderWidth: StyleSheet.hairlineWidth, borderColor: colors.slate100,
  },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' },
  ref: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.xs, color: colors.slate500 },
  type: { fontFamily: fonts.body, fontSize: fontSizes.xs, color: colors.slate500 },
  badge: { backgroundColor: colors.brand50, borderRadius: radius.sm, paddingHorizontal: spacing.xs, paddingVertical: 2 },
  badgeText: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.xs, color: colors.brand600 },
  subject: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.sm, color: colors.slate800, marginTop: spacing.xs },
  status: { fontFamily: fonts.body, fontSize: fontSizes.xs, marginTop: 2 },
  newText: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.sm, color: colors.brand600 },
  emptyBox: { alignItems: 'center', paddingVertical: spacing.xl, gap: spacing.sm },
  emptyTitle: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.sm, color: colors.slate800 },
  empty: { fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.slate500, textAlign: 'center', lineHeight: 20 },
})
