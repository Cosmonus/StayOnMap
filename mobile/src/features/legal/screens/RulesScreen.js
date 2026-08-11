import { useState } from 'react'
import { View, Text, ScrollView, Pressable, StyleSheet } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import ScreenHeader from '@components/common/ScreenHeader'
import Icon from '@components/common/Icon'
import { PERSONAS, RULES } from '../rules'
import { colors } from '@theme/colors'
import { useLayout, centered } from '@theme/breakpoints'
import { fonts, fontSizes } from '@theme/typography'
import { spacing, radius } from '@theme/spacing'

// Community Rules. Web splits these by persona behind a tab row and so does
// this — an owner reading a tenant's obligations learns nothing, and three
// personas' worth of do/don't lists in one scroll is a wall.
function RuleList({ items, kind }) {
  const isDo = kind === 'do'
  return (
    <View style={[styles.card, isDo ? styles.cardDo : styles.cardDont]}>
      <View style={styles.cardHead}>
        <View style={[styles.badge, isDo ? styles.badgeDo : styles.badgeDont]}>
          <Icon name={isDo ? 'check' : 'close'} size={14} color={colors.white} />
        </View>
        <Text style={styles.cardTitle}>{isDo ? 'Please do' : 'Please don’t'}</Text>
      </View>
      {items.map((text) => (
        <View key={text} style={styles.item}>
          <Text style={[styles.bullet, isDo ? styles.bulletDo : styles.bulletDont]}>•</Text>
          <Text style={styles.itemText}>{text}</Text>
        </View>
      ))}
    </View>
  )
}

export default function RulesScreen({ navigation }) {
  const { contentMaxWidth } = useLayout()
  const [personaId, setPersonaId] = useState(PERSONAS[0].id)
  const persona = PERSONAS.find((p) => p.id === personaId)
  const rules = RULES[personaId]

  return (
    <SafeAreaView style={styles.container} edges={[]}>
      <ScreenHeader
        title="Community rules"
        subtitle="What the Terms mean in practice"
        onBack={() => navigation.goBack()}
      />
      <ScrollView contentContainerStyle={[styles.scroll, centered(contentMaxWidth)]}>
        <View style={styles.tabs}>
          {PERSONAS.map((p) => {
            const active = p.id === personaId
            return (
              <Pressable
                key={p.id}
                style={[styles.tab, active && styles.tabActive]}
                onPress={() => setPersonaId(p.id)}
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
              >
                <Text style={[styles.tabText, active && styles.tabTextActive]}>{p.label}</Text>
              </Pressable>
            )
          })}
        </View>

        <Text style={styles.tagline}>{persona.tagline}</Text>
        <Text style={styles.summary}>{rules.summary}</Text>

        <RuleList items={rules.dos} kind="do" />
        <RuleList items={rules.donts} kind="dont" />

        {/* Brokers only. The zero-tolerance ban is the one rule with no second
            chance, so it is stated as loudly here as in the Terms (§14). */}
        {!!rules.warning && (
          <View style={styles.warning}>
            <Icon name="alertTriangle" size={16} color={colors.danger} />
            <Text style={styles.warningText}>{rules.warning}</Text>
          </View>
        )}
        {!!rules.note && <Text style={styles.note}>{rules.note}</Text>}
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.slate50 },
  scroll: { padding: spacing.md, paddingBottom: spacing.xxl, gap: spacing.sm },
  tabs: { flexDirection: 'row', gap: spacing.xs },
  tab: {
    flex: 1, minHeight: 44, alignItems: 'center', justifyContent: 'center',
    borderRadius: radius.md, borderWidth: 1, borderColor: colors.slate200, backgroundColor: colors.white,
  },
  tabActive: { backgroundColor: colors.slate800, borderColor: colors.slate800 },
  tabText: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.sm, color: colors.slate600 },
  tabTextActive: { color: colors.white },
  tagline: { fontFamily: fonts.displayBold, fontSize: fontSizes.lg, color: colors.slate900, marginTop: spacing.xs },
  summary: { fontFamily: fonts.body, fontSize: fontSizes.sm, lineHeight: 22, color: colors.slate600, marginBottom: spacing.xs },
  card: { borderWidth: 1, borderRadius: radius.lg, padding: spacing.md, gap: spacing.sm },
  cardDo: { backgroundColor: colors.success50, borderColor: '#BBF7D0' },
  cardDont: { backgroundColor: colors.danger50, borderColor: '#FECACA' },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  badge: { width: 28, height: 28, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
  badgeDo: { backgroundColor: '#16A34A' },
  badgeDont: { backgroundColor: colors.danger },
  cardTitle: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.base, color: colors.slate800 },
  item: { flexDirection: 'row', gap: spacing.sm },
  bullet: { fontFamily: fonts.body, fontSize: fontSizes.sm, lineHeight: 22 },
  bulletDo: { color: '#16A34A' },
  bulletDont: { color: colors.danger },
  itemText: { flex: 1, fontFamily: fonts.body, fontSize: fontSizes.sm, lineHeight: 22, color: colors.slate700 },
  warning: {
    flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start',
    backgroundColor: colors.danger50, borderWidth: 1, borderColor: '#FECACA',
    borderRadius: radius.lg, padding: spacing.md,
  },
  warningText: { flex: 1, fontFamily: fonts.bodySemiBold, fontSize: fontSizes.sm, lineHeight: 21, color: colors.danger },
  note: { fontFamily: fonts.body, fontSize: fontSizes.xs, lineHeight: 20, color: colors.slate500 },
})
