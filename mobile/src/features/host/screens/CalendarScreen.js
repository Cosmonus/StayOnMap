import { useState } from 'react'
import { View, Text, Pressable, ScrollView, ActivityIndicator, StyleSheet } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useQuery } from '@tanstack/react-query'
import { appointmentService } from '@services/appointment.service'
import { leaseService } from '@services/lease.service'
import Icon from '@components/common/Icon'
import { colors } from '@theme/colors'
import { fonts, fontSizes } from '@theme/typography'
import { spacing, radius } from '@theme/spacing'

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']
const DOT_COLOR = { appointment: '#FBBF24', 'lease-start': '#4ADE80', 'lease-end': colors.slate400 }

function daysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate()
}

function dateKey(d) {
  const dt = new Date(d)
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`
}

export default function CalendarScreen() {
  const [cursor, setCursor] = useState(() => {
    const d = new Date()
    return { year: d.getFullYear(), month: d.getMonth() }
  })

  const { data: appointments = [], isLoading: loadingAppts } = useQuery({
    queryKey: ['owner-appointments'],
    queryFn: () => appointmentService.owner().then((r) => r.data),
  })

  const { data: leaseData, isLoading: loadingLeases } = useQuery({
    queryKey: ['leases'],
    queryFn: () => leaseService.getMyLeases().then((r) => r.data),
  })
  const leases = leaseData?.asOwner ?? []

  const events = new Map()
  function addEvent(rawDate, entry) {
    if (!rawDate) return
    const key = dateKey(rawDate)
    if (!events.has(key)) events.set(key, [])
    events.get(key).push(entry)
  }
  appointments.forEach((a) => addEvent(a.requestedDate, { type: 'appointment', label: a.property?.title ?? 'Visit' }))
  leases.forEach((l) => {
    addEvent(l.startDate, { type: 'lease-start', label: l.property?.title ?? 'Lease starts' })
    addEvent(l.endDate, { type: 'lease-end', label: l.property?.title ?? 'Lease ends' })
  })

  const total = daysInMonth(cursor.year, cursor.month)
  const firstWeekday = new Date(cursor.year, cursor.month, 1).getDay()
  const cells = Array.from({ length: firstWeekday }, () => null).concat(
    Array.from({ length: total }, (_, i) => i + 1)
  )
  const monthLabel = new Date(cursor.year, cursor.month, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  const isLoading = loadingAppts || loadingLeases

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Calendar</Text>
        <Text style={styles.subtitle}>Upcoming appointments and lease dates</Text>

        {isLoading ? (
          <ActivityIndicator color={colors.brand600} style={{ marginTop: spacing.xl }} />
        ) : (
          <>
            <View style={styles.monthNav}>
              <Pressable
                hitSlop={8}
                onPress={() => setCursor((c) => (c.month === 0 ? { year: c.year - 1, month: 11 } : { ...c, month: c.month - 1 }))}
              >
                <Icon name="chevronLeft" size={18} color={colors.slate500} />
              </Pressable>
              <Text style={styles.monthLabel}>{monthLabel}</Text>
              <Pressable
                hitSlop={8}
                onPress={() => setCursor((c) => (c.month === 11 ? { year: c.year + 1, month: 0 } : { ...c, month: c.month + 1 }))}
              >
                <Icon name="chevronRight" size={18} color={colors.slate500} />
              </Pressable>
            </View>

            <View style={styles.weekRow}>
              {WEEKDAYS.map((d, i) => (
                <Text key={i} style={styles.weekday}>{d}</Text>
              ))}
            </View>

            <View style={styles.grid}>
              {cells.map((day, i) => {
                if (!day) return <View key={i} style={styles.cell} />
                const key = `${cursor.year}-${String(cursor.month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
                const dayEvents = events.get(key) ?? []
                return (
                  <View key={i} style={styles.cell}>
                    <Text style={styles.dayNumber}>{day}</Text>
                    {dayEvents.length > 0 && (
                      <View style={styles.dotRow}>
                        {dayEvents.slice(0, 3).map((e, idx) => (
                          <View key={idx} style={[styles.dot, { backgroundColor: DOT_COLOR[e.type] }]} />
                        ))}
                      </View>
                    )}
                  </View>
                )
              })}
            </View>

            <View style={styles.legend}>
              <View style={styles.legendItem}>
                <View style={[styles.dot, { backgroundColor: DOT_COLOR.appointment }]} />
                <Text style={styles.legendText}>Appointment</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.dot, { backgroundColor: DOT_COLOR['lease-start'] }]} />
                <Text style={styles.legendText}>Lease starts</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.dot, { backgroundColor: DOT_COLOR['lease-end'] }]} />
                <Text style={styles.legendText}>Lease ends</Text>
              </View>
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

const CELL_WIDTH = `${100 / 7}%`

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.white },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl },
  title: { fontFamily: fonts.displayBold, fontSize: fontSizes.xl, color: colors.slate800 },
  subtitle: { fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.slate400, marginTop: 2, marginBottom: spacing.lg },
  monthNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.md },
  monthLabel: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.base, color: colors.slate800 },
  weekRow: { flexDirection: 'row' },
  weekday: { width: CELL_WIDTH, textAlign: 'center', fontFamily: fonts.bodySemiBold, fontSize: fontSizes.xs, color: colors.slate400, paddingVertical: spacing.xs },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: CELL_WIDTH, aspectRatio: 1, alignItems: 'center', justifyContent: 'center', gap: 2 },
  dayNumber: { fontFamily: fonts.body, fontSize: fontSizes.xs, color: colors.slate700 },
  dotRow: { flexDirection: 'row', gap: 2 },
  dot: { width: 5, height: 5, borderRadius: 3 },
  legend: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.lg, flexWrap: 'wrap' },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendText: { fontFamily: fonts.body, fontSize: fontSizes.xs, color: colors.slate500 },
})
