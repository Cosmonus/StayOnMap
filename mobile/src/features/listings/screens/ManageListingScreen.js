import { useMemo, useState } from 'react'
import { View, Text, FlatList, Pressable, ActivityIndicator, Alert, StyleSheet } from 'react-native'
import { Image } from 'expo-image'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { propertyService } from '@services/property.service'
import { formatPrice, formatDate, imgUrl } from '@utils/format'
import Icon from '@components/common/Icon'
import ScreenHeader from '@components/common/ScreenHeader'
import ContactRow, { buildContactStats } from '../components/ContactRow'
import { chatService } from '@services/chat.service'
import ReportsSheet from '../components/ReportsSheet'
import { editedSinceModeration } from '../config/moderation'
import { colors } from '@theme/colors'
import { tapBox } from '@theme/touchTargets'
import { useLayout, centered } from '@theme/breakpoints'
import { fonts, fontSizes } from '@theme/typography'
import { spacing, radius } from '@theme/spacing'

const STATUS_COLORS = {
  DRAFT: { bg: colors.slate100, text: colors.slate600 },
  ACTIVE: { bg: colors.success50, text: '#15803D' },
  INACTIVE: { bg: colors.slate100, text: colors.slate500 },
  PENDING: { bg: colors.warning50, text: '#B45309' },
  OCCUPIED: { bg: '#EEF2FF', text: '#4338CA' },
  SUSPENDED: { bg: colors.danger50, text: '#DC2626' },
  REJECTED: { bg: colors.danger50, text: '#DC2626' },
}

function StatusPill({ status }) {
  const c = STATUS_COLORS[status] ?? STATUS_COLORS.DRAFT
  return (
    <View style={[styles.statusPill, { backgroundColor: c.bg }]}>
      <Text style={[styles.statusPillText, { color: c.text }]}>{status}</Text>
    </View>
  )
}

function ActionRow({ icon, label, sub, onPress, disabled, variant = 'default' }) {
  const iconColor = variant === 'danger' ? colors.danger : variant === 'primary' ? colors.brand600 : colors.slate600
  const labelColor = variant === 'danger' ? colors.danger : colors.slate800
  return (
    <Pressable
      style={[styles.actionRow, disabled && styles.disabled]}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <View style={[styles.actionIcon, variant === 'primary' && { backgroundColor: colors.brand50 }]}>
        <Icon name={icon} size={16} color={iconColor} />
      </View>
      <View style={styles.actionText}>
        <Text style={[styles.actionLabel, { color: labelColor }]}>{label}</Text>
        {sub ? <Text style={styles.actionSub}>{sub}</Text> : null}
      </View>
      <Icon name="chevronRight" size={16} color={colors.slate500} />
    </Pressable>
  )
}

export default function ManageListingScreen({ navigation, route }) {
  const { contentMaxWidth } = useLayout()
  const { propertyId } = route.params
  const qc = useQueryClient()
  const [reportsOpen, setReportsOpen] = useState(false)
  const [chattingId, setChattingId] = useState(null)

  // Same shape as AppointmentsScreen's openChat: get-or-create the thread,
  // then push Conversation onto THIS stack (BOOKING_SCREENS registers it
  // here), so back returns to this listing rather than the Inbox tab's list.
  async function openChat(contact) {
    if (!contact?.id) return
    setChattingId(contact.id)
    try {
      const convo = await chatService.startWithTenant(propertyId, contact.id).then((r) => r.data)
      qc.invalidateQueries({ queryKey: ['conversations'] })
      navigation.navigate('Conversation', {
        conversationId: convo.id,
        other: contact,
        otherRole: 'Renter',
      })
    } catch {
      Alert.alert('Couldn’t open the chat', 'Please try again in a moment.')
    } finally {
      setChattingId(null)
    }
  }

  const { data: property, isLoading, isError, refetch } = useQuery({
    queryKey: ['manage-listing', propertyId],
    queryFn: () => propertyService.getById(propertyId).then((r) => r.data),
  })

  const {
    data: contacts,
    isLoading: contactsLoading,
    isError: contactsError,
    refetch: refetchContacts,
  } = useQuery({
    queryKey: ['property-contacts', propertyId],
    queryFn: () => propertyService.getContacts(propertyId).then((r) => r.data),
    refetchInterval: 30000,
    retry: 1,
  })

  function invalidate() {
    qc.invalidateQueries({ queryKey: ['manage-listing', propertyId] })
    qc.invalidateQueries({ queryKey: ['my-listings'] })
  }

  const publishMutation = useMutation({
    mutationFn: () => propertyService.publish(propertyId),
    onSuccess: invalidate,
    onError: (e) => Alert.alert('Error', e?.message ?? 'Failed to submit for review'),
  })
  const toggleMutation = useMutation({
    mutationFn: () => propertyService.toggleStatus(propertyId),
    onSuccess: invalidate,
    onError: (e) => Alert.alert('Error', e?.message ?? 'Failed to update status'),
  })
  const markTenantMutation = useMutation({
    mutationFn: (tenantId) => propertyService.markTenant(propertyId, tenantId),
    onSuccess: () => {
      invalidate()
      qc.invalidateQueries({ queryKey: ['property-contacts', propertyId] })
    },
    onError: (e) => Alert.alert('Error', e?.message ?? 'Failed to mark tenant'),
  })
  const vacateMutation = useMutation({
    mutationFn: () => propertyService.vacate(propertyId),
    onSuccess: invalidate,
    onError: (e) => Alert.alert('Error', e?.message ?? 'Failed to vacate'),
  })
  const removeMutation = useMutation({
    mutationFn: () => propertyService.remove(propertyId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['my-listings'] })
      navigation.goBack()
    },
    onError: (e) => Alert.alert('Error', e?.message ?? 'Failed to delete listing'),
  })

  const busy =
    publishMutation.isPending ||
    toggleMutation.isPending ||
    markTenantMutation.isPending ||
    vacateMutation.isPending ||
    removeMutation.isPending

  const contactStats = useMemo(() => buildContactStats(contacts), [contacts])

  function confirmMarkTenant(contact) {
    const displayName = contact.name || contact.email?.split('@')[0] || 'this person'
    Alert.alert(
      'Mark as tenant?',
      `${displayName} will be marked as your tenant and the listing set to Occupied. It will no longer appear on the public map.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Mark as Tenant', onPress: () => markTenantMutation.mutate(contact.id) },
      ]
    )
  }

  // Pausing takes a live listing off the map, so it asks first — same wording
  // and same one-sided rule as web (`OnboardingWizard`'s confirmToggleStatus):
  // resuming is harmless and goes straight through.
  function confirmPause() {
    Alert.alert(
      'Pause this listing?',
      `“${property?.title ?? 'This listing'}” will come off the map and stop receiving visit requests. Nothing is deleted — you can resume it whenever you like.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Pause listing', onPress: () => toggleMutation.mutate() },
      ]
    )
  }

  function confirmVacate() {
    Alert.alert(
      'Mark as vacant?',
      'This will remove the current tenant and set the listing back to Active on the map.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Mark as Vacant', onPress: () => vacateMutation.mutate() },
      ]
    )
  }

  function confirmDelete() {
    Alert.alert(
      'Delete listing?',
      `“${property?.title ?? 'This listing'}” will be permanently deleted along with all its data. This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => removeMutation.mutate() },
      ]
    )
  }

  if (isLoading) {
    return (
      <SafeAreaView style={styles.center} edges={[]}>
        <ActivityIndicator color={colors.brand600} size="large" />
      </SafeAreaView>
    )
  }

  if (isError || !property) {
    return (
      <SafeAreaView style={styles.center} edges={[]}>
        <Text style={styles.errorTitle}>Couldn&apos;t load this listing</Text>
        <Pressable style={styles.retryButton} onPress={() => refetch()} accessibilityRole="button" accessibilityLabel="Retry loading listing">
          <Text style={styles.retryText}>Retry</Text>
        </Pressable>
        <Pressable onPress={() => navigation.goBack()} accessibilityRole="button" accessibilityLabel="Go back" style={tapBox}>
          <Text style={styles.backLink}>Go back</Text>
        </Pressable>
      </SafeAreaView>
    )
  }

  const { status } = property
  const edited = editedSinceModeration(property)
  const primaryImage = property.images?.find((i) => i.isPrimary) ?? property.images?.[0]

  // Once somebody lives there, the queue has done its job: the list below the
  // actions shows THE TENANT in place of everyone who once asked (operator
  // decision 2026-08-15). Prefer the tenant's row from the contacts payload —
  // it carries the gated phone and the chat affordance — and fall back to the
  // identity on the property itself, so the tenant never vanishes just because
  // the contacts fetch is slow or they arrived via a lease rather than a chat.
  const tenant = status === 'OCCUPIED' && property.currentTenant
    ? contactStats.find((c) => c.id === property.currentTenant.id) ?? property.currentTenant
    : null
  const tenantMeta = property.occupiedSince
    ? `Your tenant · Since ${formatDate(property.occupiedSince)}`
    : 'Your tenant'

  // Status-gated actions — mirrors the backend's real transition rules:
  // publish: DRAFT|REJECTED → PENDING; toggle: ACTIVE ↔ INACTIVE;
  // markTenant: ACTIVE → OCCUPIED (via contact rows); vacate: OCCUPIED → ACTIVE.
  const header = (
    <View>
      <View style={styles.hero}>
        {primaryImage ? (
          <Image source={{ uri: imgUrl(primaryImage.url, 'detail') }} style={styles.heroImage} contentFit="cover" cachePolicy="memory-disk" transition={200} />
        ) : (
          <View style={[styles.heroImage, styles.heroPlaceholder]}>
            <Icon name="image" size={28} color={colors.slate500} />
          </View>
        )}
        <View style={styles.statusPillWrap}>
          <StatusPill status={status} />
        </View>
      </View>

      <View style={styles.summary}>
        <Text style={styles.title} numberOfLines={2}>{property.title}</Text>
        <Text style={styles.rent}>{formatPrice(property)}</Text>
        <Text style={styles.address} numberOfLines={1}>
          {[property.address, property.city].filter(Boolean).join(', ')}
        </Text>
      </View>

      {(status === 'REJECTED' || status === 'SUSPENDED') && property.moderationNote && (
        <View style={styles.moderationCard}>
          <Text style={styles.moderationTitle}>{status === 'REJECTED' ? 'Not approved' : 'Paused by StayOnMap'}</Text>
          <Text style={styles.moderationBody}>{property.moderationNote}</Text>
        </View>
      )}

      <Text style={styles.sectionTitle}>Manage</Text>
      <View style={styles.actionsCard}>
        <ActionRow
          icon="home"
          label="View listing"
          sub="See this property as renters do"
          onPress={() => navigation.navigate('PropertyDetail', { propertyId })}
          disabled={busy}
        />
        {(status === 'DRAFT' || status === 'REJECTED') && (
          // A rejection is answered with a change: the server refuses an
          // unchanged resubmission (409), so the row says so instead.
          <ActionRow
            icon="checkCircle"
            label={status === 'REJECTED' ? 'Submit again' : 'Submit for review'}
            sub={status === 'REJECTED' && !edited ? 'Edit the listing first, then submit again' : 'Send this listing for approval'}
            variant="primary"
            onPress={() => publishMutation.mutate()}
            disabled={busy || (status === 'REJECTED' && !edited)}
          />
        )}
        {status === 'ACTIVE' && (
          <ActionRow icon="eye" label="Pause listing" sub="Hide from the public map" onPress={confirmPause} disabled={busy} />
        )}
        {status === 'INACTIVE' && (
          <ActionRow icon="eye" label="Resume listing" sub="Show on the public map again" variant="primary" onPress={() => toggleMutation.mutate()} disabled={busy} />
        )}
        {status === 'OCCUPIED' && (
          <ActionRow icon="key" label="Mark as vacant" sub="Remove tenant, relist as Active" variant="primary" onPress={confirmVacate} disabled={busy} />
        )}
        {(status === 'ACTIVE' || status === 'DRAFT' || status === 'INACTIVE') && (
          <ActionRow
            icon="shieldCheck"
            label="Verify ownership"
            sub="Get the Verified Owner badge"
            onPress={() => navigation.navigate('Verification', { propertyId, propertyTitle: property.title })}
            disabled={busy}
          />
        )}
        {/* A sale has no tenancy to offer — a lease agreement on a listing being
            sold outright is a contradiction, not a shortcut. */}
        {status === 'ACTIVE' && property.pricingModel !== 'SALE' && (
          <ActionRow
            icon="document"
            label="Offer lease"
            sub="Send a lease offer to a tenant"
            onPress={() => navigation.navigate('CreateLease', { propertyId, propertyTitle: property.title })}
            disabled={busy}
          />
        )}
        <ActionRow
          icon="edit"
          label="Edit"
          sub="Details, photos, features, and pricing"
          onPress={() => navigation.navigate('EditListing', { propertyId })}
          disabled={busy}
        />
        {/* Shown for every status, and unconditionally rather than badged on a
            count: knowing whether to draw it would mean fetching the reports
            for a listing that usually has none. The sheet answers "nobody has
            reported this listing", which is the answer an owner wants and one
            worth being able to ask for. */}
        <ActionRow
          icon="shield"
          label="Reports on this listing"
          sub="See what was flagged, and reply"
          onPress={() => setReportsOpen(true)}
          disabled={busy}
        />
        <ActionRow icon="trash" label="Delete listing" sub="Permanent, cannot be undone" variant="danger" onPress={confirmDelete} disabled={busy} />
      </View>

      {tenant ? (
        <Text style={styles.sectionTitle}>Your tenant</Text>
      ) : (
        <Text style={styles.sectionTitle}>
          People who contacted{contactStats.length > 0 ? ` (${contactStats.length})` : ''}
        </Text>
      )}
      {status === 'ACTIVE' && contactStats.length > 0 && (
        <Text style={styles.sectionHint}>Rented to one of them? Tap “Make tenant” to mark the listing occupied.</Text>
      )}
    </View>
  )

  const contactsEmpty = contactsLoading ? (
    <View style={styles.contactsState}>
      <ActivityIndicator color={colors.brand600} />
    </View>
  ) : contactsError ? (
    <View style={styles.contactsState}>
      <Text style={styles.contactsStateText}>Couldn&apos;t load contacts.</Text>
      <Pressable style={styles.retryButton} onPress={() => refetchContacts()} accessibilityRole="button" accessibilityLabel="Retry loading contacts">
        <Text style={styles.retryText}>Retry</Text>
      </Pressable>
    </View>
  ) : (
    <View style={styles.contactsState}>
      <View style={styles.contactsEmptyIcon}>
        <Icon name="users" size={18} color={colors.slate500} />
      </View>
      <Text style={styles.contactsStateText}>No contacts yet</Text>
      <Text style={styles.contactsStateSub}>People who reach out will appear here</Text>
    </View>
  )

  return (
    <SafeAreaView style={styles.container} edges={[]}>
      <ScreenHeader
        title="Manage listing"
        onBack={() => navigation.goBack()}
        right={busy ? <ActivityIndicator size="small" color={colors.brand600} /> : null}
      />
      <FlatList
        data={tenant ? [tenant] : contactStats}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={header}
        ListEmptyComponent={tenant ? null : contactsEmpty}
        contentContainerStyle={[styles.list, centered(contentMaxWidth)]}
        renderItem={({ item }) => (
          <ContactRow
            contact={item}
            meta={tenant ? tenantMeta : undefined}
            canMarkTenant={status === 'ACTIVE'}
            onMarkTenant={() => confirmMarkTenant(item)}
            onChat={() => openChat(item)}
            chatting={chattingId === item.id}
            disabled={busy}
          />
        )}
      />
      {/* Reports filed against this listing, and the owner's one reply. Both
          endpoints shipped with the reports feature and had no caller on
          either platform until 2026-08-10 — so a listing could be reported,
          and suspended on a risk score built partly from those reports, while
          its owner had no way to see what was said. */}
      <ReportsSheet
        visible={reportsOpen}
        onClose={() => setReportsOpen(false)}
        propertyId={propertyId}
        propertyTitle={property?.title}
      />
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.slate50 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.slate50, gap: spacing.md, padding: spacing.xl },
  list: { paddingTop: spacing.lg, paddingBottom: spacing.xxl },
  hero: { marginHorizontal: spacing.lg, borderRadius: radius.lg, overflow: 'hidden', aspectRatio: 16 / 9, backgroundColor: colors.slate100 },
  heroImage: { width: '100%', height: '100%' },
  heroPlaceholder: { alignItems: 'center', justifyContent: 'center' },
  statusPillWrap: { position: 'absolute', top: spacing.sm, left: spacing.sm },
  statusPill: { borderRadius: radius.full, paddingHorizontal: 10, paddingVertical: 3 },
  statusPillText: { fontFamily: fonts.bodySemiBold, fontSize: 11 },
  summary: { paddingHorizontal: spacing.lg, paddingTop: spacing.md },
  title: { fontFamily: fonts.displayBold, fontSize: fontSizes.lg, color: colors.slate800 },
  rent: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.base, color: colors.brand600, marginTop: 2 },
  address: { fontFamily: fonts.body, fontSize: fontSizes.xs, color: colors.slate500, marginTop: 2 },
  moderationCard: { marginHorizontal: spacing.lg, marginTop: spacing.lg, padding: spacing.md, backgroundColor: colors.danger50, borderWidth: 1, borderColor: colors.danger, borderRadius: radius.lg, gap: spacing.xs },
  moderationTitle: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.sm, color: colors.slate800 },
  moderationBody: { fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.slate600, lineHeight: 20 },
  sectionTitle: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.sm, color: colors.slate800, paddingHorizontal: spacing.lg, marginTop: spacing.lg, marginBottom: spacing.sm },
  sectionHint: { fontFamily: fonts.body, fontSize: fontSizes.xs, color: colors.slate500, paddingHorizontal: spacing.lg, marginBottom: spacing.xs },
  actionsCard: { marginHorizontal: spacing.lg, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.slate100, borderRadius: radius.lg, overflow: 'hidden' },
  actionRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.md, paddingVertical: spacing.md, minHeight: 56, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.slate100 },
  actionIcon: { width: 34, height: 34, borderRadius: radius.md, backgroundColor: colors.slate100, alignItems: 'center', justifyContent: 'center' },
  actionText: { flex: 1, minWidth: 0 },
  actionLabel: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.sm },
  actionSub: { fontFamily: fonts.body, fontSize: fontSizes.xs, color: colors.slate500, marginTop: 1 },
  contactsState: { alignItems: 'center', paddingVertical: spacing.xl, paddingHorizontal: spacing.lg, gap: spacing.sm },
  contactsEmptyIcon: { width: 40, height: 40, borderRadius: radius.full, backgroundColor: colors.slate100, alignItems: 'center', justifyContent: 'center' },
  contactsStateText: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.sm, color: colors.slate500 },
  contactsStateSub: { fontFamily: fonts.body, fontSize: fontSizes.xs, color: colors.slate500 },
  errorTitle: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.sm, color: colors.slate600 },
  retryButton: { backgroundColor: colors.brand600, borderRadius: radius.md, paddingHorizontal: spacing.xl, paddingVertical: spacing.sm, minHeight: 40, justifyContent: 'center' },
  retryText: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.sm, color: colors.white },
  backLink: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.xs, color: colors.brand600, padding: spacing.sm },
  disabled: { opacity: 0.5 },
})
