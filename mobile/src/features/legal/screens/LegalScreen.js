import { View, Text, ScrollView, Pressable, Linking, StyleSheet } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import ScreenHeader from '@components/common/ScreenHeader'
import { LEGAL_DOCS, LAST_UPDATED } from '../content'
import { colors } from '@theme/colors'
import { fonts, fontSizes } from '@theme/typography'
import { spacing, radius } from '@theme/spacing'

// One screen, both documents — they have the same shape, so two screens would
// be two places to fix a rendering bug. `route.params.doc` picks which.
//
// Renders in-app rather than opening stayonmap.com in a browser: a policy you
// have to leave the app to read is one nobody reads, and on a phone with no
// signal it was simply unavailable.
function Block({ block }) {
  if (block.ul) {
    return (
      <View style={styles.list}>
        {block.ul.map((item, i) => (
          <View key={i} style={styles.listItem}>
            <Text style={styles.bullet}>•</Text>
            <Text style={styles.body}>
              {typeof item === 'string' ? item : <><Text style={styles.strong}>{item.lead}</Text> {item.text}</>}
            </Text>
          </View>
        ))}
      </View>
    )
  }

  if (block.email) {
    return (
      <Pressable
        onPress={() => Linking.openURL(`mailto:${block.email}`)}
        style={styles.emailRow}
        accessibilityRole="link"
        accessibilityLabel={`Email ${block.email}`}
      >
        <Text style={styles.email}>{block.email}</Text>
      </Pressable>
    )
  }

  if (block.note) return <Text style={styles.note}>{block.note}</Text>

  return (
    <Text style={styles.body}>
      {block.lead ? <Text style={styles.strong}>{block.lead} </Text> : null}
      {block.p}
    </Text>
  )
}

export default function LegalScreen({ navigation, route }) {
  const doc = LEGAL_DOCS[route.params?.doc] ?? LEGAL_DOCS.privacy

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <ScreenHeader
        title={doc.title}
        subtitle={`Last updated ${LAST_UPDATED}`}
        onBack={() => navigation.goBack()}
      />
      <ScrollView contentContainerStyle={styles.scroll}>
        {doc.sections.map((section) => (
          <View key={section.title} style={styles.section}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            {section.blocks.map((block, i) => <Block key={i} block={block} />)}
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.slate50 },
  scroll: { padding: spacing.md, paddingBottom: spacing.xxl, gap: spacing.sm },
  section: {
    backgroundColor: colors.white,
    borderWidth: 1, borderColor: colors.slate200, borderRadius: radius.lg,
    padding: spacing.md,
    gap: spacing.sm,
  },
  sectionTitle: { fontFamily: fonts.displayBold, fontSize: fontSizes.base, color: colors.slate900 },
  // 22 line-height on 14px body: this is the longest prose in the app and the
  // only screen someone reads top to bottom rather than scans.
  body: { fontFamily: fonts.body, fontSize: fontSizes.sm, lineHeight: 22, color: colors.slate700 },
  strong: { fontFamily: fonts.bodySemiBold, color: colors.slate900 },
  list: { gap: spacing.xs },
  listItem: { flexDirection: 'row', gap: spacing.sm },
  bullet: { fontFamily: fonts.body, fontSize: fontSizes.sm, lineHeight: 22, color: colors.slate500 },
  emailRow: { minHeight: 44, justifyContent: 'center' },
  email: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.sm, color: colors.brand700 },
  note: { fontFamily: fonts.body, fontSize: fontSizes.xs, color: colors.slate500 },
})
