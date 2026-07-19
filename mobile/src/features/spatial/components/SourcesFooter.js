import { useState } from 'react'
import { View, Text, Pressable, StyleSheet } from 'react-native'
import { ChevronDown, ChevronUp } from 'lucide-react-native'
import { colors } from '@theme/colors'
import { fonts } from '@theme/typography'
import { spacing } from '@theme/spacing'

// Source + license + fetch date, collapsed by default (the RN stand-in for
// web's <details>). Collapsing is fine HERE because attribution is reference
// material — unlike MissingDataNote, which must never be collapsed.
export default function SourcesFooter({ sources, computedAt }) {
  const [open, setOpen] = useState(false)
  // Web keeps the "Computed <date>" line when there are no sources; mobile used
  // to drop the whole footer, so the same envelope disclosed its freshness on
  // one platform and not the other.
  if (!sources?.length && !computedAt) return null

  return (
    <View style={styles.wrap}>
      <Pressable
        onPress={() => setOpen((o) => !o)}
        hitSlop={10}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel="Sources and freshness"
        style={styles.toggle}
      >
        <Text style={styles.toggleText}>Sources &amp; freshness</Text>
        {open
          ? <ChevronUp size={14} color={colors.slate400} />
          : <ChevronDown size={14} color={colors.slate400} />}
      </Pressable>
      {open && (
        <View style={styles.body}>
          {(sources ?? []).map((s) => (
            <Text key={s.name} style={styles.source}>
              {s.name} ({s.license}){s.fetchedAt ? ` — fetched ${s.fetchedAt}` : ''}
            </Text>
          ))}
          {computedAt && (
            <Text style={styles.source}>Computed {new Date(computedAt).toLocaleDateString()}</Text>
          )}
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { marginTop: spacing.md },
  toggle: { flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 32 },
  toggleText: { fontFamily: fonts.bodyMedium, fontSize: 11, color: colors.slate400 },
  body: { marginTop: 4 },
  source: { fontFamily: fonts.body, fontSize: 10, color: colors.slate400, marginTop: 2 },
})
