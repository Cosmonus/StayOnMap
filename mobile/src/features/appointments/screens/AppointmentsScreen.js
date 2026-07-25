import { useState } from 'react'
import { View, Text, TextInput, Pressable, FlatList, Modal, ActivityIndicator, StyleSheet } from 'react-native'
import { Image } from 'expo-image'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { appointmentService } from '@services/appointment.service'
import { imgUrl } from '@utils/format'
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

function shortDate(iso) {
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
}

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

function OwnerCard({ appt, onAction, onOpenProperty }) {
  const [rejecting, setRejecting] = useState(false)
  const [note, setNote] = useState('')
  const isPending = appt.status === 'PENDING'
  const thumb = appt.property?.images?.[0]?.url

  return (
    <View style={styles.card}>
      <View style={styles.cardHeaderRow}>
        <View style={styles.personRow}>
          <View style={styles.avatar}>
            {appt.tenant?.avatarUrl ? (
              <Image source={{ uri: imgUrl(appt.tenant.avatarUrl) }} style={styles.avatarImg} contentFit="cover" cachePolicy="memory-disk" transition={200} />
            ) : (
              <Text style={styles.avatarInitial}>{personName(appt.tenant)[0]?.toUpperCase()}</Text>
            )}
          </View>
          <View style={{ flexShrink: 1 }}>
            <Text style={styles.personName} numberOfLines={1}>{personName(appt.tenant)}</Text>
            <View style={styles.personSubRow}>
              <Icon name="phone" size={10} color={colors.slate500} />
              <Text style={styles.personSub}>{appt.contactNumber}</Text>
            </View>
          </View>
        </View>
        <StatusPill status={appt.status} />
      </View>

      <Pressable
        style={styles.propertyRow}
        onPress={() => appt.property?.id && onOpenProperty?.(appt.property.id)}
        disabled={!appt.property?.id}
        accessibilityRole="button"
        accessibilityLabel={`Open ${appt.property?.title ?? 'property'}`}
      >
        {thumb ? <Image source={{ uri: imgUrl(thumb) }} style={styles.propertyThumb} contentFit="cover" cachePolicy="memory-disk" transition={200} /> : <View style={styles.propertyThumb} />}
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.propertyTitle} numberOfLines={1}>{appt.property?.title ?? 'Property'}</Text>
          <Text style={styles.propertySub}>{appt.property?.city}</Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={styles.dateText}>{shortDate(appt.requestedDate)}</Text>
          <Text style={styles.propertySub}>{appt.requestedTime}</Text>
        </View>
      </Pressable>

      {!!appt.message && <Text style={styles.note}><Text style={styles.noteLabel}>Note: </Text>{appt.message}</Text>}
      {!!appt.ownerNote && <Text style={styles.replyNote}><Text style={styles.replyNoteLabel}>Your reply: </Text>{appt.ownerNote}</Text>}

      {isPending && !rejecting && (
        <View style={styles.actionRow}>
          <Pressable style={styles.acceptButton} onPress={() => onAction(appt.id, 'ACCEPTED')} accessibilityRole="button" accessibilityLabel="Accept appointment">
            <Icon name="check" size={14} color={colors.white} />
            <Text style={styles.acceptButtonText}>Accept</Text>
          </Pressable>
          <Pressable style={styles.rejectButton} onPress={() => setRejecting(true)} accessibilityRole="button" accessibilityLabel="Reject appointment">
            <Icon name="close" size={14} color="#DC2626" />
            <Text style={styles.rejectButtonText}>Reject</Text>
          </Pressable>
        </View>
      )}

      {isPending && rejecting && (
        <View style={{ gap: spacing.xs }}>
          <TextInput
            style={styles.rejectInput}
            placeholder="Reason (optional)"
            placeholderTextColor={colors.slate500}
            value={note}
            onChangeText={setNote}
            multiline
          />
          <View style={styles.actionRow}>
            <Pressable style={styles.cancelButton} onPress={() => { setRejecting(false); setNote('') }} accessibilityRole="button" accessibilityLabel="Cancel rejection">
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </Pressable>
            <Pressable style={styles.confirmRejectButton} onPress={() => onAction(appt.id, 'REJECTED', note || undefined)} accessibilityRole="button" accessibilityLabel="Confirm rejection">
              <Text style={styles.acceptButtonText}>Confirm</Text>
            </Pressable>
          </View>
        </View>
      )}
    </View>
  )
}

function TenantCard({ appt, onOpenProperty }) {
  const thumb = appt.property?.images?.[0]?.url
  return (
    <View style={styles.card}>
      <Pressable
        style={styles.propertyRow}
        onPress={() => appt.property?.id && onOpenProperty?.(appt.property.id)}
        disabled={!appt.property?.id}
        accessibilityRole="button"
        accessibilityLabel={`Open ${appt.property?.title ?? 'property'}`}
      >
        {thumb ? <Image source={{ uri: imgUrl(thumb) }} style={styles.propertyThumb} contentFit="cover" cachePolicy="memory-disk" transition={200} /> : <View style={styles.propertyThumb} />}
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.propertyTitle} numberOfLines={1}>{appt.property?.title ?? 'Property'}</Text>
          <Text style={styles.propertySub}>{appt.property?.city}</Text>
        </View>
        <StatusPill status={appt.status} />
      </Pressable>
      <View style={styles.dateRow}>
        <Text style={styles.dateText}>{shortDate(appt.requestedDate)}</Text>
        <Text style={styles.dateText}>{appt.requestedTime}</Text>
      </View>
      {!!appt.message && <Text style={styles.note}><Text style={styles.noteLabel}>Your note: </Text>{appt.message}</Text>}
      {!!appt.ownerNote && <Text style={styles.replyNote}><Text style={styles.replyNoteLabel}>Owner reply: </Text>{appt.ownerNote}</Text>}
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
  const isLoading = isIncoming ? loadingOwner : loadingMine
  const isError = isIncoming ? errorOwner : errorMine
  const refetch = isIncoming ? refetchOwner : refetchMine

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScreenHeader title={`Appointments${isIncoming && pendingCount > 0 ? ` (${pendingCount})` : ''}`} />

      {isLoading ? (
        <View style={styles.center}><ActivityIndicator color={colors.brand600} /></View>
      ) : isError ? (
        <ErrorState title="Couldn't load appointments" onRetry={refetch} />
      ) : isIncoming ? (
        <FlatList
          data={filteredOwner}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          ListHeaderComponent={
            <View style={styles.filterRow}>
              <FilterDropdown value={filter} options={OWNER_FILTERS} onChange={setFilter} />
            </View>
          }
          ListEmptyComponent={<EmptyState message="Tenant visit requests will appear here." />}
          renderItem={({ item }) => (
            <OwnerCard appt={item} onAction={(id, status, ownerNote) => mutation.mutate({ id, status, ownerNote })} onOpenProperty={openProperty} />
          )}
        />
      ) : (
        <FlatList
          data={myAppts}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
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
  filterRow: { marginBottom: spacing.md, alignItems: 'flex-start' },
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
  card: { backgroundColor: colors.white, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.slate100, padding: spacing.md, marginBottom: spacing.sm },
  cardHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm },
  personRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexShrink: 1 },
  avatar: { width: 32, height: 32, borderRadius: radius.full, backgroundColor: colors.slate800, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  avatarImg: { width: '100%', height: '100%' },
  avatarInitial: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.xs, color: colors.white },
  personName: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.sm, color: colors.slate800 },
  personSubRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  personSub: { fontFamily: fonts.body, fontSize: 11, color: colors.slate500 },
  statusPill: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: spacing.sm, paddingVertical: 3, borderRadius: radius.full },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontFamily: fonts.bodySemiBold, fontSize: 11 },
  propertyRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.slate50, borderRadius: radius.md, padding: spacing.sm, marginBottom: spacing.sm },
  propertyThumb: { width: 36, height: 36, borderRadius: radius.sm, backgroundColor: colors.slate200 },
  propertyTitle: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.xs, color: colors.slate700 },
  propertySub: { fontFamily: fonts.body, fontSize: 11, color: colors.slate500 },
  dateText: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.xs, color: colors.slate700 },
  dateRow: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.sm },
  note: { fontFamily: fonts.body, fontSize: fontSizes.xs, color: colors.slate500, marginBottom: spacing.sm, lineHeight: 18 },
  noteLabel: { fontFamily: fonts.bodyMedium, color: colors.slate500 },
  replyNote: { fontFamily: fonts.body, fontSize: fontSizes.xs, color: '#2563EB', marginBottom: spacing.sm, lineHeight: 18 },
  replyNoteLabel: { fontFamily: fonts.bodyMedium, color: '#60A5FA' },
  actionRow: { flexDirection: 'row', gap: spacing.sm },
  acceptButton: { flex: 1, minHeight: 44, flexDirection: 'row', gap: 5, backgroundColor: colors.black, borderRadius: radius.md, paddingVertical: spacing.sm, alignItems: 'center', justifyContent: 'center' },
  acceptButtonText: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.xs, color: colors.white },
  rejectButton: { flex: 1, minHeight: 44, flexDirection: 'row', gap: 5, backgroundColor: colors.danger50, borderRadius: radius.md, paddingVertical: spacing.sm, alignItems: 'center', justifyContent: 'center' },
  rejectButtonText: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.xs, color: '#DC2626' },
  rejectInput: { borderWidth: 1, borderColor: colors.slate200, borderRadius: radius.md, padding: spacing.sm, fontFamily: fonts.body, fontSize: fontSizes.xs, color: colors.slate800, minHeight: 48, textAlignVertical: 'top' },
  cancelButton: { flex: 1, minHeight: 44, backgroundColor: colors.slate100, borderRadius: radius.md, paddingVertical: spacing.sm, alignItems: 'center', justifyContent: 'center' },
  cancelButtonText: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.xs, color: colors.slate600 },
  confirmRejectButton: { flex: 1, minHeight: 44, backgroundColor: colors.danger, borderRadius: radius.md, paddingVertical: spacing.sm, alignItems: 'center', justifyContent: 'center' },
  empty: { alignItems: 'center', paddingVertical: spacing.xxl },
  emptyIcon: { width: 48, height: 48, borderRadius: radius.full, backgroundColor: colors.slate100, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.sm },
  emptyTitle: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.sm, color: colors.slate700 },
  emptyBody: { fontFamily: fonts.body, fontSize: fontSizes.xs, color: colors.slate500, marginTop: 2, textAlign: 'center', maxWidth: 240 },
})
