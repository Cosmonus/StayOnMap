import { useState } from 'react'
import { View, Text, Pressable, ScrollView, ActivityIndicator, Modal, StyleSheet } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useQuery } from '@tanstack/react-query'
import { appointmentService } from '@services/appointment.service'
import { leaseService } from '@services/lease.service'
import Icon from '@components/common/Icon'
import ErrorState from '@components/common/ErrorState'
import ScreenHeader from '@components/common/ScreenHeader'
import { colors } from '@theme/colors'
import { shadows } from '@theme/shadows'
import { fonts, fontSizes } from '@theme/typography'
import { spacing, radius } from '@theme/spacing'
import { formatRent } from '@utils/format'
import { formatTime } from '@utils/time'

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']
// Amber = someone waiting on you, jade = money starts arriving, indigo = the
// tenancy colour the OCCUPIED banner already uses, here marking its end.
// The old set (#FBBF24 / #4ADE80 / slate400) was two washed-out pastels and a
// grey that vanished against the canvas.
const DOT_COLOR = { appointment: '#F59E0B', 'lease-start': colors.brand600, 'lease-end': '#6366F1' }
const EVENT_TYPE_LABEL = { appointment: 'Visit request', 'lease-start': 'Lease starts', 'lease-end': 'Lease ends' }

// Both endpoints return EVERY status — `getOwnerAppointments` and `GET /leases`
// filter by nothing. Plotting all of them puts dates on the calendar that are
// never going to happen: a visit the host already rejected, or a lease offer
// the renter turned down, sat there looking exactly like a live booking.
const LIVE_APPOINTMENT = new Set(['PENDING', 'ACCEPTED', 'RESCHEDULED'])
// OFFERED/ACTIVE are ahead of you and EXPIRED ran its course, so its dates are
// accurate history. REJECTED never became a tenancy at all, and a TERMINATED
// one ended on `terminatedAt` — the `endDate` still on the row is the date it
// was *going* to end, which is the one date it definitely did not.
const LIVE_LEASE = new Set(['OFFERED', 'ACTIVE', 'EXPIRED'])

function daysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate()
}

function dateKey(d) {
  const dt = new Date(d)
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`
}

export default function CalendarScreen({ navigation }) {
  const [cursor, setCursor] = useState(() => {
    const d = new Date()
    return { year: d.getFullYear(), month: d.getMonth() }
  })
  const [selectedKey, setSelectedKey] = useState(null)

  const {
    data: appointments = [], isLoading: loadingAppts, isError: apptFailed, refetch: refetchAppts,
  } = useQuery({
    queryKey: ['owner-appointments'],
    queryFn: () => appointmentService.owner().then((r) => r.data),
  })

  const {
    data: leaseData, isLoading: loadingLeases, isError: leasesFailed, refetch: refetchLeases,
  } = useQuery({
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
  appointments.filter((a) => LIVE_APPOINTMENT.has(a.status)).forEach((a) => addEvent(a.requestedDate, {
    type: 'appointment',
    label: a.property?.title ?? 'Visit',
    person: a.tenant?.name,
    detail: formatTime(a.requestedTime),
  }))
  leases.filter((l) => LIVE_LEASE.has(l.status)).forEach((l) => {
    addEvent(l.startDate, { type: 'lease-start', label: l.property?.title ?? 'Lease starts', person: l.tenant?.name, detail: formatRent(l.rentAmount) })
    addEvent(l.endDate, { type: 'lease-end', label: l.property?.title ?? 'Lease ends', person: l.tenant?.name, detail: formatRent(l.rentAmount) })
  })

  const total = daysInMonth(cursor.year, cursor.month)
  const firstWeekday = new Date(cursor.year, cursor.month, 1).getDay()
  const cells = Array.from({ length: firstWeekday }, () => null).concat(
    Array.from({ length: total }, (_, i) => i + 1)
  )
  // Pad out to whole weeks, then render one row per week. The grid used to be a
  // single `flexWrap` run of cells each `width: '14.285714285714286%'`, which
  // asks Yoga to fit seven rounded percentages into one row: overflow by a
  // fraction of a pixel and the seventh cell wraps, so the days marched one
  // column left down the month while the weekday header — a non-wrapping row —
  // stayed put. Fixed rows of `flex: 1` cells cannot drift.
  while (cells.length % 7) cells.push(null)
  const weeks = Array.from({ length: cells.length / 7 }, (_, w) => cells.slice(w * 7, w * 7 + 7))
  const monthLabel = new Date(cursor.year, cursor.month, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  const todayKey = dateKey(new Date())
  const isLoading = loadingAppts || loadingLeases
  const failed = apptFailed || leasesFailed

  const selectedEvents = selectedKey ? (events.get(selectedKey) ?? []) : []
  const selectedLabel = selectedKey
    ? new Date(`${selectedKey}T00:00:00`).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
    : ''

  return (
    <SafeAreaView style={styles.container} edges={[]}>
      <ScreenHeader
        title="Calendar"
        subtitle="Upcoming appointments and lease dates"
        onBack={() => navigation.goBack()}
      />
      <ScrollView contentContainerStyle={styles.content}>

        {/* A real failure branch (AGENTS.md §10). Both queries default to an
            empty list, so a dropped connection or an expired session used to
            render a normal-looking month with no bookings in it — the host
            cannot tell "nothing scheduled" from "we never loaded it". */}
        {failed ? (
          <ErrorState
            title="Couldn't load your calendar"
            onRetry={() => { refetchAppts(); refetchLeases() }}
          />
        ) : isLoading ? (
          <ActivityIndicator color={colors.brand600} style={{ marginTop: spacing.xl }} />
        ) : (
          <View style={styles.card}>
            <View style={styles.monthNav}>
              <Pressable
                style={styles.monthButton}
                onPress={() => setCursor((c) => (c.month === 0 ? { year: c.year - 1, month: 11 } : { ...c, month: c.month - 1 }))}
                accessibilityRole="button"
                accessibilityLabel="Previous month"
              >
                <Icon name="chevronLeft" size={18} color={colors.slate700} />
              </Pressable>
              <Text style={styles.monthLabel}>{monthLabel}</Text>
              <Pressable
                style={styles.monthButton}
                onPress={() => setCursor((c) => (c.month === 11 ? { year: c.year + 1, month: 0 } : { ...c, month: c.month + 1 }))}
                accessibilityRole="button"
                accessibilityLabel="Next month"
              >
                <Icon name="chevronRight" size={18} color={colors.slate700} />
              </Pressable>
            </View>

            <View style={styles.weekRow}>
              {WEEKDAYS.map((d, i) => (
                <Text key={i} style={styles.weekday}>{d}</Text>
              ))}
            </View>

            {weeks.map((week, w) => (
              <View key={w} style={styles.gridRow}>
                {week.map((day, i) => {
                  if (!day) return <View key={i} style={styles.cell} />
                  const key = `${cursor.year}-${String(cursor.month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
                  const dayEvents = events.get(key) ?? []
                  const isToday = key === todayKey
                  return (
                    <Pressable
                      key={i}
                      style={styles.cell}
                      onPress={() => setSelectedKey(key)}
                      accessibilityRole="button"
                      accessibilityLabel={`${key}${isToday ? ', today' : ''}${dayEvents.length ? `, ${dayEvents.length} booking${dayEvents.length > 1 ? 's' : ''}` : ''}`}
                    >
                      {/* Today is the one date a calendar must answer without
                          being asked — the filled disc marks it. */}
                      <View style={[styles.dayDisc, isToday && styles.dayDiscToday]}>
                        <Text style={[styles.dayNumber, dayEvents.length > 0 && styles.dayNumberBusy, isToday && styles.dayNumberToday]}>
                          {day}
                        </Text>
                      </View>
                      <View style={styles.dotRow}>
                        {dayEvents.slice(0, 3).map((e, idx) => (
                          <View key={idx} style={[styles.dot, { backgroundColor: DOT_COLOR[e.type] }]} />
                        ))}
                      </View>
                    </Pressable>
                  )
                })}
              </View>
            ))}

            <View style={styles.legend}>
              {[['appointment', 'Visit request'], ['lease-start', 'Lease starts'], ['lease-end', 'Lease ends']].map(([type, label]) => (
                <View key={type} style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: DOT_COLOR[type] }]} />
                  <Text style={styles.legendText}>{label}</Text>
                </View>
              ))}
            </View>
          </View>
        )}
      </ScrollView>

      <Modal visible={!!selectedKey} animationType="slide" transparent onRequestClose={() => setSelectedKey(null)}>
        <Pressable style={styles.backdrop} onPress={() => setSelectedKey(null)}>
          <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
            <View style={styles.handle} />
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetHeading}>{selectedLabel}</Text>
              <Pressable onPress={() => setSelectedKey(null)} hitSlop={14} accessibilityRole="button" accessibilityLabel="Close">
                <Icon name="close" size={20} color={colors.slate500} />
              </Pressable>
            </View>

            {selectedEvents.length === 0 ? (
              <Text style={styles.emptyText}>No bookings on this date.</Text>
            ) : (
              <ScrollView style={styles.sheetList}>
                {selectedEvents.map((e, idx) => (
                  <View key={idx} style={styles.bookingRow}>
                    <View style={[styles.dot, styles.bookingDot, { backgroundColor: DOT_COLOR[e.type] }]} />
                    <View style={styles.bookingInfo}>
                      <Text style={styles.bookingLabel} numberOfLines={1}>{e.label}</Text>
                      <Text style={styles.bookingDetail} numberOfLines={1}>
                        {EVENT_TYPE_LABEL[e.type]}{e.person ? ` · ${e.person}` : ''}{e.detail ? ` · ${e.detail}` : ''}
                      </Text>
                    </View>
                  </View>
                ))}
              </ScrollView>
            )}
            <SafeAreaView edges={['bottom']} />
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.slate50 },
  // flexGrow so ErrorState's `flex: 1` has room to centre in — a scroll
  // container sizes to its content, and without this the failure state would
  // collapse to a strip at the top of the screen.
  content: { flexGrow: 1, paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.xxl },
  // One white card on the slate50 canvas — the app-shell rule (.claude/ui-ux.md).
  // The grid used to sit bare on the canvas, so the whole screen was one
  // undifferentiated grey sheet.
  card: {
    backgroundColor: colors.white, borderWidth: 1, borderColor: colors.slate200,
    borderRadius: radius.lg, padding: spacing.md, ...shadows.card,
  },
  monthNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm },
  monthButton: {
    width: 44, height: 44, borderRadius: radius.md, backgroundColor: colors.slate100,
    alignItems: 'center', justifyContent: 'center',
  },
  monthLabel: { fontFamily: fonts.displayBold, fontSize: fontSizes.base, color: colors.slate800 },
  weekRow: { flexDirection: 'row', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.slate200, marginBottom: spacing.xs },
  weekday: { flex: 1, textAlign: 'center', fontFamily: fonts.bodySemiBold, fontSize: fontSizes.xs, color: colors.slate500, paddingVertical: spacing.sm },
  // One row per week, seven `flex: 1` cells in it — see the `weeks` comment.
  // The header row above uses the same `flex: 1`, so the two stay in lockstep
  // at any width without either of them knowing the column count.
  gridRow: { flexDirection: 'row' },
  // minHeight, not aspectRatio: a 7-column grid on a 360dp phone makes ~40dp
  // squares, under the 48dp Android target height (§6). Width is bound by the
  // seven columns; height is not.
  cell: { flex: 1, minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  dayDisc: { width: 32, height: 32, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center' },
  dayDiscToday: { backgroundColor: colors.brand600 },
  dayNumber: { fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.slate700 },
  dayNumberBusy: { fontFamily: fonts.bodySemiBold, color: colors.slate800 },
  dayNumberToday: { fontFamily: fonts.bodySemiBold, color: colors.white },
  // Constant height whether or not the day has dots, so rows don't ripple.
  dotRow: { flexDirection: 'row', gap: 3, height: 6, marginTop: 2 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  legend: {
    flexDirection: 'row', gap: spacing.md, flexWrap: 'wrap',
    marginTop: spacing.sm, paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.slate200,
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontFamily: fonts.body, fontSize: fontSizes.xs, color: colors.slate600 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.white, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl,
    paddingHorizontal: spacing.lg, maxHeight: '75%',
    ...shadows.sheet,
  },
  handle: { alignSelf: 'center', width: 40, height: 5, borderRadius: 3, backgroundColor: colors.slate200, marginTop: spacing.sm + 2 },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: spacing.md - 2 },
  sheetHeading: { fontFamily: fonts.displayBold, fontSize: fontSizes.lg, color: colors.slate800, flexShrink: 1, marginRight: spacing.sm },
  emptyText: { fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.slate500, textAlign: 'center', paddingVertical: spacing.xl },
  sheetList: { marginBottom: spacing.sm },
  bookingRow: {
    flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm,
    paddingVertical: spacing.sm + 2, borderBottomWidth: 1, borderBottomColor: colors.slate100,
  },
  bookingDot: { width: 8, height: 8, borderRadius: 4, marginTop: 5 },
  bookingInfo: { flex: 1, minWidth: 0 },
  bookingLabel: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.sm, color: colors.slate800 },
  bookingDetail: { fontFamily: fonts.body, fontSize: fontSizes.xs, color: colors.slate500, marginTop: 2 },
})
