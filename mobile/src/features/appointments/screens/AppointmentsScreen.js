import { useState } from 'react'
import { View, Text, TextInput, Pressable, FlatList, SectionList, Modal, ActivityIndicator, StyleSheet, Linking } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { appointmentService } from '@services/appointment.service'

import Icon from '@components/common/Icon'
import ErrorState from '@components/common/ErrorState'
import ScreenHeader from '@components/common/ScreenHeader'
import { colors } from '@theme/colors'
import { shadows } from '@theme/shadows'
import { fonts, fontSizes } from '@theme/typography'
import { spacing, radius } from '@theme/spacing'

const STATUS = {
  PENDING: { bg: colors.warning50, text: '#B45309', dot: '#FBBF24', label: 'Pending' },
  ACCEPTED: { bg: colors.success50, text: '#15803D', dot: '#4ADE80', label: 'Accepted' },
  REJECTED: { bg: colors.danger50, text: '#DC2626', dot: '#F87171', label: 'Rejected' },
  RESCHEDULED: { bg: colors.brand50, text: colors.brand700, dot: colors.brand500, label: 'Rescheduled' },
  CANCELLED: { bg: colors.slate50, text: colors.slate600, dot: colors.slate500, label: 'Cancelled' },
}

const OWNER_FILTERS = [
  ['all', 'All'],
  ['PENDING', 'Pending'],
  ['ACCEPTED', 'Accepted'],
  ['REJECTED', 'Rejected'],
]

function personName(u) {
  if (u?.name?.trim()) return u.name
  if (u?.email) {
    const local = u.email.split('@')[0]
    return local.charAt(0).toUpperCase() + local.slice(1)
  }
  return 'User'
}

function FilterDropdown({ value, options, onChange }) {
  const [open, setOpen] = useState(false)
  const selected = options.find(([key]) => key === value)

  return (
    <View>
      <Pressable
        style={styles.filterTrigger}
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={`Filter by status, currently ${selected?.[1] ?? 'All'}`}
      >
        <Text style={styles.filterTriggerText}>{selected?.[1] ?? 'All'}</Text>
        <Icon name="chevronDown" size={14} color={colors.slate500} />
      </Pressable>

      <Modal visible={open} animationType="slide" transparent onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.dropdownBackdrop} onPress={() => setOpen(false)}>
          <Pressable style={styles.dropdownSheet} onPress={(e) => e.stopPropagation()}>
            <View style={styles.dropdownSheetHeader}>
              <Text style={styles.dropdownSheetTitle}>Filter by status</Text>
              <Pressable onPress={() => setOpen(false)} hitSlop={12} accessibilityRole="button" accessibilityLabel="Close filter options">
                <Icon name="close" size={18} color={colors.slate500} />
              </Pressable>
            </View>
            <FlatList
              data={options}
              keyExtractor={([key]) => key}
              ItemSeparatorComponent={() => <View style={styles.dropdownSeparator} />}
              renderItem={({ item: [key, label] }) => (
                <Pressable
                  style={styles.dropdownOption}
                  onPress={() => { onChange(key); setOpen(false) }}
                  accessibilityRole="button"
                  accessibilityLabel={label}
                  accessibilityState={{ selected: key === value }}
                >
                  <Text style={[styles.dropdownOptionText, key === value && styles.dropdownOptionTextActive]}>{label}</Text>
                  {key === value && <Icon name="check" size={16} color={colors.brand600} />}
                </Pressable>
              )}
            />
            <SafeAreaView edges={['bottom']} />
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  )
}

function StatusPill({ status }) {
  const s = STATUS[status] ?? STATUS.PENDING
  return (
    <View style={[styles.statusPill, { backgroundColor: s.bg }]}>
      <View style={[styles.statusDot, { backgroundColor: s.dot }]} />
      <Text style={[styles.statusText, { color: s.text }]}>{s.label}</Text>
    </View>
  )
}

// Agenda grouping. A flat list gave every request equal weight and no sense of
// time — the owner's real question is "what is happening today", not "what
// arrived most recently". Upcoming days ascending (soonest first), then past
// days descending underneath, because a past visit is history you scroll back
// through rather than something you act on.
const DAY_MS = 86400000

function dayKey(date) {
  const d = new Date(date)
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
}

function dayLabel(key) {
  const today = dayKey(new Date())
  if (key === today) return 'Today'
  if (key === today + DAY_MS) return 'Tomorrow'
  if (key === today - DAY_MS) return 'Yesterday'
  return new Date(key).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })
}

function toSections(appointments) {
  const byDay = new Map()
  for (const a of appointments) {
    const key = dayKey(a.requestedDate)
    if (!byDay.has(key)) byDay.set(key, [])
    byDay.get(key).push(a)
  }
  const today = dayKey(new Date())
  const keys = [...byDay.keys()]
  const upcoming = keys.filter((k) => k >= today).sort((a, b) => a - b)
  const past = keys.filter((k) => k < today).sort((a, b) => b - a)
  return [...upcoming, ...past].map((key) => ({
    title: dayLabel(key),
    past: key < today,
    data: byDay.get(key).sort((a, b) => String(a.requestedTime).localeCompare(String(b.requestedTime))),
  }))
}

// Someone's words, not the app's. Attribution first, then the text in a tinted
// block — inline "Note: …" in the same grey as everything else gave no clue
// whether the words were the renter's, the owner's or a system message.
function NoteBlock({ from, text, tone = 'neutral' }) {
  if (!text) return null
  return (
    <View style={[styles.noteBlock, tone === 'reply' && styles.noteBlockReply]}>
      <Text style={[styles.noteFrom, tone === 'reply' && styles.noteFromReply]}>{from}</Text>
      <Text style={styles.noteText}>{text}</Text>
    </View>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Direction 1B "Next-up first" from the appointments handoff: dark hero for the
// next visit, a week strip, then a dense list. Owner side only — the handoff
// covers the agent screen; the renter keeps the day agenda.
//
// Adapted, not copied, per the handoff's own instruction to rebuild in the
// codebase's components and theme:
//   · Jade instead of the prototype's #12211B / #1A1917 — brand900 hero,
//     brand600 primary. Amber stays for "needs reply" since it is a distinct
//     state, not a brand accent.
//   · No "45 MIN" — Appointment has no duration field. No rent in the meta and
//     no Directions button — the owner query selects only
//     { id, displayId, title, city, images }, so there is no lat/lng or rent to
//     show. "View listing" replaces Directions; the property page has the map.
//   · No "IN 2 HRS" — requestedTime is a free-form string, so a countdown would
//     be a guess. The day label is derived from data we actually have.
//   · The hero drops the prototype's own title row: ScreenHeader already
//     supplies one, and two headers would stack.
function NextUpHero({ appt, onAction, onOpenProperty }) {
  const [rejecting, setRejecting] = useState(false)
  const [note, setNote] = useState('')
  const isPending = appt.status === 'PENDING'
  const when = dayLabel(dayKey(appt.requestedDate))
  return (
    <View style={styles.hero}>
      <Text style={styles.heroEyebrow}>NEXT UP · {when.toUpperCase()}</Text>

      <View style={styles.heroTimeRow}>
        <Text style={styles.heroTime}>{appt.requestedTime}</Text>
        <StatusPill status={appt.status} />
      </View>

      <Text style={styles.heroName} numberOfLines={1}>{personName(appt.tenant)}</Text>
      <Pressable
        onPress={() => appt.property?.id && onOpenProperty?.(appt.property.id)}
        disabled={!appt.property?.id}
        accessibilityRole="button"
        accessibilityLabel={`Open ${appt.property?.title ?? 'property'}`}
      >
        <Text style={styles.heroProperty} numberOfLines={2}>{appt.property?.title ?? 'Property'}</Text>
        <Text style={styles.heroMeta} numberOfLines={1}>{appt.property?.city}</Text>
      </Pressable>

      {!!appt.message && (
        <View style={styles.heroNote}>
          <Text style={styles.heroNoteFrom}>{personName(appt.tenant).toUpperCase()} WROTE</Text>
          <Text style={styles.heroNoteText}>{appt.message}</Text>
        </View>
      )}

      {/* A pending visit needs a DECISION; an accepted one needs contacting.
          1B's hero shows Call/Directions, but showing Call on a request the
          owner has not agreed to yet skips the actual job. Reject keeps the
          optional-reason flow the old card had — dropping it would have removed
          the only way to decline. */}
      {isPending ? (
        rejecting ? (
          <View style={{ gap: spacing.xs, marginTop: spacing.md }}>
            <TextInput
              style={styles.heroRejectInput}
              placeholder="Reason (optional)"
              placeholderTextColor={colors.brand300}
              value={note}
              onChangeText={setNote}
              multiline
            />
            <View style={styles.heroActions}>
              <Pressable style={styles.heroSecondary} onPress={() => { setRejecting(false); setNote('') }} accessibilityRole="button" accessibilityLabel="Cancel rejection">
                <Text style={styles.heroSecondaryText}>Cancel</Text>
              </Pressable>
              <Pressable style={[styles.heroCall, styles.heroConfirmReject]} onPress={() => onAction(appt.id, 'REJECTED', note || undefined)} accessibilityRole="button" accessibilityLabel="Confirm rejection">
                <Text style={styles.heroConfirmRejectText}>Confirm reject</Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <View style={styles.heroActions}>
            <Pressable style={styles.heroCall} onPress={() => onAction(appt.id, 'ACCEPTED')} accessibilityRole="button" accessibilityLabel="Accept this visit">
              <Icon name="check" size={14} color={colors.brand900} />
              <Text style={styles.heroCallText}>Accept</Text>
            </Pressable>
            <Pressable style={styles.heroSecondary} onPress={() => setRejecting(true)} accessibilityRole="button" accessibilityLabel="Reject this visit">
              <Text style={styles.heroSecondaryText}>Reject</Text>
            </Pressable>
          </View>
        )
      ) : (
      <View style={styles.heroActions}>
        <Pressable
          style={styles.heroCall}
          onPress={() => appt.contactNumber && Linking.openURL(`tel:${appt.contactNumber}`)}
          disabled={!appt.contactNumber}
          accessibilityRole="button"
          accessibilityLabel={`Call ${personName(appt.tenant)}`}
        >
          <Icon name="phone" size={14} color={colors.brand900} />
          <Text style={styles.heroCallText} numberOfLines={1}>Call {appt.contactNumber}</Text>
        </Pressable>
        <Pressable
          style={styles.heroSecondary}
          onPress={() => appt.property?.id && onOpenProperty?.(appt.property.id)}
          disabled={!appt.property?.id}
          accessibilityRole="button"
          accessibilityLabel="View listing"
        >
          <Text style={styles.heroSecondaryText}>View listing</Text>
        </Pressable>
      </View>
      )}
    </View>
  )
}

// Seven days from today. A day is filled when it has visits; the amber dot
// marks a day with something still awaiting a reply. Tapping narrows the list
// below — a strip that looks tappable and isn't would be worse than none.
function WeekStrip({ appointments, selected, onSelect }) {
  const today = dayKey(new Date())
  const days = Array.from({ length: 7 }, (_, i) => today + i * DAY_MS)
  return (
    <View style={styles.weekStrip}>
      {days.map((key) => {
        const onDay = appointments.filter((a) => dayKey(a.requestedDate) === key)
        const pending = onDay.some((a) => a.status === 'PENDING')
        const isSelected = selected === key
        const d = new Date(key)
        return (
          <Pressable
            key={key}
            style={[styles.dayTile, onDay.length > 0 && styles.dayTileHas, isSelected && styles.dayTileSelected]}
            onPress={() => onSelect(isSelected ? null : key)}
            accessibilityRole="button"
            accessibilityState={{ selected: isSelected }}
            accessibilityLabel={`${d.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}, ${onDay.length} visit${onDay.length === 1 ? '' : 's'}`}
          >
            <Text style={[styles.dayName, isSelected && styles.dayTextSelected]}>
              {d.toLocaleDateString('en-IN', { weekday: 'short' }).toUpperCase()}
            </Text>
            <Text style={[styles.dayNum, isSelected && styles.dayTextSelected]}>{d.getDate()}</Text>
            <View style={[styles.dayDot, pending && styles.dayDotPending, !onDay.length && styles.dayDotHidden]} />
          </Pressable>
        )
      })}
    </View>
  )
}

function LaterRow({ appt, onAction, onOpenProperty }) {
  const isPending = appt.status === 'PENDING'
  const d = new Date(appt.requestedDate)
  return (
    <Pressable
      style={styles.laterRow}
      onPress={() => appt.property?.id && onOpenProperty?.(appt.property.id)}
      disabled={!appt.property?.id}
      accessibilityRole="button"
      accessibilityLabel={`${personName(appt.tenant)}, ${appt.requestedTime}. Open listing.`}
    >
      <View style={styles.laterTime}>
        <Text style={styles.laterTimeText}>{appt.requestedTime}</Text>
        <Text style={styles.laterDay}>{d.toLocaleDateString('en-IN', { weekday: 'short' }).toUpperCase()}</Text>
      </View>
      <View style={styles.laterBody}>
        <Text style={styles.laterName} numberOfLines={1}>{personName(appt.tenant)}</Text>
        <Text style={styles.laterMeta} numberOfLines={1}>
          {appt.property?.title ?? 'Property'}{appt.property?.city ? ` · ${appt.property.city}` : ''}
        </Text>
      </View>
      {isPending ? (
        <View style={styles.laterActions}>
          <Pressable
            style={styles.laterAccept}
            onPress={() => onAction(appt.id, 'ACCEPTED')}
            accessibilityRole="button"
            accessibilityLabel={`Accept ${personName(appt.tenant)}`}
          >
            <Text style={styles.laterAcceptText}>Accept</Text>
          </Pressable>
          <Pressable
            style={styles.laterReject}
            onPress={() => onAction(appt.id, 'REJECTED')}
            accessibilityRole="button"
            accessibilityLabel={`Reject ${personName(appt.tenant)}`}
          >
            <Text style={styles.laterRejectText}>Reject</Text>
          </Pressable>
        </View>
      ) : (
        <StatusPill status={appt.status} />
      )}
    </Pressable>
  )
}

function TenantCard({ appt, onOpenProperty }) {
  const [showNote, setShowNote] = useState(false)
  const hasNote = !!appt.message || !!appt.ownerNote

  return (
    <View style={styles.card}>
      <View style={styles.agendaRow}>
        <Text style={styles.agendaTime}>{appt.requestedTime}</Text>
        <View style={styles.agendaBody}>
          <View style={styles.agendaTop}>
            <Text style={styles.personName} numberOfLines={1}>{appt.property?.title ?? 'Property'}</Text>
            <StatusPill status={appt.status} />
          </View>
          <Pressable
            style={styles.agendaProperty}
            onPress={() => appt.property?.id && onOpenProperty?.(appt.property.id)}
            disabled={!appt.property?.id}
            accessibilityRole="button"
            accessibilityLabel={`Open ${appt.property?.title ?? 'property'}`}
          >
            <Text style={styles.agendaPropertyText} numberOfLines={1}>{appt.property?.city}</Text>
            <Icon name="chevronRight" size={14} color={colors.slate400} />
          </Pressable>
        </View>
      </View>

      {hasNote && (
        <Pressable
          style={styles.noteToggle}
          onPress={() => setShowNote((v) => !v)}
          hitSlop={6}
          accessibilityRole="button"
          accessibilityState={{ expanded: showNote }}
        >
          <Text style={styles.noteToggleText}>{showNote ? 'Hide notes' : 'View notes'}</Text>
          <Icon name={showNote ? 'chevronUp' : 'chevronDown'} size={14} color={colors.brand700} />
        </Pressable>
      )}
      {showNote && (
        <>
          <NoteBlock from="You wrote" text={appt.message} />
          <NoteBlock from="Owner replied" text={appt.ownerNote} tone="reply" />
        </>
      )}
    </View>
  )
}

function EmptyState({ message }) {
  return (
    <View style={styles.empty}>
      <View style={styles.emptyIcon}>
        <Icon name="calendar" size={22} color={colors.slate500} />
      </View>
      <Text style={styles.emptyTitle}>No appointments</Text>
      <Text style={styles.emptyBody}>{message}</Text>
    </View>
  )
}

export default function AppointmentsScreen({ navigation, route }) {
  // A plain push, no tab named: BOOKING_SCREENS is spread into ProfileStack
  // (renter) and HostAppointmentsStack (host) precisely so this resolves inside
  // whichever stack the screen was pushed onto, keeping the user in their tab.
  const openProperty = (propertyId) => navigation.navigate('PropertyDetail', { propertyId })
  const qc = useQueryClient()

  // Fixed by which nav stack registered this screen, not a user-facing
  // toggle — host mode's Appointments tab always means "incoming for my
  // properties", renter mode's Profile > Appointments always means "my own
  // visit requests". A user who is both can already switch between these
  // via the renter/host mode toggle itself, so a second toggle in here
  // would just duplicate that.
  const isIncoming = route?.params?.initialTab === 'incoming'
  const [filter, setFilter] = useState('all')

  const { data: ownerAppts = [], isLoading: loadingOwner, isError: errorOwner, refetch: refetchOwner } = useQuery({
    queryKey: ['owner-appointments'],
    queryFn: () => appointmentService.owner().then((r) => r.data),
    enabled: isIncoming,
  })

  const { data: myAppts = [], isLoading: loadingMine, isError: errorMine, refetch: refetchMine } = useQuery({
    queryKey: ['my-appointments'],
    queryFn: () => appointmentService.mine().then((r) => r.data),
    enabled: !isIncoming,
  })

  const mutation = useMutation({
    mutationFn: ({ id, status, ownerNote }) => appointmentService.updateStatus(id, { status, ownerNote }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['owner-appointments'] }),
  })

  const pendingCount = ownerAppts.filter((a) => a.status === 'PENDING').length
  const filteredOwner = filter === 'all' ? ownerAppts : ownerAppts.filter((a) => a.status === filter)

  // 1B splits the list: the soonest upcoming visit becomes the hero, everything
  // else is the dense list beneath. Past appointments stay out of both — this
  // screen is about what is coming.
  const [selectedDay, setSelectedDay] = useState(null)
  const todayKey = dayKey(new Date())
  const upcoming = filteredOwner
    .filter((a) => dayKey(a.requestedDate) >= todayKey)
    .sort((a, b) => (dayKey(a.requestedDate) - dayKey(b.requestedDate))
      || String(a.requestedTime).localeCompare(String(b.requestedTime)))
  const nextUp = selectedDay ? null : upcoming[0]
  const laterAppts = selectedDay
    ? upcoming.filter((a) => dayKey(a.requestedDate) === selectedDay)
    : upcoming.slice(1)
  const laterPending = laterAppts.filter((a) => a.status === 'PENDING').length
  const isLoading = isIncoming ? loadingOwner : loadingMine
  const isError = isIncoming ? errorOwner : errorMine
  const refetch = isIncoming ? refetchOwner : refetchMine

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScreenHeader
        title={`Appointments${isIncoming && pendingCount > 0 ? ` (${pendingCount})` : ''}`}
        right={isIncoming ? <FilterDropdown value={filter} options={OWNER_FILTERS} onChange={setFilter} /> : null}
      />

      {isLoading ? (
        <View style={styles.center}><ActivityIndicator color={colors.brand600} /></View>
      ) : isError ? (
        <ErrorState title="Couldn't load appointments" onRetry={refetch} />
      ) : isIncoming ? (
        <FlatList
          data={laterAppts}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.ownerList}
          ListHeaderComponent={
            <>
              {nextUp && (
                <NextUpHero
                  appt={nextUp}
                  onAction={(id, status, ownerNote) => mutation.mutate({ id, status, ownerNote })}
                  onOpenProperty={openProperty}
                />
              )}
              <WeekStrip appointments={upcoming} selected={selectedDay} onSelect={setSelectedDay} />
              {laterAppts.length > 0 && (
                <View style={styles.laterHeader}>
                  <Text style={styles.laterHeaderText}>
                    {selectedDay ? dayLabel(selectedDay).toUpperCase() : 'LATER'}
                  </Text>
                  {laterPending > 0 && <Text style={styles.laterPending}>{laterPending} pending</Text>}
                </View>
              )}
            </>
          }
          ListEmptyComponent={
            nextUp ? null : <EmptyState message="Tenant visit requests will appear here." />
          }
          renderItem={({ item }) => (
            <LaterRow
              appt={item}
              onAction={(id, status, ownerNote) => mutation.mutate({ id, status, ownerNote })}
              onOpenProperty={openProperty}
            />
          )}
        />
      ) : (
        <SectionList
          sections={toSections(myAppts)}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          stickySectionHeadersEnabled={false}
          renderSectionHeader={({ section }) => (
            <Text style={[styles.sectionHeader, section.past && styles.sectionHeaderPast]}>{section.title}</Text>
          )}
          ListEmptyComponent={<EmptyState message="Appointments you've requested will appear here." />}
          renderItem={({ item }) => <TenantCard appt={item} onOpenProperty={openProperty} />}
        />
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.slate50 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: { padding: spacing.lg, gap: spacing.md },
  filterTrigger: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.xs,
    borderWidth: 1, borderColor: colors.slate200, borderRadius: radius.md,
    paddingHorizontal: spacing.md, paddingVertical: spacing.xs + 2, backgroundColor: colors.white,
  },
  filterTriggerText: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.xs, color: colors.slate700 },
  dropdownBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  dropdownSheet: { backgroundColor: colors.white, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, maxHeight: '70%', ...shadows.sheet },
  dropdownSheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.slate100 },
  dropdownSheetTitle: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.base, color: colors.slate800 },
  dropdownOption: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  dropdownOptionText: { fontFamily: fonts.bodyMedium, fontSize: fontSizes.base, color: colors.slate700 },
  dropdownOptionTextActive: { color: colors.brand700, fontFamily: fonts.bodySemiBold },
  dropdownSeparator: { height: 1, backgroundColor: colors.slate100, marginHorizontal: spacing.lg },
  noteBlock: {
    backgroundColor: colors.slate50, borderRadius: radius.md,
    padding: spacing.sm, marginBottom: spacing.sm, gap: 2,
  },
  noteBlockReply: { backgroundColor: colors.brand50 },
  noteFrom: {
    fontFamily: fonts.bodySemiBold, fontSize: 11, color: colors.slate500,
    textTransform: 'uppercase', letterSpacing: 0.4,
  },
  noteFromReply: { color: colors.brand700 },
  noteText: { fontFamily: fonts.body, fontSize: fontSizes.xs, color: colors.slate700, lineHeight: 18 },
  // ── Direction 1B ──────────────────────────────────────────────────────────
  ownerList: { paddingBottom: spacing.xxl },
  hero: {
    backgroundColor: colors.brand900, padding: spacing.lg, gap: 6,
  },
  heroEyebrow: {
    fontFamily: fonts.bodySemiBold, fontSize: 11, letterSpacing: 1,
    color: colors.brand300,
  },
  heroTimeRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  heroTime: { flex: 1, fontFamily: fonts.displayBold, fontSize: fontSizes.display, color: colors.white },
  heroName: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.base, color: colors.white, marginTop: 2 },
  heroProperty: { fontFamily: fonts.bodyMedium, fontSize: fontSizes.sm, color: colors.brand100 },
  heroMeta: { fontFamily: fonts.body, fontSize: fontSizes.xs, color: colors.brand300 },
  heroNote: {
    backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: radius.md,
    padding: spacing.sm, gap: 2, marginTop: spacing.sm,
  },
  heroNoteFrom: { fontFamily: fonts.bodySemiBold, fontSize: 11, letterSpacing: 1, color: colors.brand300 },
  heroNoteText: { fontFamily: fonts.body, fontSize: fontSizes.xs, color: colors.white, lineHeight: 18 },
  heroActions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  heroCall: {
    flex: 1, minHeight: 44, flexDirection: 'row', gap: 6, borderRadius: radius.md,
    backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: spacing.sm,
  },
  heroCallText: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.sm, color: colors.brand900 },
  heroSecondary: {
    minHeight: 44, borderRadius: radius.md, paddingHorizontal: spacing.md,
    backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center',
  },
  heroSecondaryText: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.sm, color: colors.white },

  weekStrip: { flexDirection: 'row', gap: 6, paddingHorizontal: spacing.lg, paddingTop: spacing.md },
  dayTile: {
    flex: 1, alignItems: 'center', gap: 2, paddingVertical: spacing.sm,
    borderRadius: radius.md, backgroundColor: colors.white,
    borderWidth: 1, borderColor: colors.slate200,
  },
  dayTileHas: { borderColor: colors.brand200 },
  dayTileSelected: { backgroundColor: colors.brand600, borderColor: colors.brand600 },
  dayName: { fontFamily: fonts.bodySemiBold, fontSize: 11, color: colors.slate500 },
  dayNum: { fontFamily: fonts.displayBold, fontSize: fontSizes.sm, color: colors.slate800 },
  dayTextSelected: { color: colors.white },
  dayDot: { width: 5, height: 5, borderRadius: radius.full, backgroundColor: colors.brand600 },
  dayDotPending: { backgroundColor: colors.warning700 },
  dayDotHidden: { backgroundColor: 'transparent' },

  laterHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.lg, marginTop: spacing.lg, marginBottom: spacing.sm,
  },
  laterHeaderText: { fontFamily: fonts.bodySemiBold, fontSize: 11, letterSpacing: 1, color: colors.slate600 },
  laterPending: { fontFamily: fonts.bodySemiBold, fontSize: 11, color: colors.warning700 },
  laterRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    marginHorizontal: spacing.lg, marginBottom: spacing.sm,
    backgroundColor: colors.white, borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.slate100, padding: spacing.md,
  },
  laterTime: { alignItems: 'center', width: 56 },
  laterTimeText: { fontFamily: fonts.displayBold, fontSize: fontSizes.sm, color: colors.slate800 },
  laterDay: { fontFamily: fonts.bodySemiBold, fontSize: 11, color: colors.slate500 },
  laterBody: { flex: 1, minWidth: 0, gap: 2 },
  laterName: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.sm, color: colors.slate800 },
  laterMeta: { fontFamily: fonts.body, fontSize: fontSizes.xs, color: colors.slate500 },
  laterAccept: {
    minHeight: 36, justifyContent: 'center', paddingHorizontal: spacing.md,
    borderRadius: radius.full, backgroundColor: colors.brand600,
  },
  laterAcceptText: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.xs, color: colors.white },
  laterActions: { gap: 6, alignItems: 'flex-end' },
  laterReject: { minHeight: 36, justifyContent: 'center', paddingHorizontal: spacing.md, borderRadius: radius.full, backgroundColor: colors.danger50 },
  laterRejectText: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.xs, color: colors.danger600 },
  heroRejectInput: {
    minHeight: 44, borderRadius: radius.md, padding: spacing.sm,
    backgroundColor: 'rgba(255,255,255,0.10)', color: colors.white,
    fontFamily: fonts.body, fontSize: fontSizes.sm, textAlignVertical: 'top',
  },
  heroConfirmReject: { backgroundColor: colors.danger600 },
  heroConfirmRejectText: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.sm, color: colors.white },

  sectionHeader: {
    fontFamily: fonts.bodySemiBold, fontSize: 11, color: colors.slate600,
    textTransform: 'uppercase', letterSpacing: 0.5,
    marginTop: spacing.md, marginBottom: spacing.xs,
  },
  sectionHeaderPast: { color: colors.slate500 },
  agendaRow: { flexDirection: 'row', gap: spacing.md },
  agendaTime: { fontFamily: fonts.displayBold, fontSize: fontSizes.sm, color: colors.slate800, width: 68 },
  agendaBody: { flex: 1, minWidth: 0, gap: 4 },
  agendaTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  personName: { flex: 1, minWidth: 0, fontFamily: fonts.bodySemiBold, fontSize: fontSizes.sm, color: colors.slate800 },
  agendaProperty: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  agendaPropertyText: { flex: 1, minWidth: 0, fontFamily: fonts.body, fontSize: fontSizes.xs, color: colors.slate600 },
  noteToggle: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', paddingVertical: spacing.xs, marginTop: spacing.xs },
  noteToggleText: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.xs, color: colors.brand700 },
  card: { backgroundColor: colors.white, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.slate100, padding: spacing.md, marginBottom: spacing.sm },
  statusPill: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: spacing.sm, paddingVertical: 3, borderRadius: radius.full },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontFamily: fonts.bodySemiBold, fontSize: 11 },
  empty: { alignItems: 'center', paddingVertical: spacing.xxl },
  emptyIcon: { width: 48, height: 48, borderRadius: radius.full, backgroundColor: colors.slate100, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.sm },
  emptyTitle: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.sm, color: colors.slate700 },
  emptyBody: { fontFamily: fonts.body, fontSize: fontSizes.xs, color: colors.slate500, marginTop: 2, textAlign: 'center', maxWidth: 240 },
})
