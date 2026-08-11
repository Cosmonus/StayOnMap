import { useState } from 'react'
import { View, Text, TextInput, Pressable, ScrollView, ActivityIndicator, StyleSheet, Share } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { leaseService } from '@services/lease.service'
import { authService } from '@services/auth.service'
import { useAuth } from '@features/auth/hooks/useAuth'
import { formatCurrency } from '@utils/format'
import { WEB_ORIGIN } from '@config/links'
import Icon from '@components/common/Icon'
import ScreenHeader from '@components/common/ScreenHeader'
import ErrorState from '@components/common/ErrorState'
import TenancyList from '@features/tenancies/components/TenancyList'
import { colors } from '@theme/colors'
import { useLayout, centered } from '@theme/breakpoints'
import { fonts, fontSizes } from '@theme/typography'
import { radius, spacing } from '@theme/spacing'

const STATUS_CFG = {
  OFFERED:    { label: 'Awaiting signature', bg: colors.warning50, text: '#B45309', dot: '#FBBF24' },
  ACTIVE:     { label: 'Active',             bg: colors.success50, text: '#15803D', dot: '#4ADE80' },
  REJECTED:   { label: 'Rejected',           bg: colors.danger50, text: '#DC2626', dot: '#F87171' },
  TERMINATED: { label: 'Terminated',         bg: colors.slate100, text: colors.slate600, dot: colors.slate400 },
  EXPIRED:    { label: 'Expired',            bg: colors.slate100, text: colors.slate500, dot: colors.slate200 },
}

function StatusPill({ status }) {
  const cfg = STATUS_CFG[status] ?? STATUS_CFG.OFFERED
  return (
    <View style={[styles.statusPill, { backgroundColor: cfg.bg }]}>
      <View style={[styles.statusDot, { backgroundColor: cfg.dot }]} />
      <Text style={[styles.statusText, { color: cfg.text }]}>{cfg.label}</Text>
    </View>
  )
}

function formatDate(d) {
  return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

function LeaseCard({ lease, currentUserId }) {
  const qc = useQueryClient()
  const [note, setNote] = useState('')
  const [showConfirm, setShowConfirm] = useState(null)

  const iAmOwner = lease.ownerId === currentUserId
  const iAmTenant = lease.tenantId === currentUserId
  const other = iAmOwner ? lease.tenant : lease.owner
  const otherRole = iAmOwner ? 'Tenant' : 'Owner'

  const { mutate: doAction, isPending } = useMutation({
    mutationFn: (action) => {
      if (action === 'sign') return leaseService.sign(lease.id, { tenantNote: note })
      if (action === 'reject') return leaseService.reject(lease.id, { tenantNote: note })
      if (action === 'terminate') return leaseService.terminate(lease.id, { ownerNote: note })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['leases'] })
      setShowConfirm(null)
      setNote('')
    },
  })

  const months = Math.round((new Date(lease.endDate) - new Date(lease.startDate)) / (1000 * 60 * 60 * 24 * 30))

  // The "I'm home" share (docs/points-and-sharing.md §4): area + city + month
  // ONLY — no address, photo, listing link or owner name. Text share via the
  // built-in Share API; an image card needs react-native-view-shot (a native
  // dep this app deliberately avoids adding piecemeal).
  async function shareHome() {
    const area = lease.property?.landmark || lease.property?.city || ''
    const city = lease.property?.city || ''
    const month = new Date(lease.signedAt || lease.startDate).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })
    const place = area && area !== city ? `${area}, ${city}` : city
    try {
      await Share.share({ message: `🏡 I'm home! ${place} · ${month}\nFound broker-free on StayOnMap — ${WEB_ORIGIN}` })
    } catch { /* share sheet dismissed */ }
  }

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.propertyTitle} numberOfLines={1}>{lease.property?.title}</Text>
          <Text style={styles.propertyCity}>{lease.property?.city}</Text>
        </View>
        <StatusPill status={lease.status} />
      </View>

      <View style={styles.detailsGrid}>
        <View style={styles.detailCell}>
          <Text style={styles.detailLabel}>Rent</Text>
          <Text style={styles.detailValueBrand}>{formatCurrency(Number(lease.rentAmount))}/mo</Text>
        </View>
        <View style={styles.detailCell}>
          <Text style={styles.detailLabel}>Deposit</Text>
          <Text style={styles.detailValue}>{formatCurrency(Number(lease.depositAmount))}</Text>
        </View>
        <View style={styles.detailCell}>
          <Text style={styles.detailLabel}>Duration</Text>
          <Text style={styles.detailValue}>{months} mo</Text>
        </View>
        <View style={styles.detailCell}>
          <Text style={styles.detailLabel}>{otherRole}</Text>
          <Text style={styles.detailValue} numberOfLines={1}>{other?.name ?? '—'}</Text>
        </View>
      </View>

      <View style={styles.dateRow}>
        <Text style={styles.dateText}>From {formatDate(lease.startDate)}</Text>
        <Text style={styles.dateText}>To {formatDate(lease.endDate)}</Text>
      </View>

      {(lease.ownerNote || lease.tenantNote) && (
        <View style={styles.notesBox}>
          {lease.ownerNote && <Text style={styles.noteText}><Text style={styles.noteLabel}>Owner note: </Text>{lease.ownerNote}</Text>}
          {lease.tenantNote && <Text style={styles.noteText}><Text style={styles.noteLabel}>Tenant note: </Text>{lease.tenantNote}</Text>}
        </View>
      )}

      {showConfirm ? (
        <View style={styles.confirmBox}>
          <TextInput
            style={styles.confirmInput}
            value={note}
            onChangeText={setNote}
            placeholder={showConfirm === 'sign' ? 'Optional note…' : 'Reason (optional)…'}
            placeholderTextColor={colors.slate500}
            multiline
          />
          <View style={styles.actionRow}>
            <Pressable
              style={[styles.confirmButton, { backgroundColor: showConfirm === 'sign' ? '#16A34A' : colors.danger }]}
              onPress={() => doAction(showConfirm)}
              disabled={isPending}
              accessibilityRole="button"
              accessibilityLabel={showConfirm === 'sign' ? 'Confirm and sign lease' : showConfirm === 'reject' ? 'Confirm lease rejection' : 'Confirm lease termination'}
              accessibilityState={{ disabled: isPending }}
            >
              {isPending ? <ActivityIndicator color={colors.white} size="small" /> : (
                <Text style={styles.confirmButtonText}>
                  {showConfirm === 'sign' ? 'Confirm & sign' : showConfirm === 'reject' ? 'Confirm rejection' : 'Confirm termination'}
                </Text>
              )}
            </Pressable>
            <Pressable style={styles.cancelButton} onPress={() => setShowConfirm(null)} accessibilityRole="button" accessibilityLabel="Cancel">
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <View style={styles.actionRow}>
          {iAmTenant && lease.status === 'OFFERED' && (
            <>
              <Pressable style={styles.signButton} onPress={() => setShowConfirm('sign')} accessibilityRole="button" accessibilityLabel="Sign lease">
                <Icon name="check" size={13} color={colors.white} />
                <Text style={styles.confirmButtonText}>Sign lease</Text>
              </Pressable>
              <Pressable style={styles.rejectButton} onPress={() => setShowConfirm('reject')} accessibilityRole="button" accessibilityLabel="Reject lease">
                <Icon name="close" size={13} color={colors.danger} />
                <Text style={styles.rejectButtonText}>Reject</Text>
              </Pressable>
            </>
          )}
          {iAmTenant && lease.status === 'ACTIVE' && (
            <Pressable style={styles.shareButton} onPress={shareHome} accessibilityRole="button" accessibilityLabel="Share that you found a home">
              <Text style={styles.shareButtonText}>🏡 Share: I&apos;m home</Text>
            </Pressable>
          )}
          {iAmOwner && lease.status === 'ACTIVE' && (
            <Pressable style={styles.rejectButton} onPress={() => setShowConfirm('terminate')} accessibilityRole="button" accessibilityLabel="Terminate lease">
              <Icon name="close" size={13} color={colors.danger} />
              <Text style={styles.rejectButtonText}>Terminate</Text>
            </Pressable>
          )}
        </View>
      )}
    </View>
  )
}

export default function LeasesScreen({ navigation }) {
  const { contentMaxWidth } = useLayout()
  const { user } = useAuth()

  const { data: profile } = useQuery({
    queryKey: ['me'],
    queryFn: () => authService.getMe().then((r) => r.data),
    enabled: !!user,
  })
  const isOwner = profile?.role === 'OWNER'

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['leases'],
    queryFn: () => leaseService.getMyLeases().then((r) => r.data),
    enabled: !!user,
  })

  const asOwner = data?.asOwner ?? []
  const asTenant = data?.asTenant ?? []

  return (
    <SafeAreaView style={styles.container} edges={[]}>
      <ScreenHeader
        title="Leases"
        subtitle="Manage rental agreements"
        onBack={() => navigation.goBack()}
      />

      {isLoading ? (
        <View style={styles.center}><ActivityIndicator color={colors.brand600} /></View>
      ) : isError ? (
        <ErrorState title="Couldn't load leases" onRetry={refetch} />
      ) : (
        <ScrollView contentContainerStyle={[styles.scroll, centered(contentMaxWidth)]}>
          {/* The tenancy record sits above the lease paperwork: confirm
              prompts and double-blind reviews live here for BOTH hats — this
              screen already shows both sides of leasing, so it shows both
              sides of the record too. */}
          <TenancyList hat="tenant" enabled={!!user} />
          {isOwner && <TenancyList hat="owner" enabled={!!user} />}
          {isOwner && asOwner.length > 0 && (
            <View style={{ gap: spacing.sm, marginBottom: spacing.lg }}>
              <Text style={styles.sectionLabel}>Leases you&apos;ve offered</Text>
              {asOwner.map((l) => <LeaseCard key={l.id} lease={l} currentUserId={user?.id} />)}
            </View>
          )}

          {asTenant.length > 0 && (
            <View style={{ gap: spacing.sm }}>
              <Text style={styles.sectionLabel}>Your lease agreements</Text>
              {asTenant.map((l) => <LeaseCard key={l.id} lease={l} currentUserId={user?.id} />)}
            </View>
          )}

          {asOwner.length === 0 && asTenant.length === 0 && (
            <View style={styles.empty}>
              <View style={styles.emptyIcon}>
                <Icon name="document" size={22} color={colors.slate500} />
              </View>
              <Text style={styles.emptyTitle}>No leases yet</Text>
              <Text style={styles.emptyBody}>
                {isOwner
                  ? 'Once an appointment is accepted, offer a lease from My Listings.'
                  : 'Your owner will send a lease offer after your appointment is confirmed.'}
              </Text>
            </View>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.slate50 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { padding: spacing.lg, paddingTop: spacing.xs },
  sectionLabel: { fontFamily: fonts.bodySemiBold, fontSize: 11, color: colors.slate500, textTransform: 'uppercase', letterSpacing: 0.5 },
  card: { backgroundColor: colors.white, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.slate100, padding: spacing.md, marginBottom: spacing.sm, gap: spacing.sm },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: spacing.sm },
  propertyTitle: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.sm, color: colors.slate800 },
  propertyCity: { fontFamily: fonts.body, fontSize: 11, color: colors.slate500, marginTop: 1 },
  statusPill: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: spacing.sm, paddingVertical: 3, borderRadius: radius.full },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontFamily: fonts.bodySemiBold, fontSize: 11 },
  detailsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, borderTopWidth: 1, borderTopColor: colors.slate50, paddingTop: spacing.sm },
  detailCell: { minWidth: '40%' },
  detailLabel: { fontFamily: fonts.body, fontSize: 11, color: colors.slate500 },
  detailValueBrand: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.xs, color: colors.brand700, marginTop: 1 },
  detailValue: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.xs, color: colors.slate700, marginTop: 1 },
  dateRow: { flexDirection: 'row', gap: spacing.md, borderTopWidth: 1, borderTopColor: colors.slate50, paddingTop: spacing.sm },
  dateText: { fontFamily: fonts.body, fontSize: 11, color: colors.slate500 },
  notesBox: { gap: 2, borderTopWidth: 1, borderTopColor: colors.slate50, paddingTop: spacing.sm },
  noteText: { fontFamily: fonts.body, fontSize: 11, color: colors.slate500, lineHeight: 15 },
  noteLabel: { fontFamily: fonts.bodySemiBold },
  confirmBox: { gap: spacing.sm, backgroundColor: colors.slate50, borderRadius: radius.md, padding: spacing.sm },
  confirmInput: { borderWidth: 1, borderColor: colors.slate200, borderRadius: radius.md, paddingHorizontal: spacing.sm, paddingVertical: spacing.sm, fontFamily: fonts.body, fontSize: fontSizes.xs, color: colors.slate800, backgroundColor: colors.white, minHeight: 50, textAlignVertical: 'top' },
  actionRow: { flexDirection: 'row', gap: spacing.sm },
  confirmButton: { flex: 1, minHeight: 44, paddingVertical: spacing.sm, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  confirmButtonText: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.xs, color: colors.white },
  cancelButton: { minHeight: 44, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.md, borderWidth: 1, borderColor: colors.slate200, alignItems: 'center', justifyContent: 'center' },
  cancelButtonText: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.xs, color: colors.slate600 },
  signButton: { flex: 1, minHeight: 44, flexDirection: 'row', gap: 5, backgroundColor: '#16A34A', borderRadius: radius.md, paddingVertical: spacing.sm, alignItems: 'center', justifyContent: 'center' },
  rejectButton: { flex: 1, minHeight: 44, flexDirection: 'row', gap: 5, borderWidth: 1, borderColor: '#FECACA', borderRadius: radius.md, paddingVertical: spacing.sm, alignItems: 'center', justifyContent: 'center' },
  rejectButtonText: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.xs, color: colors.danger },
  shareButton: { flex: 1, minHeight: 44, flexDirection: 'row', gap: 5, borderWidth: 1, borderColor: colors.brand200, borderRadius: radius.md, paddingVertical: spacing.sm, alignItems: 'center', justifyContent: 'center' },
  shareButtonText: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.xs, color: colors.brand700 },
  empty: { alignItems: 'center', paddingVertical: spacing.xxl },
  emptyIcon: { width: 48, height: 48, borderRadius: radius.full, backgroundColor: colors.slate100, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.sm },
  emptyTitle: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.sm, color: colors.slate700 },
  emptyBody: { fontFamily: fonts.body, fontSize: fontSizes.xs, color: colors.slate500, marginTop: 4, textAlign: 'center', maxWidth: 260 },
})
