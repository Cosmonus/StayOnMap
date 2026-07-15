import { View, Text, StyleSheet } from 'react-native'
import { useMapStore } from '@store/mapStore'
import { colors } from '@theme/colors'
import { shadows } from '@theme/shadows'
import { fonts } from '@theme/typography'
import { spacing, radius } from '@theme/spacing'

// Mirrors web's MapLegend.jsx entries (minus floodZones — no mobile toggle).
const ENTRIES = {
  metro: [
    { swatch: 'line', color: '#7C3AED', label: 'Metro line' },
    { swatch: 'dot', color: colors.white, border: '#7C3AED', label: 'Station' },
  ],
  itCorridors: [
    { swatch: 'circle', color: '#2563EB', label: 'Major IT zone' },
    { swatch: 'circle', color: '#60A5FA', label: 'IT zone' },
  ],
  traffic: [
    { swatch: 'line', color: '#22C55E', label: 'Light' },
    { swatch: 'line', color: '#F59E0B', label: 'Moderate' },
    { swatch: 'line', color: '#EF4444', label: 'Heavy' },
  ],
}

function Swatch({ swatch, color, border }) {
  if (swatch === 'line') return <View style={[styles.line, { backgroundColor: color }]} />
  if (swatch === 'dot') return <View style={[styles.dot, { backgroundColor: color, borderColor: border ?? color }]} />
  return <View style={[styles.circle, { backgroundColor: `${color}66`, borderColor: color }]} />
}

export default function MapLegend() {
  const activeLayers = useMapStore((s) => s.activeLayers)

  const active = Object.keys(activeLayers).filter((key) => activeLayers[key] && ENTRIES[key])
  if (active.length === 0) return null

  return (
    <View style={styles.container} pointerEvents="none">
      {active.map((key) =>
        ENTRIES[key].map((entry) => (
          <View key={`${key}-${entry.label}`} style={styles.entry}>
            <Swatch swatch={entry.swatch} color={entry.color} border={entry.border} />
            <Text style={styles.label}>{entry.label}</Text>
          </View>
        ))
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', alignSelf: 'flex-start',
    columnGap: spacing.sm + 4, rowGap: spacing.xs,
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderWidth: 1, borderColor: colors.slate200, borderRadius: radius.md,
    paddingHorizontal: spacing.sm + 2, paddingVertical: spacing.xs + 2,
    marginTop: spacing.xs, marginHorizontal: spacing.md, maxWidth: '92%',
    ...shadows.md,
  },
  entry: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  label: { fontFamily: fonts.bodyMedium, fontSize: 11, color: colors.slate600 },
  line: { width: 18, height: 3, borderRadius: 2 },
  dot: { width: 9, height: 9, borderRadius: 5, borderWidth: 2 },
  circle: { width: 12, height: 12, borderRadius: 6, borderWidth: 1.5 },
})
