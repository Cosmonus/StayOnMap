import { useState } from 'react'
import { View, Text, Pressable, StyleSheet } from 'react-native'
import { colors } from '@theme/colors'
import { tapBox } from '@theme/touchTargets'
import { fonts, fontSizes } from '@theme/typography'
import { spacing, radius } from '@theme/spacing'

function daysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate()
}

const CELL_WIDTH = `${100 / 7}%`

export default function AvailabilityCalendar({ blockedDates, onChange }) {
  const [cursor, setCursor] = useState(() => {
    const d = new Date()
    return { year: d.getFullYear(), month: d.getMonth() }
  })

  const total = daysInMonth(cursor.year, cursor.month)
  const firstWeekday = new Date(cursor.year, cursor.month, 1).getDay()
  const cells = Array.from({ length: firstWeekday }, () => null).concat(
    Array.from({ length: total }, (_, i) => i + 1)
  )

  function keyFor(day) {
    return `${cursor.year}-${String(cursor.month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
  }

  function toggle(day) {
    const key = keyFor(day)
    onChange(blockedDates.includes(key) ? blockedDates.filter((d) => d !== key) : [...blockedDates, key])
  }

  const monthLabel = new Date(cursor.year, cursor.month, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Availability calendar</Text>
      <View style={styles.card}>
        <View style={styles.monthNav}>
          <Pressable
            style={tapBox}
            onPress={() => setCursor((c) => (c.month === 0 ? { year: c.year - 1, month: 11 } : { ...c, month: c.month - 1 }))}
            accessibilityRole="button"
            accessibilityLabel="Previous month"
          >
            <Text style={styles.navArrow}>‹</Text>
          </Pressable>
          <Text style={styles.monthLabel}>{monthLabel}</Text>
          <Pressable
            style={tapBox}
            onPress={() => setCursor((c) => (c.month === 11 ? { year: c.year + 1, month: 0 } : { ...c, month: c.month + 1 }))}
            accessibilityRole="button"
            accessibilityLabel="Next month"
          >
            <Text style={styles.navArrow}>›</Text>
          </Pressable>
        </View>
        <View style={styles.weekRow}>
          {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
            <Text key={i} style={styles.weekday}>{d}</Text>
          ))}
        </View>
        <View style={styles.grid}>
          {cells.map((day, i) => {
            if (!day) return <View key={i} style={styles.cell} />
            const blocked = blockedDates.includes(keyFor(day))
            return (
              <Pressable
                key={i}
                style={styles.cell}
                onPress={() => toggle(day)}
                accessibilityRole="checkbox"
                accessibilityLabel={`Block ${day} ${monthLabel}`}
                accessibilityState={{ checked: blocked }}
              >
                <Text style={[styles.dayText, blocked && styles.dayTextBlocked]}>{day}</Text>
              </Pressable>
            )
          })}
        </View>
      </View>
      <Text style={styles.hint}>Tap a date to block it. Strikethrough = blocked for guests.</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { marginTop: spacing.lg },
  title: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.sm, color: colors.slate800, marginBottom: spacing.sm },
  card: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.slate200, borderRadius: radius.lg, padding: spacing.md },
  monthNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm },
  navArrow: { fontSize: fontSizes.lg, color: colors.slate500, paddingHorizontal: spacing.sm },
  monthLabel: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.sm, color: colors.slate800 },
  weekRow: { flexDirection: 'row' },
  weekday: { width: CELL_WIDTH, textAlign: 'center', fontFamily: fonts.bodySemiBold, fontSize: 11, color: colors.slate500, paddingVertical: 4 },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: CELL_WIDTH, aspectRatio: 1, alignItems: 'center', justifyContent: 'center' },
  dayText: { fontFamily: fonts.body, fontSize: fontSizes.xs, color: colors.slate700 },
  dayTextBlocked: { color: colors.slate500, textDecorationLine: 'line-through' },
  hint: { fontFamily: fonts.body, fontSize: 11, color: colors.slate500, marginTop: spacing.sm },
})
