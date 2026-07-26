import { useMemo, useState } from 'react'
import { View, Text, TextInput, Pressable, SectionList, ActivityIndicator, Alert, Linking, StyleSheet } from 'react-native'
import { Image } from 'expo-image'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { appointmentService } from '@services/appointment.service'
import { chatService } from '@services/chat.service'
import { imgUrl } from '@utils/format'
import { formatTime } from '@utils/time'
import Icon from '@components/common/Icon'
import ScreenHeader from '@components/common/ScreenHeader'
import ErrorState from '@components/common/ErrorState'
import { useUiStore } from '@store/uiStore'
import { colors } from '@theme/colors'
import { fonts, fontSizes } from '@theme/typography'
import { spacing, radius } from '@theme/spacing'

// A visit is an appointment on a specific day, so the DAY is what this screen
// is organised around: grouped into Today / Tomorrow / This week / Later /
// Past, with a tear-off date block leading every card.
//
// It used to be a flat list of cards where the date was an 12px right-aligned
// pair inside a grey sub-row, the same size as everything else on the card —
// so the one fact you open this screen for was the hardest thing on it to
// find. Filtering was a modal bottom sheet for four options.

const STATUS = {
  PENDING:     { bg: colors.warning50, text: '#B45309',       dot: '#FBBF24',        label: 'Pending' },
  ACCEPTED:    { bg: colors.success50, text: '#15803D',       dot: '#4ADE80',        label: 'Accepted' },
  REJECTED:    { bg: colors.danger50,  text: '#DC2626',       dot: '#F87171',        label: 'Declined' },
  RESCHEDULED: { bg: colors.brand50,   text: colors.brand700, dot: colors.brand500,  label: 'Rescheduled' },
  CANCELLED:   { bg: colors.slate100,  text: colors.slate600, dot: colors.slate400,  label: 'Cancelled' },
}

const OWNER_FILTERS = [
  ['all', 'All'],
  ['PENDING', 'Pending'],
  ['ACCEPTED', 'Accepted'],
  ['REJECTED', 'Declined'],
]

// Local midnight, not toISOString(): between midnight and 05:30 IST the UTC
// date is YESTERDAY, which would file today's visits under "Past".
function startOfDay(d) {
  const c = new Date(d)
  c.setHours(0, 0, 0, 0)
  return c
}

const DAY = 86400000

// Order matters — it is the order the sections render in.
const BUCKETS = ['Today', 'Tomorrow', 'This week', 'Later', 'Past']

function bucketFor(iso) {
  const days = Math.round((startOfDay(iso) - startOfDay(new Date())) / DAY)
  if (days < 0) return 'Past'
  if (days === 0) return 'Today'
  if (days === 1) return 'Tomorrow'
  if (days <= 7) return 'This week'
  return 'Later'
}

function groupByDay(appointments) {
  const map = new Map(BUCKETS.map((b) => [b, []]))
  for (const a of appointments) map.get(bucketFor(a.requestedDate))?.push(a)
  // Soonest first inside every bucket except Past, which reads most-recent
  // first — a visit last week matters more than one last year.
  for (const [key, items] of map) {
    items.sort((x, y) => {
      const diff = new Date(x.requestedDate) - new Date(y.requestedDate)
      return key === 'Past' ? -diff : diff
    })
  }
  return BUCKETS.filter((b) => map.get(b).length).map((b) => ({ title: b, data: map.get(b) }))
}

function personName(u) {
  if (u?.name?.trim()) return u.name
  if (u?.email) {
    const local = u.email.split('@')[0]
    return local.charAt(0).toUpperCase() + local.slice(1)
  }
  return 'User'
}

// The tear-off: weekday over day number. Two lines of real size beat "26 Jul"
// set in 12px beside everything else.
function DateBlock({ iso, muted }) {
  const d = new Date(iso)
  return (
    <View style={[styles.dateBlock, muted && styles.dateBlockMuted]}>
      <Text style={[styles.dateWeekday, muted && styles.dateMutedText]}>
        {d.toLocaleDateString('en-IN', { weekday: 'short' }).toUpperCase()}
      </Text>
      <Text style={[styles.dateDay, muted && styles.dateMutedText]}>{d.getDate()}</Text>
      <Text style={[styles.dateMonth, muted && styles.dateMutedText]}>
        {d.toLocaleDateString('en-IN', { month: 'short' })}
      </Text>
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

function PropertyLine({ property }) {
  const thumb = property?.images?.[0]?.url
  return (
    <View style={styles.propertyRow}>
      {thumb
        ? <Image source={{ uri: imgUrl(thumb, 'card') }} style={styles.propertyThumb} contentFit="cover" cachePolicy="memory-disk" transition={200} />
        : <View style={[styles.propertyThumb, styles.propertyThumbEmpty]}><Icon name="home" size={14} color={colors.slate500} /></View>}
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={styles.propertyTitle} numberOfLines={1}>{property?.title ?? 'Property'}</Text>
        {!!property?.city && <Text style={styles.propertySub} numberOfLines={1}>{property.city}</Text>}
      </View>
    </View>
  )
}

function OwnerCard({ appt, onAction, onChat, chatting, busy }) {
  const [rejecting, setRejecting] = useState(false)
  const [note, setNote] = useState('')
  const isPending = appt.status === 'PENDING'
  const past = bucketFor(appt.requestedDate) === 'Past'

  return (
    <View style={styles.card}>
      {/* Status in the top-right corner: it is the card's state, not a line of
          its content, so it belongs at the corner where a badge is read and
          then ignored — not stacked under the time competing with it. */}
      <View style={styles.statusCorner}><StatusPill status={appt.status} /></View>

      <View style={styles.cardTop}>
        <DateBlock iso={appt.requestedDate} muted={past} />

        <View style={styles.cardTopBody}>
          {/* The person and the time, at the size they deserve — this is the
              sentence a host reads: "Priya, 4:30 PM". */}
          <Text style={styles.person} numberOfLines={1}>{personName(appt.tenant)}</Text>
          <Text style={styles.time}>{formatTime(appt.requestedTime)}</Text>
          {!!appt.contactNumber && <Text style={styles.phoneText}>{appt.contactNumber}</Text>}
        </View>
      </View>

      <PropertyLine property={appt.property} />

      {/* Reaching the person is the host's next move after accepting, so both
          ways of doing it sit together as real buttons. The number used to be
          text you had to memorise and retype. */}
      {/* Chat is filled brand green, Call is outlined — they are not equal
          choices. A chat stays in the app, which is what the Community Rules
          ask for ("keep conversations in the in-app chat — it protects both
          sides if something goes wrong") and what leaves a record if the visit
          is ever disputed. A phone call leaves no trace we can show anyone.
          Accept below is the BLACK CTA for the same reason it was before this
          redesign (.claude/ui-ux.md's dark accent): one green and one black
          read as two different jobs, where two greens read as a repeat. */}
      <View style={styles.contactRow}>
        {!!appt.contactNumber && (
          <Pressable
            style={styles.contactButton}
            onPress={() => Linking.openURL(`tel:${appt.contactNumber}`)}
            accessibilityRole="button"
            accessibilityLabel={`Call ${personName(appt.tenant)} on ${appt.contactNumber}`}
          >
            <Icon name="phone" size={15} color={colors.slate700} />
            <Text style={styles.contactButtonText}>Call</Text>
          </Pressable>
        )}
        <Pressable
          style={[styles.contactButton, styles.contactButtonSolid, chatting && styles.busy]}
          onPress={onChat}
          disabled={chatting}
          accessibilityRole="button"
          accessibilityLabel={`Message ${personName(appt.tenant)}`}
          accessibilityState={{ disabled: chatting, busy: chatting }}
        >
          {chatting
            ? <ActivityIndicator size="small" color={colors.white} />
            : <Icon name="messageCircle" size={15} color={colors.white} />}
          <Text style={[styles.contactButtonText, styles.contactButtonTextSolid]}>Chat</Text>
        </Pressable>
      </View>

      {!!appt.message && (
        <Text style={styles.note}><Text style={styles.noteLabel}>Note: </Text>{appt.message}</Text>
      )}
      {!!appt.ownerNote && (
        <Text style={styles.replyNote}><Text style={styles.replyNoteLabel}>Your reply: </Text>{appt.ownerNote}</Text>
      )}

      {isPending && !rejecting && (
        <View style={styles.actionRow}>
          <Pressable
            style={[styles.acceptButton, busy && styles.busy]}
            onPress={() => onAction(appt.id, 'ACCEPTED')}
            disabled={busy}
            accessibilityRole="button"
            accessibilityLabel={`Accept ${personName(appt.tenant)}'s visit`}
          >
            <Icon name="check" size={15} color={colors.white} />
            <Text style={styles.acceptButtonText}>Accept</Text>
          </Pressable>
          <Pressable
            style={[styles.rejectButton, busy && styles.busy]}
            onPress={() => setRejecting(true)}
            disabled={busy}
            accessibilityRole="button"
            accessibilityLabel={`Decline ${personName(appt.tenant)}'s visit`}
          >
            <Text style={styles.rejectButtonText}>Decline</Text>
          </Pressable>
        </View>
      )}

      {isPending && rejecting && (
        <View style={styles.rejectBlock}>
          <TextInput
            style={styles.rejectInput}
            placeholder="Reason (optional) — they will see this"
            placeholderTextColor={colors.slate500}
            value={note}
            onChangeText={setNote}
            multiline
          />
          <View style={styles.actionRow}>
            <Pressable
              style={styles.cancelButton}
              onPress={() => { setRejecting(false); setNote('') }}
              accessibilityRole="button"
              accessibilityLabel="Keep the request"
            >
              <Text style={styles.cancelButtonText}>Keep it</Text>
            </Pressable>
            <Pressable
              style={styles.confirmRejectButton}
              onPress={() => onAction(appt.id, 'REJECTED', note || undefined)}
              accessibilityRole="button"
              accessibilityLabel="Confirm decline"
            >
              <Text style={styles.acceptButtonText}>Decline visit</Text>
            </Pressable>
          </View>
        </View>
      )}
    </View>
  )
}

function TenantCard({ appt }) {
  const past = bucketFor(appt.requestedDate) === 'Past'
  return (
    <View style={styles.card}>
      <View style={styles.statusCorner}><StatusPill status={appt.status} /></View>

      <View style={styles.cardTop}>
        <DateBlock iso={appt.requestedDate} muted={past} />
        <View style={styles.cardTopBody}>
          <Text style={styles.person} numberOfLines={1}>{appt.property?.title ?? 'Property'}</Text>
          <Text style={styles.time}>{formatTime(appt.requestedTime)}</Text>
        </View>
      </View>

      {!!appt.property?.city && <PropertyLine property={appt.property} />}

      {!!appt.message && (
        <Text style={styles.note}><Text style={styles.noteLabel}>Your note: </Text>{appt.message}</Text>
      )}
      {!!appt.ownerNote && (
        <Text style={styles.replyNote}><Text style={styles.replyNoteLabel}>Owner reply: </Text>{appt.ownerNote}</Text>
      )}
    </View>
  )
}

function FilterChips({ value, onChange, counts }) {
  return (
    <View style={styles.chipRow}>
      {OWNER_FILTERS.map(([key, label]) => {
        const active = key === value
        const count = counts[key] ?? 0
        return (
          <Pressable
            key={key}
            style={[styles.chip, active && styles.chipActive]}
            onPress={() => onChange(key)}
            hitSlop={{ top: 8, bottom: 8 }}
            accessibilityRole="button"
            accessibilityLabel={`${label}, ${count}`}
            accessibilityState={{ selected: active }}
          >
            <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
            {count > 0 && (
              <Text style={[styles.chipCount, active && styles.chipCountActive]}>{count}</Text>
            )}
          </Pressable>
        )
      })}
    </View>
  )
}

function EmptyState({ title, message }) {
  return (
    <View style={styles.empty}>
      <View style={styles.emptyIcon}>
        <Icon name="calendar" size={22} color={colors.brand600} />
      </View>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyBody}>{message}</Text>
    </View>
  )
}

export default function AppointmentsScreen({ navigation, route }) {
  const qc = useQueryClient()

  // Fixed by which nav stack registered this screen, not a user-facing
  // toggle — host mode's Appointments tab always means "incoming for my
  // properties", renter mode's Profile > Appointments always means "my own
  // visit requests". A user who is both can already switch between these
  // via the renter/host mode toggle itself, so a second toggle in here
  // would just duplicate that.
  const isIncoming = route?.params?.initialTab === 'incoming'
  const hostMode = useUiStore((s) => s.hostMode)
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

  // startWithTenant is idempotent server-side — it returns the existing thread
  // for this (property, tenant) pair rather than making a second one.
  const [chattingId, setChattingId] = useState(null)
  async function openChat(appt) {
    if (!appt.property?.id || !appt.tenant?.id) return
    setChattingId(appt.id)
    try {
      await chatService.startWithTenant(appt.property.id, appt.tenant.id)
      qc.invalidateQueries({ queryKey: ['conversations'] })
      // The chat tab is 'Inbox' in host mode and 'Chat' in renter mode — the
      // same branch every other cross-tab jump makes (navigationRef.js,
      // AppointmentForm). Hardcoding either name breaks in the other mode.
      navigation.getParent()?.navigate(hostMode ? 'Inbox' : 'Chat')
    } catch {
      Alert.alert('Couldn’t open the chat', 'Please try again in a moment.')
    } finally {
      setChattingId(null)
    }
  }

  const counts = useMemo(() => {
    const c = { all: ownerAppts.length }
    for (const a of ownerAppts) c[a.status] = (c[a.status] ?? 0) + 1
    return c
  }, [ownerAppts])

  const pendingCount = counts.PENDING ?? 0
  const source = isIncoming
    ? (filter === 'all' ? ownerAppts : ownerAppts.filter((a) => a.status === filter))
    : myAppts
  const sections = useMemo(() => groupByDay(source), [source])

  const isLoading = isIncoming ? loadingOwner : loadingMine
  const isError = isIncoming ? errorOwner : errorMine
  const refetch = isIncoming ? refetchOwner : refetchMine

  // "2 waiting on you" is the whole job of this screen for a host; a renter is
  // told how many visits are actually booked, not how many rows exist.
  const subtitle = isIncoming
    ? (pendingCount > 0
      ? `${pendingCount} waiting on you`
      : 'Visit requests for your properties')
    : 'Visits you’ve requested'

  return (
    <SafeAreaView style={styles.container} edges={[]}>
      <ScreenHeader
        title="Visits"
        subtitle={subtitle}
        onBack={navigation.canGoBack() ? () => navigation.goBack() : undefined}
        // In the header block, not the list: as a ListHeaderComponent the
        // chips scrolled away the moment you started reading, which is exactly
        // when you want to change the filter, and on the canvas they read as a
        // stray row floating between the header and the first section.
        below={
          isIncoming && ownerAppts.length > 0
            ? <FilterChips value={filter} onChange={setFilter} counts={counts} />
            : null
        }
      />

      {isLoading ? (
        <View style={styles.center}><ActivityIndicator color={colors.brand600} /></View>
      ) : isError ? (
        <ErrorState title="Couldn't load visits" onRetry={refetch} />
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          stickySectionHeadersEnabled={false}
          renderSectionHeader={({ section }) => (
            <Text style={styles.sectionHeader}>{section.title}</Text>
          )}
          ListEmptyComponent={
            isIncoming ? (
              <EmptyState
                title={filter === 'all' ? 'No visit requests yet' : 'Nothing here'}
                message={filter === 'all'
                  ? 'When someone asks to see one of your listings, it lands here.'
                  : 'No requests with that status — try All.'}
              />
            ) : (
              <EmptyState
                title="No visits booked"
                message="Ask to see a place from its listing and it will show up here."
              />
            )
          }
          renderItem={({ item }) => (
            isIncoming
              ? <OwnerCard
                appt={item}
                busy={mutation.isPending}
                chatting={chattingId === item.id}
                onChat={() => openChat(item)}
                onAction={(id, status, ownerNote) => mutation.mutate({ id, status, ownerNote })}
              />
              : <TenantCard appt={item} />
          )}
        />
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.slate50 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: { padding: spacing.md, paddingBottom: spacing.xxl },

  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 5, minHeight: 32,
    paddingHorizontal: spacing.md, borderRadius: radius.full,
    borderWidth: 1, borderColor: colors.slate200, backgroundColor: colors.white,
  },
  chipActive: { backgroundColor: colors.slate800, borderColor: colors.slate800 },
  chipText: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.xs, color: colors.slate600 },
  chipTextActive: { color: colors.white },
  chipCount: { fontFamily: fonts.bodySemiBold, fontSize: 11, color: colors.slate500 },
  chipCountActive: { color: 'rgba(255,255,255,0.75)' },

  sectionHeader: {
    fontFamily: fonts.bodySemiBold, fontSize: 11, color: colors.slate500,
    textTransform: 'uppercase', letterSpacing: 0.6,
    marginBottom: spacing.sm,
  },

  card: {
    backgroundColor: colors.white, borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.slate200,
    padding: spacing.md, marginBottom: spacing.sm, gap: spacing.sm,
  },
  statusCorner: { position: 'absolute', top: spacing.md, right: spacing.md, zIndex: 1 },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingRight: 96 },
  contactRow: { flexDirection: 'row', gap: spacing.sm },
  contactButton: {
    flex: 1, minHeight: 44, flexDirection: 'row', gap: 6,
    alignItems: 'center', justifyContent: 'center',
    borderRadius: radius.md, borderWidth: 1, borderColor: colors.slate200, backgroundColor: colors.white,
  },
  contactButtonSolid: { backgroundColor: colors.brand600, borderColor: colors.brand600 },
  contactButtonText: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.sm, color: colors.slate700 },
  contactButtonTextSolid: { color: colors.white },
  cardTopBody: { flex: 1, minWidth: 0, gap: 3, alignItems: 'flex-start' },

  // The tear-off date. Fixed width so every card's content starts on the same
  // vertical line — a list that ripples left and right is hard to scan.
  dateBlock: {
    width: 56, paddingVertical: spacing.sm, borderRadius: radius.md,
    backgroundColor: colors.brand50, alignItems: 'center',
  },
  dateBlockMuted: { backgroundColor: colors.slate100 },
  dateWeekday: { fontFamily: fonts.bodySemiBold, fontSize: 11, color: colors.brand700, letterSpacing: 0.5 },
  dateDay: { fontFamily: fonts.displayBold, fontSize: fontSizes.xxl, color: colors.brand700, lineHeight: 28 },
  dateMonth: { fontFamily: fonts.body, fontSize: 11, color: colors.brand700 },
  dateMutedText: { color: colors.slate500 },

  person: { fontFamily: fonts.displayBold, fontSize: fontSizes.base, color: colors.slate900 },
  time: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.sm, color: colors.slate600 },

  statusPill: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: spacing.sm, paddingVertical: 3, borderRadius: radius.full },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontFamily: fonts.bodySemiBold, fontSize: 11 },

  propertyRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    backgroundColor: colors.slate50, borderRadius: radius.md, padding: spacing.sm,
  },
  propertyThumb: { width: 40, height: 40, borderRadius: radius.sm, backgroundColor: colors.slate200 },
  propertyThumbEmpty: { alignItems: 'center', justifyContent: 'center' },
  propertyTitle: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.sm, color: colors.slate800 },
  propertySub: { fontFamily: fonts.body, fontSize: fontSizes.xs, color: colors.slate500, marginTop: 1 },

  phoneText: { fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.slate500 },

  note: { fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.slate600, lineHeight: 20 },
  noteLabel: { fontFamily: fonts.bodySemiBold, color: colors.slate800 },
  replyNote: { fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.brand700, lineHeight: 20 },
  replyNoteLabel: { fontFamily: fonts.bodySemiBold, color: colors.brand700 },

  actionRow: { flexDirection: 'row', gap: spacing.sm },
  busy: { opacity: 0.6 },
  acceptButton: {
    flex: 1, minHeight: 48, flexDirection: 'row', gap: 6,
    backgroundColor: colors.black, borderRadius: radius.md,
    alignItems: 'center', justifyContent: 'center',
  },
  acceptButtonText: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.sm, color: colors.white },
  rejectButton: {
    flex: 1, minHeight: 48, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.slate200, backgroundColor: colors.white,
    alignItems: 'center', justifyContent: 'center',
  },
  rejectButtonText: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.sm, color: colors.slate700 },
  rejectBlock: { gap: spacing.sm },
  rejectInput: {
    borderWidth: 1, borderColor: colors.slate200, borderRadius: radius.md, padding: spacing.sm,
    fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.slate800,
    minHeight: 64, textAlignVertical: 'top',
  },
  cancelButton: {
    flex: 1, minHeight: 48, backgroundColor: colors.slate100, borderRadius: radius.md,
    alignItems: 'center', justifyContent: 'center',
  },
  cancelButtonText: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.sm, color: colors.slate700 },
  confirmRejectButton: {
    flex: 1, minHeight: 48, backgroundColor: colors.danger, borderRadius: radius.md,
    alignItems: 'center', justifyContent: 'center',
  },

  empty: { alignItems: 'center', paddingVertical: spacing.xxl, gap: spacing.xs },
  emptyIcon: {
    width: 52, height: 52, borderRadius: radius.full, backgroundColor: colors.brand50,
    alignItems: 'center', justifyContent: 'center', marginBottom: spacing.sm,
  },
  emptyTitle: { fontFamily: fonts.displayBold, fontSize: fontSizes.lg, color: colors.slate800 },
  emptyBody: { fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.slate500, textAlign: 'center', maxWidth: 260, lineHeight: 20 },
})
