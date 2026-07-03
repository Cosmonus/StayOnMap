import { useState } from 'react'
import { View, Text, Image, TextInput, Pressable, FlatList, Modal, ActivityIndicator, StyleSheet } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { appointmentService } from '@services/appointment.service'
import { authService } from '@services/auth.service'
import { useAuth } from '@features/auth/hooks/useAuth'
import { imgUrl } from '@utils/format'
import Icon from '@components/common/Icon'
import { colors } from '@theme/colors'
import { fonts, fontSizes } from '@theme/typography'
import { spacing, radius } from '@theme/spacing'

const STATUS = {
  PENDING: { bg: '#FFFBEB', text: '#B45309', dot: '#FBBF24', label: 'Pending' },
  ACCEPTED: { bg: '#F0FDF4', text: '#15803D', dot: '#4ADE80', label: 'Accepted' },
  REJECTED: { bg: '#FEF2F2', text: '#DC2626', dot: '#F87171', label: 'Rejected' },
  RESCHEDULED: { bg: colors.brand50, text: colors.brand700, dot: colors.brand500, label: 'Rescheduled' },
  CANCELLED: { bg: colors.slate50, text: colors.slate600, dot: colors.slate400, label: 'Cancelled' },
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
      <Pressable style={styles.filterTrigger} onPress={() => setOpen(true)}>
        <Text style={styles.filterTriggerText}>{selected?.[1] ?? 'All'}</Text>
        <Icon name="chevronDown" size={14} color={colors.slate500} />
      </Pressable>

      <Modal visible={open} animationType="slide" transparent onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.dropdownBackdrop} onPress={() => setOpen(false)}>
          <Pressable style={styles.dropdownSheet} onPress={(e) => e.stopPropagation()}>
            <View style={styles.dropdownSheetHeader}>
              <Text style={styles.dropdownSheetTitle}>Filter by status</Text>
              <Pressable onPress={() => setOpen(false)} hitSlop={8}>
                <Icon name="close" size={18} color={colors.slate400} />
              </Pressable>
            </View>
            <FlatList
              data={options}
              keyExtractor={([key]) => key}
              ItemSeparatorComponent={() => <View style={styles.dropdownSeparator} />}
              renderItem={({ item: [key, label] }) => (
                <Pressable style={styles.dropdownOption} onPress={() => { onChange(key); setOpen(false) }}>
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

function OwnerCard({ appt, onAction }) {
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
              <Image source={{ uri: imgUrl(appt.tenant.avatarUrl) }} style={styles.avatarImg} />
            ) : (
              <Text style={styles.avatarInitial}>{personName(appt.tenant)[0]?.toUpperCase()}</Text>
            )}
          </View>
          <View style={{ flexShrink: 1 }}>
            <Text style={styles.personName} numberOfLines={1}>{personName(appt.tenant)}</Text>
            <View style={styles.personSubRow}>
              <Icon name="phone" size={10} color={colors.slate400} />
              <Text style={styles.personSub}>{appt.contactNumber}</Text>
            </View>
          </View>
        </View>
        <StatusPill status={appt.status} />
      </View>

      <View style={styles.propertyRow}>
        {thumb ? <Image source={{ uri: imgUrl(thumb) }} style={styles.propertyThumb} /> : <View style={styles.propertyThumb} />}
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.propertyTitle} numberOfLines={1}>{appt.property?.title ?? 'Property'}</Text>
          <Text style={styles.propertySub}>{appt.property?.city}</Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={styles.dateText}>{shortDate(appt.requestedDate)}</Text>
          <Text style={styles.propertySub}>{appt.requestedTime}</Text>
        </View>
      </View>

      {!!appt.message && <Text style={styles.note}><Text style={styles.noteLabel}>Note: </Text>{appt.message}</Text>}
      {!!appt.ownerNote && <Text style={styles.replyNote}><Text style={styles.replyNoteLabel}>Your reply: </Text>{appt.ownerNote}</Text>}

      {isPending && !rejecting && (
        <View style={styles.actionRow}>
          <Pressable style={styles.acceptButton} onPress={() => onAction(appt.id, 'ACCEPTED')}>
            <Icon name="check" size={14} color={colors.white} />
            <Text style={styles.acceptButtonText}>Accept</Text>
          </Pressable>
          <Pressable style={styles.rejectButton} onPress={() => setRejecting(true)}>
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
            placeholderTextColor={colors.slate400}
            value={note}
            onChangeText={setNote}
            multiline
          />
          <View style={styles.actionRow}>
            <Pressable style={styles.cancelButton} onPress={() => { setRejecting(false); setNote('') }}>
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </Pressable>
            <Pressable style={styles.confirmRejectButton} onPress={() => onAction(appt.id, 'REJECTED', note || undefined)}>
              <Text style={styles.acceptButtonText}>Confirm</Text>
            </Pressable>
          </View>
        </View>
      )}
    </View>
  )
}

function TenantCard({ appt }) {
  const thumb = appt.property?.images?.[0]?.url
  return (
    <View style={styles.card}>
      <View style={styles.propertyRow}>
        {thumb ? <Image source={{ uri: imgUrl(thumb) }} style={styles.propertyThumb} /> : <View style={styles.propertyThumb} />}
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.propertyTitle} numberOfLines={1}>{appt.property?.title ?? 'Property'}</Text>
          <Text style={styles.propertySub}>{appt.property?.city}</Text>
        </View>
        <StatusPill status={appt.status} />
      </View>
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
        <Icon name="calendar" size={22} color={colors.slate400} />
      </View>
      <Text style={styles.emptyTitle}>No appointments</Text>
      <Text style={styles.emptyBody}>{message}</Text>
    </View>
  )
}

export default function AppointmentsScreen({ navigation }) {
  const { user } = useAuth()
  const qc = useQueryClient()

  const { data: profile } = useQuery({
    queryKey: ['me'],
    queryFn: () => authService.getMe().then((r) => r.data),
    enabled: !!user,
  })
  const isOwner = profile?.role === 'OWNER'

  const [tab, setTab] = useState('my-requests')
  const [filter, setFilter] = useState('all')

  const { data: ownerAppts = [], isLoading: loadingOwner } = useQuery({
    queryKey: ['owner-appointments'],
    queryFn: () => appointmentService.owner().then((r) => r.data),
    enabled: isOwner,
  })

  const { data: myAppts = [], isLoading: loadingMine } = useQuery({
    queryKey: ['my-appointments'],
    queryFn: () => appointmentService.mine().then((r) => r.data),
  })

  const mutation = useMutation({
    mutationFn: ({ id, status, ownerNote }) => appointmentService.updateStatus(id, { status, ownerNote }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['owner-appointments'] }),
  })

  const activeTab = isOwner ? tab : 'my-requests'
  const pendingCount = ownerAppts.filter((a) => a.status === 'PENDING').length
  const filteredOwner = filter === 'all' ? ownerAppts : ownerAppts.filter((a) => a.status === filter)
  const isLoading = loadingOwner || loadingMine

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <View style={styles.headerTopRow}>
          <Pressable onPress={() => navigation.goBack()} hitSlop={8}>
            <Icon name="chevronLeft" size={20} color={colors.slate800} />
          </Pressable>
          <View style={styles.headerTitleRow}>
            <Icon name="calendar" size={20} color={colors.slate800} />
            <Text style={styles.headerTitle}>Appointments</Text>
          </View>
        </View>
        <Text style={styles.headerSub}>Manage incoming requests and track your visits</Text>
      </View>

      {isOwner && (
        <View style={styles.tabRow}>
          <Pressable style={[styles.tabButton, activeTab === 'incoming' && styles.tabButtonActive]} onPress={() => setTab('incoming')}>
            <Text style={[styles.tabButtonText, activeTab === 'incoming' && styles.tabButtonTextActive]}>
              Incoming{pendingCount > 0 ? ` (${pendingCount})` : ''}
            </Text>
          </Pressable>
          <Pressable style={[styles.tabButton, activeTab === 'my-requests' && styles.tabButtonActive]} onPress={() => setTab('my-requests')}>
            <Text style={[styles.tabButtonText, activeTab === 'my-requests' && styles.tabButtonTextActive]}>My Requests</Text>
          </Pressable>
        </View>
      )}

      {isLoading ? (
        <View style={styles.center}><ActivityIndicator color={colors.brand600} /></View>
      ) : activeTab === 'incoming' ? (
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
            <OwnerCard appt={item} onAction={(id, status, ownerNote) => mutation.mutate({ id, status, ownerNote })} />
          )}
        />
      ) : (
        <FlatList
          data={myAppts}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={<EmptyState message="Appointments you've requested will appear here." />}
          renderItem={({ item }) => <TenantCard appt={item} />}
        />
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.slate50 },
  header: { paddingHorizontal: spacing.lg, paddingTop: spacing.md },
  headerTopRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  headerTitleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  headerTitle: { fontFamily: fonts.displayBold, fontSize: fontSizes.xl, color: colors.slate800 },
  headerSub: { fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.slate400, marginTop: 2 },
  tabRow: { flexDirection: 'row', gap: 4, backgroundColor: colors.slate100, borderRadius: radius.md, padding: 4, margin: spacing.lg, alignSelf: 'flex-start' },
  tabButton: { paddingHorizontal: spacing.md, paddingVertical: spacing.xs + 2, borderRadius: radius.sm },
  tabButtonActive: { backgroundColor: colors.white },
  tabButtonText: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.xs, color: colors.slate600 },
  tabButtonTextActive: { color: colors.slate800 },
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
  dropdownSheet: { backgroundColor: colors.white, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, maxHeight: '70%' },
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
  personSub: { fontFamily: fonts.body, fontSize: 11, color: colors.slate400 },
  statusPill: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: spacing.sm, paddingVertical: 3, borderRadius: radius.full },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontFamily: fonts.bodySemiBold, fontSize: 11 },
  propertyRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.slate50, borderRadius: radius.md, padding: spacing.sm, marginBottom: spacing.sm },
  propertyThumb: { width: 36, height: 36, borderRadius: radius.sm, backgroundColor: colors.slate200 },
  propertyTitle: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.xs, color: colors.slate700 },
  propertySub: { fontFamily: fonts.body, fontSize: 11, color: colors.slate400 },
  dateText: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.xs, color: colors.slate700 },
  dateRow: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.sm },
  note: { fontFamily: fonts.body, fontSize: fontSizes.xs, color: colors.slate500, marginBottom: spacing.sm, lineHeight: 18 },
  noteLabel: { fontFamily: fonts.bodyMedium, color: colors.slate400 },
  replyNote: { fontFamily: fonts.body, fontSize: fontSizes.xs, color: '#2563EB', marginBottom: spacing.sm, lineHeight: 18 },
  replyNoteLabel: { fontFamily: fonts.bodyMedium, color: '#60A5FA' },
  actionRow: { flexDirection: 'row', gap: spacing.sm },
  acceptButton: { flex: 1, flexDirection: 'row', gap: 5, backgroundColor: '#111111', borderRadius: radius.md, paddingVertical: spacing.sm, alignItems: 'center', justifyContent: 'center' },
  acceptButtonText: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.xs, color: colors.white },
  rejectButton: { flex: 1, flexDirection: 'row', gap: 5, backgroundColor: '#FEF2F2', borderRadius: radius.md, paddingVertical: spacing.sm, alignItems: 'center', justifyContent: 'center' },
  rejectButtonText: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.xs, color: '#DC2626' },
  rejectInput: { borderWidth: 1, borderColor: colors.slate200, borderRadius: radius.md, padding: spacing.sm, fontFamily: fonts.body, fontSize: fontSizes.xs, color: colors.slate800, minHeight: 48, textAlignVertical: 'top' },
  cancelButton: { flex: 1, backgroundColor: colors.slate100, borderRadius: radius.md, paddingVertical: spacing.sm, alignItems: 'center' },
  cancelButtonText: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.xs, color: colors.slate600 },
  confirmRejectButton: { flex: 1, backgroundColor: colors.danger, borderRadius: radius.md, paddingVertical: spacing.sm, alignItems: 'center' },
  empty: { alignItems: 'center', paddingVertical: spacing.xxl },
  emptyIcon: { width: 48, height: 48, borderRadius: radius.full, backgroundColor: colors.slate100, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.sm },
  emptyTitle: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.sm, color: colors.slate700 },
  emptyBody: { fontFamily: fonts.body, fontSize: fontSizes.xs, color: colors.slate400, marginTop: 2, textAlign: 'center', maxWidth: 240 },
})
