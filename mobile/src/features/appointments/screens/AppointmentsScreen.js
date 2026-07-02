import { useState } from 'react'
import { View, Text, Image, TextInput, Pressable, FlatList, ActivityIndicator, StyleSheet } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { appointmentService } from '@services/appointment.service'
import { authService } from '@services/auth.service'
import { useAuth } from '@features/auth/hooks/useAuth'
import { imgUrl } from '@utils/format'
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
            <Text style={styles.personSub}>{appt.contactNumber}</Text>
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
            <Text style={styles.acceptButtonText}>Accept</Text>
          </Pressable>
          <Pressable style={styles.rejectButton} onPress={() => setRejecting(true)}>
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
      <Text style={styles.emptyTitle}>No appointments</Text>
      <Text style={styles.emptyBody}>{message}</Text>
    </View>
  )
}

export default function AppointmentsScreen() {
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
        <Text style={styles.headerTitle}>Appointments</Text>
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
              {OWNER_FILTERS.map(([key, label]) => (
                <Pressable key={key} style={[styles.filterChip, filter === key && styles.filterChipActive]} onPress={() => setFilter(key)}>
                  <Text style={[styles.filterChipText, filter === key && styles.filterChipTextActive]}>{label}</Text>
                </Pressable>
              ))}
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
  headerTitle: { fontFamily: fonts.displayBold, fontSize: fontSizes.xl, color: colors.slate800 },
  headerSub: { fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.slate400, marginTop: 2 },
  tabRow: { flexDirection: 'row', gap: 4, backgroundColor: colors.slate100, borderRadius: radius.md, padding: 4, margin: spacing.lg, alignSelf: 'flex-start' },
  tabButton: { paddingHorizontal: spacing.md, paddingVertical: spacing.xs + 2, borderRadius: radius.sm },
  tabButtonActive: { backgroundColor: colors.white },
  tabButtonText: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.xs, color: colors.slate600 },
  tabButtonTextActive: { color: colors.slate800 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: { padding: spacing.lg, gap: spacing.md },
  filterRow: { flexDirection: 'row', gap: spacing.xs, marginBottom: spacing.md },
  filterChip: { paddingHorizontal: spacing.md, paddingVertical: 6, borderRadius: radius.md },
  filterChipActive: { backgroundColor: '#111111' },
  filterChipText: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.xs, color: colors.slate500 },
  filterChipTextActive: { color: colors.white },
  card: { backgroundColor: colors.white, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.slate100, padding: spacing.md, marginBottom: spacing.sm },
  cardHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm },
  personRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexShrink: 1 },
  avatar: { width: 32, height: 32, borderRadius: radius.full, backgroundColor: colors.slate800, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  avatarImg: { width: '100%', height: '100%' },
  avatarInitial: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.xs, color: colors.white },
  personName: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.sm, color: colors.slate800 },
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
  acceptButton: { flex: 1, backgroundColor: '#111111', borderRadius: radius.md, paddingVertical: spacing.sm, alignItems: 'center' },
  acceptButtonText: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.xs, color: colors.white },
  rejectButton: { flex: 1, backgroundColor: '#FEF2F2', borderRadius: radius.md, paddingVertical: spacing.sm, alignItems: 'center' },
  rejectButtonText: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.xs, color: '#DC2626' },
  rejectInput: { borderWidth: 1, borderColor: colors.slate200, borderRadius: radius.md, padding: spacing.sm, fontFamily: fonts.body, fontSize: fontSizes.xs, color: colors.slate800, minHeight: 48, textAlignVertical: 'top' },
  cancelButton: { flex: 1, backgroundColor: colors.slate100, borderRadius: radius.md, paddingVertical: spacing.sm, alignItems: 'center' },
  cancelButtonText: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.xs, color: colors.slate600 },
  confirmRejectButton: { flex: 1, backgroundColor: colors.danger, borderRadius: radius.md, paddingVertical: spacing.sm, alignItems: 'center' },
  empty: { alignItems: 'center', paddingVertical: spacing.xxl },
  emptyTitle: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.sm, color: colors.slate700 },
  emptyBody: { fontFamily: fonts.body, fontSize: fontSizes.xs, color: colors.slate400, marginTop: 2, textAlign: 'center', maxWidth: 240 },
})
