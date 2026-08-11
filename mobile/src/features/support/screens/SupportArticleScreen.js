import { Text, ScrollView, StyleSheet } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import ScreenHeader from '@components/common/ScreenHeader'
import { colors } from '@theme/colors'
import { useLayout, centered } from '@theme/breakpoints'
import { fonts, fontSizes } from '@theme/typography'
import { spacing } from '@theme/spacing'

/**
 * One help article.
 *
 * The article is passed through navigation params rather than re-fetched by
 * slug: the list already has the full body, and a second request would put a
 * spinner in front of text the phone is holding.
 *
 * Rendered as plain text. The bodies carry light markdown-ish emphasis and
 * nothing else — no links, no images — so a markdown parser would be a
 * dependency and an escaping surface for content that needs neither.
 */
export default function SupportArticleScreen({ navigation, route }) {
  const { contentMaxWidth } = useLayout()
  const article = route.params?.article

  return (
    <SafeAreaView style={styles.container} edges={[]}>
      <ScreenHeader
        title={article?.category?.title ?? 'Help'}
        onBack={() => navigation.goBack()}
      />
      <ScrollView contentContainerStyle={[styles.content, centered(contentMaxWidth)]}>
        <Text style={styles.title}>{article?.title}</Text>
        <Text style={styles.body}>{article?.body}</Text>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.white },
  content: { padding: spacing.md, paddingBottom: spacing.xxl },
  title: { fontFamily: fonts.display, fontSize: fontSizes.xl, color: colors.slate800, marginBottom: spacing.md, lineHeight: 28 },
  body: { fontFamily: fonts.body, fontSize: fontSizes.base, color: colors.slate600, lineHeight: 26 },
})
