// Single-date picker bottom sheet — follows the onboarding
// AvailabilityCalendar's month-grid pattern, but selects ONE date (an ISO
// yyyy-mm-dd string, wire-compatible with web's native date input) instead
// of toggling blocked dates.
import { useState } from 'react'
import { View, Text, Modal, Pressable, StyleSheet } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useResetOnOpen } from '@/hooks/useResetOnOpen'
import Icon from '@components/common/Icon'
import { colors } from '@theme/colors'
import { tapBox } from '@theme/touchTargets'
import { shadows } from '@theme/shadows'
import { fonts, fontSizes } from '@theme/typography'
import { spacing, radius } from '@theme/spacing'

function daysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate()
}

const CELL_WIDTH = `${100 / 7}%`

export default function DatePickerSheet({ visible, title, value, onSelect, onClose }) {
  const [cursor, setCursor] = useState(() => {
    const d = new Date()
    return { year: d.getFullYear(), month: d.getMonth() }
  })

  // Re-seed the cursor to the selected date's month (or today) each open
  useResetOnOpen(visible, () => {
    const d = value ? new Date(`${value}T00:00:00`) : new Date()
    const seed = Number.isNaN(d.getTime()) ? new Date() : d
    setCursor({ year: seed.getFullYear(), month: seed.getMonth() })
  })

  const total = daysInMonth(cursor.year, cursor.month)
  const firstWeekday = new Date(cursor.year, cursor.month, 1).getDay()
  const cells = Array.from({ length: firstWeekday }, () => null).concat(
    Array.from({ length: total }, (_, i) => i + 1)
  )

  function keyFor(day) {
    return `${cursor.year}-${String(cursor.month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
  }

  function pick(day) {
    onSelect(keyFor(day))
    onClose()
  }

  function clear() {
    onSelect('')
    onClose()
  }

  const monthLabel = new Date(cursor.year, cursor.month, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <View style={styles.handle} />
          <View style={styles.header}>
            <Text style={styles.heading}>{title || 'Pick a date'}</Text>
            <Pressable onPress={onClose} hitSlop={14} accessibilityRole="button" accessibilityLabel="Close date picker">
              <Icon name="close" size={20} color={colors.slate500} />
            </Pressable>
          </View>

          <View style={styles.monthNav}>
            <Pressable
              hitSlop={14}
              onPress={() => setCursor((c) => (c.month === 0 ? { year: c.year - 1, month: 11 } : { ...c, month: c.month - 1 }))}
              accessibilityRole="button"
              accessibilityLabel="Previous month"
            >
              <Icon name="chevronLeft" size={20} color={colors.slate500} />
            </Pressable>
            <Text style={styles.monthLabel}>{monthLabel}</Text>
            <Pressable
              hitSlop={14}
              onPress={() => setCursor((c) => (c.month === 11 ? { year: c.year + 1, month: 0 } : { ...c, month: c.month + 1 }))}
              accessibilityRole="button"
              accessibilityLabel="Next month"
            >
              <Icon name="chevronRight" size={20} color={colors.slate500} />
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
              const selected = value === keyFor(day)
              return (
                <Pressable
                  key={i}
                  style={styles.cell}
                  onPress={() => pick(day)}
                  accessibilityRole="button"
                  accessibilityLabel={`${day} ${monthLabel}`}
                  accessibilityState={{ selected }}
                >
                  <View style={[styles.dayCircle, selected && styles.dayCircleSelected]}>
                    <Text style={[styles.dayText, selected && styles.dayTextSelected]}>{day}</Text>
                  </View>
                </Pressable>
              )
            })}
          </View>

          <View style={styles.footer}>
            <Pressable
              onPress={clear}
              disabled={!value}
              style={tapBox}
              accessibilityRole="button"
              accessibilityLabel="Clear date"
              accessibilityState={{ disabled: !value }}
            >
              <Text style={[styles.clearText, !value && styles.clearDisabled]}>Clear date</Text>
            </Pressable>
          </View>
          <SafeAreaView edges={['bottom']} />
        </Pressable>
      </Pressable>
    </Modal>
  )
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.white, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl,
    paddingHorizontal: spacing.lg, maxHeight: '90%',
    ...shadows.sheet,
  },
  handle: { alignSelf: 'center', width: 40, height: 5, borderRadius: 3, backgroundColor: colors.slate200, marginTop: spacing.sm + 2 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: spacing.md - 2 },
  heading: { fontFamily: fonts.displayBold, fontSize: fontSizes.lg, color: colors.slate800 },
  monthNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm },
  monthLabel: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.sm, color: colors.slate800 },
  weekRow: { flexDirection: 'row' },
  weekday: { width: CELL_WIDTH, textAlign: 'center', fontFamily: fonts.bodySemiBold, fontSize: 11, color: colors.slate500, paddingVertical: 4 },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: CELL_WIDTH, aspectRatio: 1, alignItems: 'center', justifyContent: 'center' },
  dayCircle: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  dayCircleSelected: { backgroundColor: colors.slate800 },
  dayText: { fontFamily: fonts.body, fontSize: fontSizes.xs, color: colors.slate700 },
  dayTextSelected: { color: colors.white, fontFamily: fonts.bodySemiBold },
  footer: {
    flexDirection: 'row', justifyContent: 'center',
    paddingVertical: spacing.md - 4, borderTopWidth: 1, borderTopColor: colors.slate100, marginTop: spacing.sm,
  },
  clearText: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.sm, color: colors.slate600, textDecorationLine: 'underline', paddingVertical: spacing.sm },
  clearDisabled: { color: colors.slate200, textDecorationLine: 'none' },
})
