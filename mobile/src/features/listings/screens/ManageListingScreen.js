import { useMemo } from 'react'
import { View, Text, Image, FlatList, Pressable, ActivityIndicator, Alert, StyleSheet } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { propertyService } from '@services/property.service'
import { formatRent, formatDate, imgUrl } from '@utils/format'
import Icon from '@components/common/Icon'
import ContactRow, { buildContactStats } from '../components/ContactRow'
import { colors } from '@theme/colors'
import { shadows } from '@theme/shadows'
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
      <Icon name="chevronRight" size={16} color={colors.slate400} />
    </Pressable>
  )
}

export default function ManageListingScreen({ navigation, route }) {
  const { propertyId } = route.params
  const qc = useQueryClient()

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
    Alert.alert('Delete listing?', 'Permanently removes this listing and all its data.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => removeMutation.mutate() },
    ])
  }

  if (isLoading) {
    return (
      <SafeAreaView style={styles.center} edges={['top', 'bottom']}>
        <ActivityIndicator color={colors.brand600} size="large" />
      </SafeAreaView>
    )
  }

  if (isError || !property) {
    return (
      <SafeAreaView style={styles.center} edges={['top', 'bottom']}>
        <Text style={styles.errorTitle}>Couldn&apos;t load this listing</Text>
        <Pressable style={styles.retryButton} onPress={() => refetch()} accessibilityRole="button" accessibilityLabel="Retry loading listing">
          <Text style={styles.retryText}>Retry</Text>
        </Pressable>
        <Pressable onPress={() => navigation.goBack()} accessibilityRole="button" accessibilityLabel="Go back" hitSlop={8}>
          <Text style={styles.backLink}>Go back</Text>
        </Pressable>
      </SafeAreaView>
    )
  }

  const { status } = property
  const primaryImage = property.images?.find((i) => i.isPrimary) ?? property.images?.[0]

  // Status-gated actions — mirrors the backend's real transition rules:
  // publish: DRAFT|REJECTED → PENDING; toggle: ACTIVE ↔ INACTIVE;
  // markTenant: ACTIVE → OCCUPIED (via contact rows); vacate: OCCUPIED → ACTIVE.
  const header = (
    <View>
      <View style={styles.hero}>
        {primaryImage ? (
          <Image source={{ uri: imgUrl(primaryImage.url, 'detail') }} style={styles.heroImage} resizeMode="cover" />
        ) : (
          <View style={[styles.heroImage, styles.heroPlaceholder]}>
            <Icon name="image" size={28} color={colors.slate400} />
          </View>
        )}
        <View style={styles.statusPillWrap}>
          <StatusPill status={status} />
        </View>
      </View>

      <View style={styles.summary}>
        <Text style={styles.title} numberOfLines={2}>{property.title}</Text>
        <Text style={styles.rent}>{formatRent(Number(property.rent))}</Text>
        <Text style={styles.address} numberOfLines={1}>
          {[property.address, property.city].filter(Boolean).join(', ')}
        </Text>
      </View>

      {status === 'OCCUPIED' && property.currentTenant && (
        <View style={styles.tenantBanner}>
          <View style={styles.tenantBannerIcon}>
            <Icon name="home" size={16} color="#4338CA" />
          </View>
          <View style={styles.tenantBannerInfo}>
            <Text style={styles.tenantBannerLabel}>Current tenant</Text>
            <Text style={styles.tenantBannerName} numberOfLines={1}>{property.currentTenant.name}</Text>
            {property.occupiedSince && (
              <Text style={styles.tenantBannerSince}>Since {formatDate(property.occupiedSince)}</Text>
            )}
          </View>
        </View>
      )}

      <Text style={styles.sectionTitle}>Manage</Text>
      <View style={styles.actionsCard}>
        <ActionRow
          icon="home"
          label="View public listing"
          sub="See this property as renters do"
          onPress={() => navigation.navigate('PropertyDetail', { propertyId })}
          disabled={busy}
        />
        {(status === 'DRAFT' || status === 'REJECTED') && (
          <ActionRow
            icon="checkCircle"
            label={status === 'REJECTED' ? 'Re-publish' : 'Submit for review'}
            sub="Send this listing for approval"
            variant="primary"
            onPress={() => publishMutation.mutate()}
            disabled={busy}
          />
        )}
        {status === 'ACTIVE' && (
          <ActionRow icon="eye" label="Deactivate" sub="Hide from the public map" onPress={() => toggleMutation.mutate()} disabled={busy} />
        )}
        {status === 'INACTIVE' && (
          <ActionRow icon="eye" label="Activate" sub="Show on the public map again" variant="primary" onPress={() => toggleMutation.mutate()} disabled={busy} />
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
        {status === 'ACTIVE' && (
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
          label="Edit details"
          sub="Title, description, and pricing"
          onPress={() => navigation.navigate('EditListing', { propertyId })}
          disabled={busy}
        />
        <ActionRow icon="trash" label="Delete listing" sub="Permanent, cannot be undone" variant="danger" onPress={confirmDelete} disabled={busy} />
      </View>

      <Text style={styles.sectionTitle}>
        People who contacted{contactStats.length > 0 ? ` (${contactStats.length})` : ''}
      </Text>
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
        <Icon name="users" size={18} color={colors.slate400} />
      </View>
      <Text style={styles.contactsStateText}>No contacts yet</Text>
      <Text style={styles.contactsStateSub}>People who reach out will appear here</Text>
    </View>
  )

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.headerBar}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={12} accessibilityRole="button" accessibilityLabel="Go back">
          <Icon name="chevronLeft" size={22} color={colors.slate800} />
        </Pressable>
        <Text style={styles.headerBarTitle}>Manage listing</Text>
        {busy ? <ActivityIndicator size="small" color={colors.brand600} /> : <View style={styles.headerSpacer} />}
      </View>
      <FlatList
        data={contactStats}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={header}
        ListEmptyComponent={contactsEmpty}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <ContactRow
            contact={item}
            canMarkTenant={status === 'ACTIVE'}
            onMarkTenant={() => confirmMarkTenant(item)}
            disabled={busy}
          />
        )}
      />
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.slate50 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.slate50, gap: spacing.md, padding: spacing.xl },
  headerBar: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.md, minHeight: 48 },
  headerBarTitle: { flex: 1, fontFamily: fonts.displayBold, fontSize: fontSizes.lg, color: colors.slate800 },
  headerSpacer: { width: 20 },
  list: { paddingBottom: spacing.xxl },
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
  tenantBanner: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginHorizontal: spacing.lg, marginTop: spacing.md, padding: spacing.md, backgroundColor: '#EEF2FF', borderRadius: radius.lg, borderWidth: 1, borderColor: '#E0E7FF' },
  tenantBannerIcon: { width: 36, height: 36, borderRadius: radius.md, backgroundColor: '#E0E7FF', alignItems: 'center', justifyContent: 'center' },
  tenantBannerInfo: { flex: 1, minWidth: 0 },
  tenantBannerLabel: { fontFamily: fonts.bodySemiBold, fontSize: 11, color: '#4338CA', textTransform: 'uppercase' },
  tenantBannerName: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.sm, color: colors.slate800, marginTop: 1 },
  tenantBannerSince: { fontFamily: fonts.body, fontSize: fontSizes.xs, color: colors.slate500, marginTop: 1 },
  sectionTitle: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.sm, color: colors.slate800, paddingHorizontal: spacing.lg, marginTop: spacing.lg, marginBottom: spacing.sm },
  sectionHint: { fontFamily: fonts.body, fontSize: fontSizes.xs, color: colors.slate400, paddingHorizontal: spacing.lg, marginBottom: spacing.xs },
  actionsCard: { marginHorizontal: spacing.lg, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.slate100, borderRadius: radius.lg, overflow: 'hidden', ...shadows.card },
  actionRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.md, paddingVertical: spacing.md, minHeight: 56, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.slate100 },
  actionIcon: { width: 34, height: 34, borderRadius: radius.md, backgroundColor: colors.slate100, alignItems: 'center', justifyContent: 'center' },
  actionText: { flex: 1, minWidth: 0 },
  actionLabel: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.sm },
  actionSub: { fontFamily: fonts.body, fontSize: fontSizes.xs, color: colors.slate400, marginTop: 1 },
  contactsState: { alignItems: 'center', paddingVertical: spacing.xl, paddingHorizontal: spacing.lg, gap: spacing.sm },
  contactsEmptyIcon: { width: 40, height: 40, borderRadius: radius.full, backgroundColor: colors.slate100, alignItems: 'center', justifyContent: 'center' },
  contactsStateText: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.sm, color: colors.slate500 },
  contactsStateSub: { fontFamily: fonts.body, fontSize: fontSizes.xs, color: colors.slate400 },
  errorTitle: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.sm, color: colors.slate600 },
  retryButton: { backgroundColor: colors.brand600, borderRadius: radius.md, paddingHorizontal: spacing.xl, paddingVertical: spacing.sm, minHeight: 40, justifyContent: 'center' },
  retryText: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.sm, color: colors.white },
  backLink: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.xs, color: colors.brand600, padding: spacing.sm },
  disabled: { opacity: 0.5 },
})
